import { eq } from "drizzle-orm";

import type { DatabaseClient } from "./client.js";
import { settings } from "./schema/settings.js";

/** The default global retention period for run history and safe operational logs. */
export const DEFAULT_RUN_LOG_RETENTION_DAYS = 365;

/** The sole settings key governing future run and log expiry timestamps. */
export const RUN_LOG_RETENTION_DAYS_SETTING = "retention.run_log_days";

/**
 * Reads the globally configured run/log retention period, falling back to one year.
 *
 * Invalid stored settings fail explicitly instead of silently shortening or extending
 * historical retention.
 */
export async function getRunLogRetentionDays(db: DatabaseClient): Promise<number> {
  const [setting] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, RUN_LOG_RETENTION_DAYS_SETTING))
    .limit(1);

  return resolveRunLogRetentionDays(setting?.value);
}

/** Stores the global period used when assigning expiry metadata to future runs and logs. */
export async function setRunLogRetentionDays(db: DatabaseClient, days: number): Promise<void> {
  const retentionDays = resolveRunLogRetentionDays(days);
  await db
    .insert(settings)
    .values({ key: RUN_LOG_RETENTION_DAYS_SETTING, value: retentionDays, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: retentionDays, updatedAt: new Date() },
    });
}

/** Validates a configured retention value or supplies the documented one-year default. */
export function resolveRunLogRetentionDays(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_RUN_LOG_RETENTION_DAYS;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("Run and log retention days must be a positive integer.");
  }

  return value;
}

/** Calculates the explicit expiry timestamp persisted for a future run or run log. */
export function calculateRunLogExpiry(createdAt: Date, retentionDays: number): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + resolveRunLogRetentionDays(retentionDays));
  return expiresAt;
}
