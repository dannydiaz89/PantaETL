import { describe, expect, it } from "vitest";

import { SchedulerRuntime } from "../src/runtime.js";

describe("SchedulerRuntime", () => {
  it("reports a missing pipeline without scheduling work", async () => {
    const runtime = new SchedulerRuntime(
      { close: async () => undefined, db: {}, sql: async () => [] } as never,
      { findState: async () => undefined },
    );

    await expect(runtime.getPipelineSchedulingStatus("pipeline-1")).resolves.toEqual({
      pipelineId: "pipeline-1",
      eligibility: "missing",
    });
  });

  it("reports database readiness without changing execution state", async () => {
    const runtime = new SchedulerRuntime(
      { close: async () => undefined, db: {}, sql: async () => [] } as never,
      { findState: async () => "enabled" },
    );

    await expect(runtime.getHealth()).resolves.toEqual({ status: "ok" });
    await expect(runtime.getPipelineSchedulingStatus("pipeline-1")).resolves.toEqual({
      pipelineId: "pipeline-1",
      eligibility: "eligible",
    });
  });

  it("does not treat an unreachable database as healthy", async () => {
    const runtime = new SchedulerRuntime(
      { close: async () => undefined, db: {}, sql: async () => { throw new Error("offline"); } } as never,
      { findState: async () => "enabled" },
    );

    await expect(runtime.getHealth()).resolves.toEqual({ status: "unavailable" });
  });
});
