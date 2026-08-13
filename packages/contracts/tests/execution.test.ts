import { describe, expect, it } from "vitest";

import { jobSchema, runSchema } from "../src/execution/index.js";

const ids = {
  component: "123e4567-e89b-12d3-a456-426614174010",
  job: "123e4567-e89b-12d3-a456-426614174011",
  pipeline: "123e4567-e89b-12d3-a456-426614174012",
  run: "123e4567-e89b-12d3-a456-426614174013",
  step: "123e4567-e89b-12d3-a456-426614174014",
  worker: "123e4567-e89b-12d3-a456-426614174015",
};
const timestamp = "2026-08-13T01:00:00Z";

describe("queue jobs", () => {
  it("validates retry, claim, heartbeat, and cancellation metadata", () => {
    expect(
      jobSchema.safeParse({
        contractVersion: "v1",
        id: ids.job,
        pipelineId: ids.pipeline,
        runId: ids.run,
        stepId: ids.step,
        componentId: ids.component,
        state: "running",
        attempt: 1,
        retryPolicy: { maxAttempts: 3, retryDelaySeconds: 30 },
        availableAt: timestamp,
        claim: { workerId: ids.worker, claimedAt: timestamp, heartbeatAt: timestamp },
        cancellation: { requestedAt: timestamp },
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid retry policy", () => {
    expect(
      jobSchema.safeParse({
        contractVersion: "v1",
        id: ids.job,
        pipelineId: ids.pipeline,
        runId: ids.run,
        stepId: ids.step,
        componentId: ids.component,
        state: "queued",
        attempt: 0,
        retryPolicy: { maxAttempts: 0, retryDelaySeconds: 30 },
        availableAt: timestamp,
      }).success,
    ).toBe(false);
  });
});

describe("pipeline runs", () => {
  it("supports completed-with-warnings step and run results", () => {
    expect(
      runSchema.safeParse({
        contractVersion: "v1",
        id: ids.run,
        pipelineId: ids.pipeline,
        state: "completed_with_warnings",
        createdAt: timestamp,
        startedAt: timestamp,
        completedAt: "2026-08-13T01:01:00Z",
        warningCount: 1,
        steps: [
          {
            stepId: ids.step,
            componentId: ids.component,
            state: "completed_with_warnings",
            warningCount: 1,
            metrics: { recordsRead: 2, recordsWritten: 1 },
          },
        ],
      }).success,
    ).toBe(true);
  });
});
