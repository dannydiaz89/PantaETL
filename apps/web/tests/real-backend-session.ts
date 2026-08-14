import { randomBytes, randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import {
  accounts,
  createDatabaseConnection,
  pipelines,
  sessions,
  users,
  verifications,
  type DatabaseClient,
} from "@pantaetl/database";
import type { Browser, BrowserContext } from "@playwright/test";

/** Matches the fixed local Postgres credentials the Playwright web server also connects with. */
const DATABASE_URL = "postgresql://pantaetl:pantaetl-dev@127.0.0.1:5432/pantaetl";
/** Matches the fixed auth secret the Playwright web server is launched with. */
const AUTH_SECRET = "accessibility-test-secret-not-for-production";

/** One throwaway signed-in owner, backed by a real database row, for a real-backend browser test. */
export interface RealBackendSession {
  readonly context: BrowserContext;
  /** Deletes this session's pipelines and user row; call once the test is done with the context. */
  readonly cleanup: () => Promise<void>;
  readonly ownerUserId: string;
}

/**
 * Creates a throwaway local user directly in the database, signs it in through the real
 * authentication library to obtain a genuine session cookie, and returns a browser context
 * carrying that cookie — without a human ever typing a password into a form.
 */
export async function createRealBackendSession(browser: Browser, baseUrl: string): Promise<RealBackendSession> {
  const connection = createDatabaseConnection(DATABASE_URL);
  const db: DatabaseClient = connection.db;
  const auth = betterAuth({
    advanced: { database: { generateId: false } },
    baseURL: baseUrl,
    database: drizzleAdapter(db, {
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

  const email = `e2e-${randomUUID()}@pantaetl.test`;
  const temporaryPassword = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);

  const [user] = await db.insert(users).values({
    email,
    emailVerified: true,
    username: `e2e-${randomUUID().slice(0, 8)}`,
  }).returning({ id: users.id });
  if (user === undefined) {
    throw new Error("Real-backend test session setup did not return a user.");
  }
  await db.insert(accounts).values({
    accountId: user.id,
    password: passwordHash,
    providerId: "credential",
    userId: user.id,
  });

  const signInResponse = await auth.api.signInEmail({ asResponse: true, body: { email, password: temporaryPassword } });
  const cookies = signInResponse.headers.getSetCookie().map((cookieHeader) => {
    const [nameValue] = cookieHeader.split(";");
    const separatorIndex = nameValue?.indexOf("=") ?? -1;
    if (nameValue === undefined || separatorIndex === -1) {
      throw new Error(`Could not parse a session cookie from the real-backend sign-in response: ${cookieHeader}`);
    }
    return { name: nameValue.slice(0, separatorIndex), url: baseUrl, value: nameValue.slice(separatorIndex + 1) };
  });
  if (cookies.length === 0) {
    throw new Error("Real-backend sign-in did not return a session cookie.");
  }

  const context = await browser.newContext();
  await context.addCookies(cookies);

  return {
    context,
    cleanup: async () => {
      await db.delete(pipelines).where(eq(pipelines.ownerUserId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
      await connection.close();
    },
    ownerUserId: user.id,
  };
}
