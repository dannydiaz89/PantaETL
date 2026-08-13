import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { accounts, sessions, settings, users, type DatabaseClient } from "@pantaetl/database";

/** Durable setting that makes initial-admin creation a one-time database operation. */
export const FIRST_ADMIN_SETTING_KEY = "auth.first_admin_created";

/** Safe administrator identity accepted by explicit command-line account operations. */
export interface AdminIdentity {
  readonly email: string;
  readonly username: string;
}

/** Result returned without revealing a generated password to application logs. */
export interface AdminCredentialResult {
  readonly created: boolean;
  readonly temporaryPassword: string | undefined;
}

/** Validates a local administrator identity before a password credential is written. */
export function parseAdminIdentity(value: { email?: string; username?: string }): AdminIdentity {
  const email = value.email?.trim().toLowerCase();
  const username = value.username?.trim();
  if (email === undefined || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error("PANTAETL_ADMIN_EMAIL must be a valid email address.");
  }
  if (username === undefined || username.length < 3) {
    throw new Error("PANTAETL_ADMIN_USERNAME must contain at least three characters.");
  }
  return { email, username };
}

/** Creates a high-entropy one-time password for an explicitly invoked admin command. */
export function generateTemporaryPassword(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Creates the first local administrator once, guarded by a transactional setting row.
 *
 * This function is never called during normal web-service startup.
 */
export async function createFirstAdmin(
  db: DatabaseClient,
  identity: AdminIdentity,
): Promise<AdminCredentialResult> {
  const temporaryPassword = generateTemporaryPassword();
  const password = await hashPassword(temporaryPassword);

  return db.transaction(async (transaction) => {
    const claimed = await transaction
      .insert(settings)
      .values({ key: FIRST_ADMIN_SETTING_KEY, value: true })
      .onConflictDoNothing()
      .returning({ key: settings.key });
    if (claimed.length === 0) {
      return { created: false, temporaryPassword: undefined };
    }

    const [user] = await transaction
      .insert(users)
      .values({
        email: identity.email,
        emailVerified: true,
        isAdmin: true,
        requiresPasswordChange: true,
        username: identity.username,
      })
      .returning({ id: users.id });
    if (user === undefined) {
      throw new Error("Initial administrator creation did not return a user.");
    }
    await transaction.insert(accounts).values({
      accountId: user.id,
      password,
      providerId: "credential",
      userId: user.id,
    });
    return { created: true, temporaryPassword };
  });
}

/** Resets one existing administrator password only after an explicit command invocation. */
export async function resetAdminPassword(db: DatabaseClient, email: string): Promise<string | undefined> {
  const normalizedEmail = parseAdminIdentity({ email, username: "admin" }).email;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, normalizedEmail), eq(users.isAdmin, true)))
    .limit(1);
  if (user === undefined) {
    return undefined;
  }

  const temporaryPassword = generateTemporaryPassword();
  const password = await hashPassword(temporaryPassword);
  await db.transaction(async (transaction) => {
    const updated = await transaction
      .update(accounts)
      .set({ password, updatedAt: new Date() })
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
      .returning({ id: accounts.id });
    if (updated.length === 0) {
      await transaction.insert(accounts).values({
        accountId: user.id,
        password,
        providerId: "credential",
        userId: user.id,
      });
    }
    await transaction.update(users).set({ requiresPasswordChange: true, updatedAt: new Date() }).where(eq(users.id, user.id));
    await transaction.delete(sessions).where(eq(sessions.userId, user.id));
  });
  return temporaryPassword;
}
