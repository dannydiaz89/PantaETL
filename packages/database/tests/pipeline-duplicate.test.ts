import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../src/client.js";
import { duplicatePipeline } from "../src/pipelines/duplicate.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../src/schema/pipelines.js";

const ids = {
  copiedExport: "523e4567-e89b-12d3-a456-426614174011",
  copiedPipeline: "523e4567-e89b-12d3-a456-426614174012",
  copiedSource: "523e4567-e89b-12d3-a456-426614174013",
  copiedTrigger: "523e4567-e89b-12d3-a456-426614174014",
  export: "523e4567-e89b-12d3-a456-426614174003",
  manualTrigger: "523e4567-e89b-12d3-a456-426614174004",
  pipeline: "523e4567-e89b-12d3-a456-426614174001",
  scheduleTrigger: "523e4567-e89b-12d3-a456-426614174005",
  source: "523e4567-e89b-12d3-a456-426614174002",
  otherUser: "523e4567-e89b-12d3-a456-426614174007",
  user: "523e4567-e89b-12d3-a456-426614174006",
};
const now = new Date("2026-08-13T00:00:00.000Z");

describe("pipeline duplication operation", () => {
  it("creates a fresh draft graph for its owner without copying credential bindings", async () => {
    const database = createDatabaseDouble();
    const componentIds = [ids.copiedSource, ids.copiedExport];

    await expect(duplicatePipeline(database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
      name: "Daily orders copy",
    }, () => nextComponentId(componentIds))).resolves.toEqual(expect.objectContaining({
      id: ids.copiedPipeline,
      name: "Daily orders copy",
      ownerUserId: ids.user,
      state: "draft",
      steps: expect.arrayContaining([
        expect.objectContaining({
          configuration: {
            secretBindings: [],
            values: { endpoint: "https://example.test/orders" },
          },
          id: ids.copiedSource,
        }),
        expect.objectContaining({ id: ids.copiedExport }),
      ]),
      edges: [{ fromStepId: ids.copiedSource, toStepId: ids.copiedExport }],
    }));

    expect(database.valuesFor(pipelines)).toEqual([
      { contractVersion: "v1", name: "Daily orders copy", ownerUserId: ids.user, state: "draft" },
    ]);
    expect(database.valuesFor(pipelineComponents)).toEqual([
      expect.objectContaining({
        id: ids.copiedSource,
        pipelineId: ids.copiedPipeline,
        secretBindings: [],
      }),
      expect.objectContaining({ id: ids.copiedExport, pipelineId: ids.copiedPipeline }),
    ]);
    expect(database.valuesFor(pipelineEdges)).toEqual([
      { fromComponentId: ids.copiedSource, pipelineId: ids.copiedPipeline, toComponentId: ids.copiedExport },
    ]);
  });

  it("copies trigger definitions disabled and leaves their schedule runtime metadata uninitialized", async () => {
    const database = createDatabaseDouble();

    await duplicatePipeline(database, { ownerUserId: ids.user, pipelineId: ids.pipeline }, componentIdGenerator());

    expect(database.valuesFor(pipelineTriggers)).toEqual([
      { enabled: false, pipelineId: ids.copiedPipeline, type: "manual" },
      {
        cron: "0 9 * * *",
        enabled: false,
        pipelineId: ids.copiedPipeline,
        timezone: "UTC",
        type: "schedule",
      },
    ]);
    expect(database.valuesFor(pipelineTriggers)[1]).not.toHaveProperty("nextRunAt");
    expect(database.valuesFor(pipelineTriggers)[1]).not.toHaveProperty("lastClaimedAt");
  });

  it("does not duplicate a pipeline that belongs to another user", async () => {
    const database = createDatabaseDouble({ sourceVisible: false });

    await expect(duplicatePipeline(database, {
      ownerUserId: ids.otherUser,
      pipelineId: ids.pipeline,
    }, componentIdGenerator())).resolves.toBeUndefined();

    expect(database.transaction).not.toHaveBeenCalled();
    expect(database.valuesFor(pipelines)).toEqual([]);
  });
});

/** Return a deterministic sequence of fresh component identities for a copied graph. */
function componentIdGenerator(): () => string {
  const componentIds = [ids.copiedSource, ids.copiedExport];
  return () => nextComponentId(componentIds);
}

/** Return the next test component identifier and fail if the graph requests too many. */
function nextComponentId(componentIds: string[]): string {
  const componentId = componentIds.shift();
  if (!componentId) {
    throw new Error("No component identifier remains for the duplicated graph.");
  }

  return componentId;
}

/** Builds a database double that reads one source graph and records the copied graph writes. */
function createDatabaseDouble(options: { readonly sourceVisible?: boolean } = {}) {
  const valuesByTable = new Map<unknown, readonly Record<string, unknown>[]>();
  const sourceRecords = records();
  const copyRecords = copiedRecords();

  const database = {
    select() {
      return {
        from(table: unknown) {
          const selected = table === pipelines && options.sourceVisible === false
            ? []
            : sourceRecords.get(table) ?? [];
          return {
            where() {
              return {
                limit: async (limit: number) => selected.slice(0, limit),
                then: <Result>(resolve: (value: readonly Record<string, unknown>[]) => Result) => resolve(selected),
              };
            },
          };
        },
      };
    },
    transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback({
      insert(table: unknown) {
        return {
          values(values: Record<string, unknown> | readonly Record<string, unknown>[]) {
            const rows = Array.isArray(values) ? values : [values];
            valuesByTable.set(table, rows);
            return { returning: async () => copyRecords.get(table) ?? [] };
          },
        };
      },
    })),
  } as unknown as DatabaseClient & {
    readonly transaction: ReturnType<typeof vi.fn>;
    valuesFor(table: unknown): readonly Record<string, unknown>[];
  };

  return Object.assign(database, {
    valuesFor: (table: unknown) => valuesByTable.get(table) ?? [],
  });
}

/** Source records used by owner-scoped graph hydration. */
function records(): Map<unknown, readonly Record<string, unknown>[]> {
  return new Map([
    [pipelines, [{
      contractVersion: "v1",
      createdAt: now,
      id: ids.pipeline,
      name: "Daily orders",
      ownerUserId: ids.user,
      state: "enabled",
      updatedAt: now,
    }]],
    [pipelineComponents, [
      {
        componentType: "source.rest-api",
        componentVersion: "v1",
        configurationValues: { endpoint: "https://example.test/orders" },
        id: ids.source,
        kind: "source",
        pipelineId: ids.pipeline,
        secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configurationValues: { path: "orders.json" },
        id: ids.export,
        kind: "export",
        pipelineId: ids.pipeline,
        secretBindings: [],
      },
    ]],
    [pipelineEdges, [{ fromComponentId: ids.source, pipelineId: ids.pipeline, toComponentId: ids.export }]],
    [pipelineTriggers, [
      {
        createdAt: now,
        enabled: true,
        id: ids.manualTrigger,
        lastClaimedAt: null,
        nextRunAt: null,
        pipelineId: ids.pipeline,
        type: "manual",
        updatedAt: now,
      },
      {
        createdAt: now,
        cron: "0 9 * * *",
        enabled: true,
        id: ids.scheduleTrigger,
        lastClaimedAt: now,
        nextRunAt: now,
        pipelineId: ids.pipeline,
        timezone: "UTC",
        type: "schedule",
        updatedAt: now,
      },
    ]],
  ]);
}

/** Records returned by inserts for the new graph. */
function copiedRecords(): Map<unknown, readonly Record<string, unknown>[]> {
  return new Map([
    [pipelines, [{
      contractVersion: "v1",
      createdAt: now,
      id: ids.copiedPipeline,
      name: "Daily orders copy",
      ownerUserId: ids.user,
      state: "draft",
      updatedAt: now,
    }]],
    [pipelineComponents, [
      {
        componentType: "source.rest-api",
        componentVersion: "v1",
        configurationValues: { endpoint: "https://example.test/orders" },
        id: ids.copiedSource,
        kind: "source",
        pipelineId: ids.copiedPipeline,
        secretBindings: [],
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configurationValues: { path: "orders.json" },
        id: ids.copiedExport,
        kind: "export",
        pipelineId: ids.copiedPipeline,
        secretBindings: [],
      },
    ]],
    [pipelineEdges, [{
      fromComponentId: ids.copiedSource,
      pipelineId: ids.copiedPipeline,
      toComponentId: ids.copiedExport,
    }]],
    [pipelineTriggers, [
      {
        createdAt: now,
        enabled: false,
        id: ids.copiedTrigger,
        lastClaimedAt: null,
        nextRunAt: null,
        pipelineId: ids.copiedPipeline,
        type: "manual",
        updatedAt: now,
      },
      {
        createdAt: now,
        cron: "0 9 * * *",
        enabled: false,
        id: "523e4567-e89b-12d3-a456-426614174015",
        lastClaimedAt: null,
        nextRunAt: null,
        pipelineId: ids.copiedPipeline,
        timezone: "UTC",
        type: "schedule",
        updatedAt: now,
      },
    ]],
  ]);
}
