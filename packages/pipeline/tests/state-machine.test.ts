import { describe, expect, it } from "vitest";

import {
  completeActiveRun,
  createPipelineExecutionState,
  enqueuePipelineRun,
  isPipelineEditable,
  PipelineStateTransitionError,
  requestActiveRunCancellation,
  setPipelineState,
  startActiveRun,
} from "../src/index.js";

describe("pipeline execution state", () => {
  it("locks configuration while queued or active work exists", () => {
    const queued = enqueuePipelineRun(createPipelineExecutionState("enabled"), "run-1");

    expect(isPipelineEditable(queued)).toBe(false);
    expect(isPipelineEditable(createPipelineExecutionState("enabled"))).toBe(true);
    expect(() => setPipelineState(queued, "disabled")).toThrow(PipelineStateTransitionError);
    expect(setPipelineState(createPipelineExecutionState("enabled"), "disabled").pipelineState).toBe(
      "disabled",
    );
  });

  it("serializes same-pipeline runs in first-in, first-out order", () => {
    const queued = enqueuePipelineRun(
      enqueuePipelineRun(createPipelineExecutionState("enabled"), "run-1"),
      "run-2",
    );
    const running = startActiveRun(queued);
    const advanced = completeActiveRun(running, "succeeded");

    expect(running.activeRun).toMatchObject({ id: "run-1", state: "running" });
    expect(queued.queuedRunIds).toEqual(["run-2"]);
    expect(advanced.activeRun).toMatchObject({ id: "run-2", state: "queued" });
    expect(advanced.queuedRunIds).toEqual([]);
  });

  it("rejects invalid execution transitions", () => {
    const idle = createPipelineExecutionState("enabled");
    const running = startActiveRun(enqueuePipelineRun(idle, "run-1"));

    expect(() => startActiveRun(running)).toThrow(PipelineStateTransitionError);
    expect(() => enqueuePipelineRun(running, "run-1")).toThrow(PipelineStateTransitionError);
    expect(() => completeActiveRun(idle, "succeeded")).toThrow(PipelineStateTransitionError);
  });

  it("keeps cancellation locked until a terminal cancellation result advances the queue", () => {
    const running = startActiveRun(
      enqueuePipelineRun(
        enqueuePipelineRun(createPipelineExecutionState("enabled"), "run-1"),
        "run-2",
      ),
    );
    const cancellationRequested = requestActiveRunCancellation(running);

    expect(cancellationRequested.activeRun).toMatchObject({
      id: "run-1",
      state: "running",
      cancellationRequested: true,
    });
    expect(() => requestActiveRunCancellation(cancellationRequested)).toThrow(
      PipelineStateTransitionError,
    );
    expect(completeActiveRun(cancellationRequested, "cancelled").activeRun).toMatchObject({
      id: "run-2",
      state: "queued",
      cancellationRequested: false,
    });
  });
});
