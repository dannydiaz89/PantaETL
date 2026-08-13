import { describe, expect, it } from "vitest";

import { parseSystemHealth } from "../src/components/system-workspace.js";
import { parseRunLogRetentionUpdate } from "../src/system/settings.js";

describe("system and settings UI boundaries", () => {
  it("renders only safe application health fields from the health API", () => {
    const health = parseSystemHealth({
      checkedAt: "2026-08-13T12:00:00.000Z",
      database: { status: "healthy" },
      garbageCollector: { status: "healthy" },
      host: "not-rendered",
      queue: { queuedJobs: 4, runningJobs: 2, status: "healthy" },
      scheduler: { status: "healthy" },
      status: "healthy",
      storage: { status: "healthy" },
      workers: { status: "healthy" },
    });

    expect(health.queue).toEqual({ queuedJobs: 4, runningJobs: 2, status: "healthy" });
    expect(JSON.stringify(health)).not.toMatch(/host|container|cpu|memory|disk/i);
  });

  it("rejects malformed health states and non-safe queue totals", () => {
    expect(() => parseSystemHealth({})).toThrow();
    expect(() => parseSystemHealth({
      checkedAt: "2026-08-13T12:00:00.000Z",
      database: { status: "healthy" },
      garbageCollector: { status: "healthy" },
      queue: { queuedJobs: -1, status: "healthy" },
      scheduler: { status: "healthy" },
      status: "healthy",
      storage: { status: "healthy" },
      workers: { status: "healthy" },
    })).not.toThrow();
  });

  it("uses the database retention validator for global settings updates", () => {
    expect(parseRunLogRetentionUpdate({ runLogRetentionDays: 90 })).toEqual({ runLogRetentionDays: 90 });
    expect(() => parseRunLogRetentionUpdate({ runLogRetentionDays: 0 })).toThrow();
    expect(() => parseRunLogRetentionUpdate(null)).toThrow();
  });
});
