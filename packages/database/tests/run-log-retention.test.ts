import { describe, expect, it, vi } from "vitest";

import {
  calculateRunLogExpiry,
  DEFAULT_RUN_LOG_RETENTION_DAYS,
  getRunLogRetentionDays,
  resolveRunLogRetentionDays,
  setRunLogRetentionDays,
} from "../src/run-log-retention.js";
import type { DatabaseClient } from "../src/client.js";

describe("run and log retention settings", () => {
  it("uses a one-year default when no global value exists", () => {
    expect(resolveRunLogRetentionDays(undefined)).toBe(DEFAULT_RUN_LOG_RETENTION_DAYS);
  });

  it("accepts a positive global retention setting and rejects invalid values", () => {
    expect(resolveRunLogRetentionDays(90)).toBe(90);
    expect(() => resolveRunLogRetentionDays(0)).toThrow("positive integer");
    expect(() => resolveRunLogRetentionDays("90")).toThrow("positive integer");
  });

  it("calculates explicit expiry timestamps from the configured global period", () => {
    expect(calculateRunLogExpiry(new Date("2026-08-13T00:00:00.000Z"), 90).toISOString()).toBe(
      "2026-11-11T00:00:00.000Z",
    );
  });

  it("reads a configured global value and persists an explicit replacement", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const database = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ value: 90 }]) })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ onConflictDoUpdate: update })),
      })),
    } as unknown as DatabaseClient;

    await expect(getRunLogRetentionDays(database)).resolves.toBe(90);
    await setRunLogRetentionDays(database, 120);
    expect(update).toHaveBeenCalledOnce();
  });
});
