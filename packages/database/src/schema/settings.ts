import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Globally scoped, non-secret application settings. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
