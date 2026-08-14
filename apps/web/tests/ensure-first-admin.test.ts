import type { DatabaseClient } from "@pantaetl/database";
import { describe, expect, it } from "vitest";

import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureFirstAdmin } from "../src/auth/admin.js";

/** Records what a seeding attempt wrote, standing in for a deployment's account tables. */
interface SeedRecorder {
  readonly inserted: Record<string, unknown>[];
}

/**
 * Builds a database double holding a fixed number of existing accounts.
 *
 * A shared test database always has accounts in it, so the empty-deployment branch — the
 * one that actually seeds — can only be exercised against a stand-in.
 */
function createDatabaseDouble(existingUserCount: number, options: { readonly insertFails?: unknown } = {}): {
  readonly database: DatabaseClient;
  readonly recorder: SeedRecorder;
} {
  const recorder: SeedRecorder = { inserted: [] };
  const existingRows = Array.from({ length: existingUserCount }, (_unused, index) => ({ id: `existing-${index}` }));

  const transaction = {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        if (options.insertFails !== undefined) throw options.insertFails;
        recorder.inserted.push(values);
        return {
          returning: () => Promise.resolve([{ id: "seeded-administrator" }]),
          then: (resolve: (value: unknown) => unknown) => resolve(undefined),
        };
      },
    }),
  };

  const database = {
    select: () => ({ from: () => ({ limit: () => Promise.resolve(existingRows) }) }),
    transaction: (run: (tx: unknown) => Promise<unknown>) => run(transaction),
  } as unknown as DatabaseClient;

  return { database, recorder };
}

describe("first administrator seeding", () => {
  it("seeds the published first-run account for a deployment with no users", async () => {
    const { database, recorder } = createDatabaseDouble(0);

    await expect(ensureFirstAdmin(database)).resolves.toStrictEqual({
      created: true,
      temporaryPassword: DEFAULT_ADMIN_PASSWORD,
    });
    expect(recorder.inserted[0]).toMatchObject({
      email: DEFAULT_ADMIN_EMAIL,
      isAdmin: true,
      requiresPasswordChange: true,
      username: DEFAULT_ADMIN_USERNAME,
    });
  });

  it("stores a digest rather than the published password", async () => {
    const { database, recorder } = createDatabaseDouble(0);
    await ensureFirstAdmin(database);

    const credential = recorder.inserted[1];
    expect(credential?.password).toBeTypeOf("string");
    expect(credential?.password).not.toBe(DEFAULT_ADMIN_PASSWORD);
  });

  it("does nothing once a deployment has any account", async () => {
    const { database, recorder } = createDatabaseDouble(1);

    await expect(ensureFirstAdmin(database)).resolves.toStrictEqual({
      created: false,
      temporaryPassword: undefined,
    });
    expect(recorder.inserted).toHaveLength(0);
  });

  it("treats a concurrent seeding race as already handled", async () => {
    const { database } = createDatabaseDouble(0, { insertFails: Object.assign(new Error("duplicate key"), { code: "23505" }) });

    await expect(ensureFirstAdmin(database)).resolves.toStrictEqual({
      created: false,
      temporaryPassword: undefined,
    });
  });

  it("surfaces failures that are not a seeding race", async () => {
    const { database } = createDatabaseDouble(0, { insertFails: new Error("the database is unreachable") });

    await expect(ensureFirstAdmin(database)).rejects.toThrow("the database is unreachable");
  });
});
