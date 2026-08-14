import { randomUUID } from "node:crypto";

import { accounts, createDatabaseConnection, users } from "@pantaetl/database";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  AdminSetupError,
  DEFAULT_ADMIN_PASSWORD,
  completeInitialAdminSetup,
  ensureFirstAdmin,
} from "../src/auth/admin.js";
import { createTestUser, deleteTestUser, TEST_DATABASE_URL } from "./test-session.js";

const connection = createDatabaseConnection(TEST_DATABASE_URL);
const database = connection.db;
const createdUserIds: string[] = [];

/**
 * Creates an account in the state a freshly seeded deployment leaves behind.
 *
 * Seeding through `ensureFirstAdmin` is not usable here because it deliberately only acts
 * on an empty deployment, which a shared test database never is.
 */
async function seedPendingAdmin(): Promise<{ readonly email: string; readonly id: string }> {
  const user = await createTestUser({ requiresPasswordChange: true });
  createdUserIds.push(user.id);
  return { email: user.email, id: user.id };
}

afterAll(async () => {
  for (const id of createdUserIds) {
    await deleteTestUser(id);
  }
  await connection.close();
});

describe("initial administrator setup", () => {
  let admin: { readonly email: string; readonly id: string };

  beforeEach(async () => {
    admin = await seedPendingAdmin();
  });

  it("leaves an existing deployment's accounts alone", async () => {
    // The shared database always holds accounts, which is exactly the no-op condition.
    await expect(ensureFirstAdmin(database)).resolves.toStrictEqual({
      created: false,
      temporaryPassword: undefined,
    });
  });

  it("replaces the installation address and password, lifting the restriction", async () => {
    const email = `chosen-${randomUUID()}@pantaetl.test`;
    const [before] = await database.select({ password: accounts.password }).from(accounts).where(eq(accounts.userId, admin.id)).limit(1);

    await completeInitialAdminSetup(database, { email, password: "a-genuinely-new-password", userId: admin.id });

    const [after] = await database
      .select({ email: users.email, requiresPasswordChange: users.requiresPasswordChange })
      .from(users)
      .where(eq(users.id, admin.id))
      .limit(1);
    const [credential] = await database.select({ password: accounts.password }).from(accounts).where(eq(accounts.userId, admin.id)).limit(1);

    expect(after).toStrictEqual({ email, requiresPasswordChange: false });
    expect(credential?.password).not.toBe(before?.password);
  });

  it("refuses to keep the installation password or a short one", async () => {
    await expect(completeInitialAdminSetup(database, {
      email: admin.email,
      password: DEFAULT_ADMIN_PASSWORD,
      userId: admin.id,
    })).rejects.toMatchObject({ reason: "reused_default_password" });

    await expect(completeInitialAdminSetup(database, {
      email: admin.email,
      password: "short",
      userId: admin.id,
    })).rejects.toBeInstanceOf(AdminSetupError);
  });

  it("cannot be replayed to change an administrator that already completed setup", async () => {
    await completeInitialAdminSetup(database, { email: admin.email, password: "a-genuinely-new-password", userId: admin.id });

    await expect(completeInitialAdminSetup(database, {
      email: `attacker-${randomUUID()}@pantaetl.test`,
      password: "another-new-password-entirely",
      userId: admin.id,
    })).rejects.toMatchObject({ reason: "already_completed" });
  });

  it("refuses an address that already belongs to someone else", async () => {
    const other = await database.insert(users).values({
      email: `existing-${randomUUID()}@pantaetl.test`,
      emailVerified: true,
      username: `existing-${randomUUID().slice(0, 8)}`,
    }).returning({ email: users.email, id: users.id });
    const existing = other[0];
    if (existing === undefined) throw new Error("The conflicting user was not persisted.");
    createdUserIds.push(existing.id);

    await expect(completeInitialAdminSetup(database, {
      email: existing.email,
      password: "a-genuinely-new-password",
      userId: admin.id,
    })).rejects.toMatchObject({ reason: "email_in_use" });
  });
});
