import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { accounts, createDatabaseConnection, sessions, users, verifications } from "@pantaetl/database";

import { loadAuthConfig } from "./config.js";

const config = loadAuthConfig();
const database = createDatabaseConnection(config.databaseUrl);

/** Shared database client for authenticated control-plane request handlers. */
export const controlPlaneDatabase = database.db;

/** Local password authentication and server-managed sessions for the control plane. */
export const auth = betterAuth({
  advanced: {
    database: {
      generateId: false,
    },
  },
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(controlPlaneDatabase, {
    provider: "pg",
    schema: {
      account: accounts,
      session: sessions,
      users,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    disableSignUp: true,
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
  secret: config.secret,
  trustedOrigins: [...config.trustedOrigins],
  user: {
    additionalFields: {
      isAdmin: { input: false, required: false, type: "boolean" },
      requiresPasswordChange: { input: false, required: false, type: "boolean" },
    },
    fields: {
      name: "username",
    },
    modelName: "users",
  },
});
