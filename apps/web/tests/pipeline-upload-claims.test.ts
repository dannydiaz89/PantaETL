import type { Pipeline } from "@pantaetl/contracts";
import type { DatabaseClient } from "@pantaetl/database";
import { describe, expect, it, vi } from "vitest";

import { claimPipelineUploads } from "../src/uploads/pipeline-claims.js";

const ownerUserId = "123e4567-e89b-12d3-a456-426614174000";
const pipelineId = "323e4567-e89b-12d3-a456-426614174000";
const sourceId = "423e4567-e89b-12d3-a456-426614174000";
const exportId = "523e4567-e89b-12d3-a456-426614174000";

const { claimStagedUploads } = vi.hoisted(() => ({ claimStagedUploads: vi.fn() }));
vi.mock("@pantaetl/database", () => ({ claimStagedUploads }));

describe("pipeline upload claims", () => {
  it("releases the uploaded files a saved pipeline reads", async () => {
    claimStagedUploads.mockResolvedValueOnce(1);
    const database = {} as DatabaseClient;

    await claimPipelineUploads(database, ownerUserId, pipelineReading("uploads/staged-orders.csv"));

    expect(claimStagedUploads).toHaveBeenCalledWith(database, ownerUserId, [
      "imports/uploads/staged-orders.csv",
    ]);
  });

  it("leaves a hand-placed import alone, because nothing staged it", async () => {
    claimStagedUploads.mockClear();

    await claimPipelineUploads({} as DatabaseClient, ownerUserId, pipelineReading("reports/orders.csv"));

    expect(claimStagedUploads).not.toHaveBeenCalled();
  });

  it("keeps a saved pipeline saved when releasing the file fails", async () => {
    claimStagedUploads.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      claimPipelineUploads({} as DatabaseClient, ownerUserId, pipelineReading("uploads/staged-orders.csv")),
    ).resolves.toBeUndefined();
  });
});

/** Builds a saved pipeline whose source reads one path. */
function pipelineReading(sourcePath: string): Pipeline {
  return {
    contractVersion: "v1",
    createdAt: "2026-08-14T10:00:00.000Z",
    edges: [{ fromStepId: sourceId, toStepId: exportId }],
    id: pipelineId,
    name: "Orders sync",
    ownerUserId,
    state: "draft",
    steps: [
      {
        componentType: "source.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { hasHeader: true, sourcePath } },
        id: sourceId,
        kind: "source",
      },
      {
        componentType: "export.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { fileName: "orders.csv" } },
        id: exportId,
        kind: "export",
      },
    ],
    triggers: [],
    updatedAt: "2026-08-14T10:00:00.000Z",
  };
}
