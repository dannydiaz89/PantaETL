import { describe, expect, it } from "vitest";

import { getPipelineExecutionState } from "../src/lib/pipeline-boundary.js";

describe("pipeline control-plane boundary", () => {
  it("uses the shared contract and pipeline state domain", () => {
    expect(
      getPipelineExecutionState({
        contractVersion: "v1",
        createdAt: "2026-08-13T00:00:00.000Z",
        edges: [],
        id: "123e4567-e89b-12d3-a456-426614174001",
        name: "daily-orders",
        ownerUserId: "123e4567-e89b-12d3-a456-426614174002",
        state: "enabled",
        steps: [{
          componentType: "csv-source",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: {} },
          id: "123e4567-e89b-12d3-a456-426614174003",
          kind: "source",
        }],
        triggers: [],
        updatedAt: "2026-08-13T00:00:00.000Z",
      }).pipelineState,
    ).toBe("enabled");
  });

  it("rejects unvalidated pipeline payloads", () => {
    expect(() => getPipelineExecutionState({ state: "enabled" })).toThrow();
  });

  it("carries a real active run into the shared execution domain state", () => {
    const pipeline = {
      contractVersion: "v1",
      createdAt: "2026-08-13T00:00:00.000Z",
      edges: [],
      id: "123e4567-e89b-12d3-a456-426614174001",
      name: "daily-orders",
      ownerUserId: "123e4567-e89b-12d3-a456-426614174002",
      state: "enabled",
      steps: [{
        componentType: "csv-source",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: {} },
        id: "123e4567-e89b-12d3-a456-426614174003",
        kind: "source",
      }],
      triggers: [],
      updatedAt: "2026-08-13T00:00:00.000Z",
    };

    expect(getPipelineExecutionState(pipeline).activeRun).toBeUndefined();
    expect(
      getPipelineExecutionState(pipeline, {
        activeRun: { id: "123e4567-e89b-12d3-a456-426614174010", state: "running" },
      }).activeRun,
    ).toStrictEqual({ cancellationRequested: false, id: "123e4567-e89b-12d3-a456-426614174010", state: "running" });
  });
});
