import { boolean, index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

/** User accounts, including the explicit administrator role. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    isAdmin: boolean("is_admin").default(false).notNull(),
    requiresPasswordChange: boolean("requires_password_change").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique").on(table.username),
  ],
);

/** Browser sessions issued for locally authenticated users. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("sessions_token_unique").on(table.token), index("sessions_user_id_index").on(table.userId)],
);

/** Password credentials and future identity providers bound to a user account. */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("accounts_user_id_index").on(table.userId)],
);

/** Short-lived tokens used by explicit password reset and verification flows. */
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("verifications_identifier_index").on(table.identifier)],
);

/**
 * Revocable bearer credentials owned by a control-plane user.
 *
 * The plaintext token is returned only when it is created. Authentication uses
 * its SHA-256 digest, while the owning user row remains the source of current
 * permissions.
 */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("api_tokens_owner_user_id_index").on(table.ownerUserId),
    uniqueIndex("api_tokens_token_hash_unique").on(table.tokenHash),
  ],
);

/** Database record containing token metadata and a non-reversible token digest. */
export type ApiToken = typeof apiTokens.$inferSelect;
