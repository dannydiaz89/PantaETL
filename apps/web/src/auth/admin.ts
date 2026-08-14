import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { accounts, sessions, users, type DatabaseClient } from "@pantaetl/database";

import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  MINIMUM_ADMIN_PASSWORD_LENGTH,
  isValidAdminEmail,
} from "./admin-credentials.js";

export {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  MINIMUM_ADMIN_PASSWORD_LENGTH,
} from "./admin-credentials.js";


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

/**
 * Validates a local administrator identity before a password credential is written.
 *
 * Both fields fall back to the well-known first-run identity so a new deployment can be
 * seeded without configuration, while an operator who supplies either value still has it
 * validated.
 */
export function parseAdminIdentity(value: { email?: string; username?: string }): AdminIdentity {
  const email = (value.email?.trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();
  const username = value.username?.trim() || DEFAULT_ADMIN_USERNAME;
  if (!isValidAdminEmail(email)) {
    throw new Error("PANTAETL_ADMIN_EMAIL must be a valid email address.");
  }
  if (username.length < 3) {
    throw new Error("PANTAETL_ADMIN_USERNAME must contain at least three characters.");
  }
  return { email, username };
}

/** Creates a high-entropy one-time password for an explicitly invoked admin command. */
export function generateTemporaryPassword(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Seeds the well-known first administrator when a deployment has no accounts at all.
 *
 * An empty `users` table is the condition, so a brand-new installation and one pointed at
 * a fresh or restored database both recover the same way without operator action. The
 * unique address settles races between concurrent callers: a losing insert means another
 * request seeded first, which is success from this function's point of view.
 *
 * The seeded account always requires a credential change, so a deployment is never left
 * reachable with the published password.
 */
export async function ensureFirstAdmin(
  db: DatabaseClient,
  identity: AdminIdentity = { email: DEFAULT_ADMIN_EMAIL, username: DEFAULT_ADMIN_USERNAME },
  initialPassword: string = DEFAULT_ADMIN_PASSWORD,
): Promise<AdminCredentialResult> {
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser !== undefined) {
    return { created: false, temporaryPassword: undefined };
  }

  const password = await hashPassword(initialPassword);

  try {
    return await db.transaction(async (transaction) => {
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
      return { created: true, temporaryPassword: initialPassword };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { created: false, temporaryPassword: undefined };
    }

    throw error;
  }
}

/** Recognises the conflict raised when a concurrent request seeded the account first. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { cause?: { code?: unknown }; code?: unknown }).code
    ?? (error as { cause?: { code?: unknown } }).cause?.code;
  return code === "23505";
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

/** Why a first-run credential change was rejected, without echoing the submitted values. */
export type AdminSetupRejection =
  | "already_completed"
  | "email_in_use"
  | "invalid_email"
  | "reused_default_password"
  | "weak_password";

/** Raised when first-run setup input cannot be accepted, carrying a machine-readable reason. */
export class AdminSetupError extends Error {
  /** Stable reason a caller maps to a localized message. */
  readonly reason: AdminSetupRejection;

  /** Creates a safe first-run setup rejection. */
  constructor(reason: AdminSetupRejection) {
    super("The initial administrator credentials were not accepted.");
    this.name = "AdminSetupError";
    this.reason = reason;
  }
}

/**
 * Replaces the first administrator's well-known credentials with operator-chosen ones.
 *
 * Only an account still flagged as requiring a change may be updated, so this cannot be
 * used to change an established administrator's address. Completing setup clears the flag
 * in the same transaction that writes the new credential, which is what lifts the
 * deployment out of its restricted first-run state.
 */
export async function completeInitialAdminSetup(
  db: DatabaseClient,
  input: { readonly email: string; readonly password: string; readonly userId: string },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!isValidAdminEmail(email)) {
    throw new AdminSetupError("invalid_email");
  }
  if (input.password === DEFAULT_ADMIN_PASSWORD) {
    throw new AdminSetupError("reused_default_password");
  }
  if (input.password.length < MINIMUM_ADMIN_PASSWORD_LENGTH) {
    throw new AdminSetupError("weak_password");
  }

  const password = await hashPassword(input.password);

  await db.transaction(async (transaction) => {
    const [pending] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.requiresPasswordChange, true)))
      .for("update")
      .limit(1);
    if (pending === undefined) {
      throw new AdminSetupError("already_completed");
    }

    const [conflicting] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (conflicting !== undefined && conflicting.id !== input.userId) {
      throw new AdminSetupError("email_in_use");
    }

    const updated = await transaction
      .update(accounts)
      .set({ password, updatedAt: new Date() })
      .where(and(eq(accounts.userId, input.userId), eq(accounts.providerId, "credential")))
      .returning({ id: accounts.id });
    if (updated.length === 0) {
      await transaction.insert(accounts).values({
        accountId: input.userId,
        password,
        providerId: "credential",
        userId: input.userId,
      });
    }

    await transaction
      .update(users)
      .set({ email, requiresPasswordChange: false, updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  });
}
