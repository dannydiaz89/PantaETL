import { randomBytes, randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import {
  accounts,
  createDatabaseConnection,
  jobs,
  operationalEvents,
  pipelines,
  runs,
  runSteps,
  sessions,
  users,
  verifications,
} from "@pantaetl/database";

/** Matches the fixed local Postgres credentials the Playwright web server also connects with. */
export const TEST_DATABASE_URL = "postgresql://pantaetl:pantaetl-dev@127.0.0.1:5432/pantaetl";
/** Matches the fixed auth secret the Playwright web server is launched with. */
const AUTH_SECRET = "accessibility-test-secret-not-for-production";

/** One throwaway local account usable for signing a browser context in. */
export interface TestUser {
  readonly email: string;
  readonly id: string;
  readonly password: string;
}

/** A name/value/url triple accepted by Playwright's cookie APIs. */
export interface TestCookieShape {
  readonly name: string;
  readonly url: string;
  readonly value: string;
}

/** Builds an authentication instance matching the deployment's own configuration. */
function createAuth(database: ReturnType<typeof createDatabaseConnection>["db"], baseUrl: string) {
  return betterAuth({
    advanced: { database: { generateId: false } },
    baseURL: baseUrl,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: { account: accounts, session: sessions, users, verification: verifications },
    }),
    emailAndPassword: { disableSignUp: true, enabled: true },
    secret: AUTH_SECRET,
    trustedOrigins: [baseUrl],
    user: {
      additionalFields: {
        isAdmin: { input: false, required: false, type: "boolean" },
        requiresPasswordChange: { input: false, required: false, type: "boolean" },
      },
      fields: { name: "username" },
      modelName: "users",
    },
  });
}

/**
 * Creates a throwaway local user directly in the database.
 *
 * Writing the credential record directly keeps a real password out of the browser and
 * out of any form, while still producing an account the real authentication library
 * will accept.
 */
export async function createTestUser(): Promise<TestUser> {
  const connection = createDatabaseConnection(TEST_DATABASE_URL);
  try {
    const email = `e2e-${randomUUID()}@pantaetl.test`;
    const password = randomBytes(24).toString("base64url");
    const [user] = await connection.db.insert(users).values({
      email,
      emailVerified: true,
      username: `e2e-${randomUUID().slice(0, 8)}`,
    }).returning({ id: users.id });
    if (user === undefined) {
      throw new Error("Test user setup did not return a user.");
    }

    await connection.db.insert(accounts).values({
      accountId: user.id,
      password: await hashPassword(password),
      providerId: "credential",
      userId: user.id,
    });

    return { email, id: user.id, password };
  } finally {
    await connection.close();
  }
}

/** Signs a test user in through the real authentication library and returns its session cookies. */
export async function createSessionCookies(user: TestUser, baseUrl: string): Promise<readonly TestCookieShape[]> {
  const connection = createDatabaseConnection(TEST_DATABASE_URL);
  try {
    const auth = createAuth(connection.db, baseUrl);
    const response = await auth.api.signInEmail({
      asResponse: true,
      body: { email: user.email, password: user.password },
    });

    const cookies = response.headers.getSetCookie().map((cookieHeader) => {
      const [nameValue] = cookieHeader.split(";");
      const separatorIndex = nameValue?.indexOf("=") ?? -1;
      if (nameValue === undefined || separatorIndex === -1) {
        throw new Error(`Could not parse a session cookie from the sign-in response: ${cookieHeader}`);
      }

      return { name: nameValue.slice(0, separatorIndex), url: baseUrl, value: nameValue.slice(separatorIndex + 1) };
    });
    if (cookies.length === 0) {
      throw new Error("Sign-in did not return a session cookie.");
    }

    return cookies;
  } finally {
    await connection.close();
  }
}

/** Deletes a test user along with every record that references it, respecting retention constraints. */
export async function deleteTestUser(userId: string): Promise<void> {
  const connection = createDatabaseConnection(TEST_DATABASE_URL);
  try {
    const database = connection.db;
    const ownedPipelines = await database.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.ownerUserId, userId));
    const ownedPipelineIds = ownedPipelines.map((pipeline) => pipeline.id);

    if (ownedPipelineIds.length > 0) {
      const ownedRuns = await database.select({ id: runs.id }).from(runs).where(inArray(runs.pipelineId, ownedPipelineIds));
      const ownedRunIds = ownedRuns.map((run) => run.id);

      await database.delete(operationalEvents).where(inArray(operationalEvents.pipelineId, ownedPipelineIds));
      await database.delete(jobs).where(inArray(jobs.pipelineId, ownedPipelineIds));
      if (ownedRunIds.length > 0) {
        await database.delete(runSteps).where(inArray(runSteps.runId, ownedRunIds));
      }
      await database.delete(runs).where(inArray(runs.pipelineId, ownedPipelineIds));
    }

    await database.delete(pipelines).where(eq(pipelines.ownerUserId, userId));
    await database.delete(users).where(eq(users.id, userId));
  } finally {
    await connection.close();
  }
}
