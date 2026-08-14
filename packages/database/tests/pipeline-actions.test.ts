import { describe, expect, it, vi } from "vitest";

import type { ComponentMetadata } from "@pantaetl/contracts";

import type { DatabaseClient } from "../src/client.js";
import {
  PipelineActionConflictError,
  disablePipelineForOwner,
  enablePipelineForOwner,
  runPipelineForOwner,
} from "../src/pipelines/actions.js";

const ids = {
  export: "123e4567-e89b-12d3-a456-426614174001",
  pipeline: "123e4567-e89b-12d3-a456-426614174004",
  run: "123e4567-e89b-12d3-a456-426614174002",
  source: "123e4567-e89b-12d3-a456-426614174006",
  user: "123e4567-e89b-12d3-a456-426614174003",
};
const actionInput = { ownerUserId: ids.user, pipelineId: ids.pipeline };

/** Component catalog used by executable-validation tests: a Source that requires a bound secret and an unconstrained Export. */
const catalog: readonly ComponentMetadata[] = [
  {
    configFields: [
      { key: "apiKey", labelKey: "source.csv.apiKey.label", required: true, secret: true, type: "text" },
    ],
    descriptionKey: "source.csv.description",
    displayNameKey: "source.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["any"],
    type: "source.csv",
    version: "v1",
  },
  {
    configFields: [],
    descriptionKey: "export.json.description",
    displayNameKey: "export.json.name",
    inputFamilies: ["any"],
    kind: "export",
    outputFamilies: [],
    type: "export.json",
    version: "v1",
  },
];

const sourceComponentRow = {
  componentType: "source.csv",
  componentVersion: "v1",
  configurationValues: {},
  id: ids.source,
  kind: "source" as const,
  pipelineId: ids.pipeline,
  secretBindings: [{ binding: "SOURCE_API_KEY", key: "apiKey" }],
};

const exportComponentRow = {
  componentType: "export.json",
  componentVersion: "v1",
  configurationValues: {},
  id: ids.export,
  kind: "export" as const,
  pipelineId: ids.pipeline,
  secretBindings: [],
};

const edgeRow = { fromComponentId: ids.source, pipelineId: ids.pipeline, toComponentId: ids.export };

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

  it("enables a complete, compatible, fully-configured pipeline with a satisfied secret binding", async () => {
    const database = actionDatabase([
      [{ state: "draft" }],
      [],
      [sourceComponentRow, exportComponentRow],
      [edgeRow],
    ]);
    const now = new Date("2026-08-13T12:00:00.000Z");

    await expect(enablePipelineForOwner(database, actionInput, catalog, now)).resolves.toEqual({
      pipelineId: ids.pipeline,
      state: "enabled",
    });
    expect(database.update).toHaveBeenCalledTimes(1);
    expect(database.set).toHaveBeenCalledWith({ state: "enabled", updatedAt: now });
  });

  it("rejects enabling an incomplete pipeline that has no Export step", async () => {
    const database = actionDatabase([[{ state: "draft" }], [], [sourceComponentRow], []]);

    await expect(enablePipelineForOwner(database, actionInput, catalog)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "not_executable",
      violations: [{ kind: "missing-export" }],
    } satisfies Partial<PipelineActionConflictError>);
    expect(database.update).not.toHaveBeenCalled();
  });

  it("rejects enabling a pipeline that uses a component outside the available catalog", async () => {
    const database = actionDatabase([
      [{ state: "draft" }],
      [],
      [sourceComponentRow, exportComponentRow],
      [edgeRow],
    ]);

    const error = await enablePipelineForOwner(database, actionInput, []).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PipelineActionConflictError);
    expect((error as PipelineActionConflictError).reason).toBe("not_executable");
    expect((error as PipelineActionConflictError).violations).toContainEqual({
      kind: "unavailable-component",
      stepId: ids.source,
      componentType: "source.csv",
      componentVersion: "v1",
    });
    expect(database.update).not.toHaveBeenCalled();
  });

  it("rejects enabling a pipeline with a missing required secret binding", async () => {
    const unboundSourceRow = { ...sourceComponentRow, secretBindings: [] };
    const database = actionDatabase([
      [{ state: "draft" }],
      [],
      [unboundSourceRow, exportComponentRow],
      [edgeRow],
    ]);

    await expect(enablePipelineForOwner(database, actionInput, catalog)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "not_executable",
      violations: [{ kind: "missing-secret-binding", stepId: ids.source, configKey: "apiKey" }],
    } satisfies Partial<PipelineActionConflictError>);
    expect(database.update).not.toHaveBeenCalled();
  });

  it("rejects a state action while any queued or running work exists", async () => {
    const database = actionDatabase([[{ state: "enabled" }], [{ id: ids.run, state: "queued" }]]);

    await expect(disablePipelineForOwner(database, actionInput)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "locked",
    } satisfies Partial<PipelineActionConflictError>);
    expect(database.update).not.toHaveBeenCalled();
  });

  it("disables a pipeline without running executable validation on an incomplete graph", async () => {
    const database = actionDatabase([[{ state: "enabled" }], []]);
    const now = new Date("2026-08-13T12:00:00.000Z");

    await expect(disablePipelineForOwner(database, actionInput, now)).resolves.toEqual({
      pipelineId: ids.pipeline,
      state: "disabled",
    });
    expect(database.select).toHaveBeenCalledTimes(2);
    expect(database.set).toHaveBeenCalledWith({ state: "disabled", updatedAt: now });
  });
});

/** Builds a typed database double from the ordered select results used by one action. */
function actionDatabase(selectResults: readonly unknown[]): DatabaseClient & {
  readonly select: ReturnType<typeof vi.fn>;
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
    readonly select: ReturnType<typeof vi.fn>;
    readonly set: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
  };
}

/** Mimics the small Drizzle selection chain the action service uses, including plain `await`-ed reads. */
function selection(rows: unknown): {
  from(): {
    where(): {
      for(): { limit(): Promise<unknown> };
      limit(): Promise<unknown>;
      then(resolve: (value: unknown) => void): void;
    };
  };
} {
  return {
    from: () => ({
      where: () => ({
        for: () => ({ limit: async () => rows }),
        limit: async () => rows,
        then: (resolve: (value: unknown) => void) => resolve(rows),
      }),
    }),
  };
}
