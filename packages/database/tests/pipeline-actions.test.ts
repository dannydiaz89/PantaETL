import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../src/client.js";
import {
  PipelineActionConflictError,
  disablePipelineForOwner,
  enablePipelineForOwner,
  runPipelineForOwner,
} from "../src/pipelines/actions.js";

const ids = {
  pipeline: "123e4567-e89b-12d3-a456-426614174001",
  run: "123e4567-e89b-12d3-a456-426614174002",
  user: "123e4567-e89b-12d3-a456-426614174003",
};
const actionInput = { ownerUserId: ids.user, pipelineId: ids.pipeline };

describe("pipeline action service", () => {
  it("does not reveal or enqueue a pipeline that is outside the authenticated owner's scope", async () => {
    const database = actionDatabase([]);
    const enqueueRun = vi.fn();

    await expect(runPipelineForOwner(database, actionInput, enqueueRun)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "not_found",
    } satisfies Partial<PipelineActionConflictError>);
    expect(enqueueRun).not.toHaveBeenCalled();
  });

  it("rejects manual runs for a non-enabled pipeline before scheduling work", async () => {
    const database = actionDatabase([[{ state: "draft" }]]);
    const enqueueRun = vi.fn();

    await expect(runPipelineForOwner(database, actionInput, enqueueRun)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "not_enabled",
    } satisfies Partial<PipelineActionConflictError>);
    expect(enqueueRun).not.toHaveBeenCalled();
  });

  it("uses the supplied scheduler enqueue operation after owner and enabled-state checks", async () => {
    const database = actionDatabase([[{ state: "enabled" }]]);
    const enqueueRun = vi.fn().mockResolvedValue({
      initialJobCount: 1,
      pipelineId: ids.pipeline,
      queuedBehindActiveRun: false,
      runId: ids.run,
    });

    await expect(runPipelineForOwner(database, actionInput, enqueueRun)).resolves.toEqual({
      initialJobCount: 1,
      pipelineId: ids.pipeline,
      queuedBehindActiveRun: false,
      runId: ids.run,
    });
    expect(enqueueRun).toHaveBeenCalledWith(ids.pipeline);
  });

  it("maps a concurrent scheduler state conflict to a stable API-layer reason", async () => {
    const database = actionDatabase([[{ state: "enabled" }]]);
    const enqueueRun = vi.fn().mockRejectedValue({ reason: "not_enabled" });

    await expect(runPipelineForOwner(database, actionInput, enqueueRun)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "not_enabled",
    } satisfies Partial<PipelineActionConflictError>);
  });

  it("enables an idle owner-scoped pipeline and records its update time", async () => {
    const database = actionDatabase([[{ state: "draft" }], []]);
    const now = new Date("2026-08-13T12:00:00.000Z");

    await expect(enablePipelineForOwner(database, actionInput, now)).resolves.toEqual({
      pipelineId: ids.pipeline,
      state: "enabled",
    });
    expect(database.update).toHaveBeenCalledTimes(1);
    expect(database.set).toHaveBeenCalledWith({ state: "enabled", updatedAt: now });
  });

  it("rejects a state action while any queued or running work exists", async () => {
    const database = actionDatabase([[{ state: "enabled" }], [{ id: ids.run, state: "queued" }]]);

    await expect(disablePipelineForOwner(database, actionInput)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "locked",
    } satisfies Partial<PipelineActionConflictError>);
    expect(database.update).not.toHaveBeenCalled();
  });
});

/** Builds a typed database double from the ordered select results used by one action. */
function actionDatabase(selectResults: readonly unknown[]): DatabaseClient & {
  readonly set: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
} {
  const remainingResults = [...selectResults];
  const set = vi.fn(() => ({ where: async () => undefined }));
  const update = vi.fn(() => ({ set }));
  const select = vi.fn(() => selection(remainingResults.shift() ?? []));
  const transaction = vi.fn(async (operation: (transaction: DatabaseClient) => Promise<unknown>) => (
    operation({ select, update } as unknown as DatabaseClient)
  ));

  return { select, set, transaction, update } as unknown as DatabaseClient & {
    readonly set: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
  };
}

/** Mimics the small Drizzle selection chain the action service uses. */
function selection(rows: unknown): {
  from(): {
    where(): {
      for(): { limit(): Promise<unknown> };
      limit(): Promise<unknown>;
    };
  };
} {
  return {
    from: () => ({
      where: () => ({
        for: () => ({ limit: async () => rows }),
        limit: async () => rows,
      }),
    }),
  };
}
