import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { jobs } from "../src/schema/execution.js";

describe("job queue schema", () => {
  it("tracks the state needed for worker claims and heartbeats", () => {
    expect(jobs.availableAt.notNull).toBe(true);
    expect(jobs.attempt.notNull).toBe(true);
    expect(jobs.workerId.notNull).toBe(false);
    expect(jobs.claimedAt.notNull).toBe(false);
    expect(jobs.heartbeatAt.notNull).toBe(false);
  });

  it("indexes queued jobs by availability for worker claims", () => {
    const eligibleWorkIndex = getTableConfig(jobs).indexes.find(
      (index) => index.config.name === "jobs_eligible_work_index",
    );

    expect(eligibleWorkIndex).toBeDefined();
    expect(eligibleWorkIndex?.config.where?.queryChunks).toBeDefined();
  });
});
