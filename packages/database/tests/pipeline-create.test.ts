import type { PipelineCreateRequest } from "@pantaetl/contracts";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../src/client.js";
import { createPipeline, InvalidPipelineTopologyError } from "../src/pipelines/create.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../src/schema/pipelines.js";

const ids = {
  export: "223e4567-e89b-12d3-a456-426614174003",
  pipeline: "223e4567-e89b-12d3-a456-426614174001",
  source: "223e4567-e89b-12d3-a456-426614174002",
  trigger: "223e4567-e89b-12d3-a456-426614174004",
  user: "223e4567-e89b-12d3-a456-426614174005",
};
const now = new Date("2026-08-13T00:00:00.000Z");

describe("pipeline repository create operation", () => {
  it("creates the pipeline graph atomically for the authenticated owner and returns its canonical shape", async () => {
    const database = createDatabaseDouble();

    await expect(createPipeline(database, { ownerUserId: ids.user, pipeline: createRequest() })).resolves.toEqual({
      contractVersion: "v1",
      createdAt: now.toISOString(),
      edges: [{ fromStepId: ids.source, toStepId: ids.export }],
      id: ids.pipeline,
      name: "Daily orders",
      ownerUserId: ids.user,
      state: "draft",
      steps: [
        {
          componentType: "source.rest-api",
          componentVersion: "v1",
          configuration: {
            secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
            values: { endpoint: "https://example.test/orders" },
          },
          id: ids.source,
          kind: "source",
        },
        {
          componentType: "export.json",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: { path: "orders.json" } },
          id: ids.export,
          kind: "export",
        },
      ],
      triggers: [{ enabled: true, id: ids.trigger, pipelineId: ids.pipeline, type: "manual" }],
      updatedAt: now.toISOString(),
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(database.valuesFor(pipelines)).toEqual([
      { contractVersion: "v1", name: "Daily orders", ownerUserId: ids.user, state: "draft" },
    ]);
    expect(database.valuesFor(pipelineComponents)).toEqual([
      expect.objectContaining({
        configurationValues: { endpoint: "https://example.test/orders" },
        id: ids.source,
        pipelineId: ids.pipeline,
        secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
      }),
      expect.objectContaining({ id: ids.export, pipelineId: ids.pipeline }),
    ]);
    expect(database.valuesFor(pipelineEdges)).toEqual([
      { fromComponentId: ids.source, pipelineId: ids.pipeline, toComponentId: ids.export },
    ]);
    expect(database.valuesFor(pipelineTriggers)).toEqual([
      { enabled: true, pipelineId: ids.pipeline, type: "manual" },
    ]);
  });

  it("rejects usable secret values before opening a write transaction", async () => {
    const database = createDatabaseDouble();
    const request = createRequest();
    const unsafeRequest = {
      ...request,
      steps: request.steps.map((step) => (
        step.id === ids.source
          ? { ...step, configuration: { ...step.configuration, values: { apiToken: "usable-secret" } } }
          : step
      )),
    } as PipelineCreateRequest;

    await expect(createPipeline(database, { ownerUserId: ids.user, pipeline: unsafeRequest })).rejects.toThrow();
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("rejects a graph that does not connect every component from a Source to an Export", async () => {
    const database = createDatabaseDouble();
    const request = createRequest();
    const disconnectedRequest = {
      ...request,
      steps: [
        ...request.steps,
        {
          componentType: "transform.normalize",
          componentVersion: "v1",
          configuration: { secretBindings: [], values: {} },
          id: "223e4567-e89b-12d3-a456-426614174006",
          kind: "transform" as const,
        },
      ],
    } as PipelineCreateRequest;

    await expect(createPipeline(database, { ownerUserId: ids.user, pipeline: disconnectedRequest })).rejects.toBeInstanceOf(
      InvalidPipelineTopologyError,
    );
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("propagates a write failure from the transaction so PostgreSQL rolls back the partial graph", async () => {
    const database = createDatabaseDouble({ failOn: pipelineComponents });

    await expect(createPipeline(database, { ownerUserId: ids.user, pipeline: createRequest() })).rejects.toThrow(
      "component insert failed",
    );
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(database.valuesFor(pipelines)).toHaveLength(1);
    expect(database.valuesFor(pipelineComponents)).toHaveLength(2);
    expect(database.valuesFor(pipelineEdges)).toHaveLength(0);
    expect(database.valuesFor(pipelineTriggers)).toHaveLength(0);
  });
});

/** Build a complete contract-valid graph with configuration values and secret references separated. */
function createRequest(): PipelineCreateRequest {
  return {
    contractVersion: "v1",
    edges: [{ fromStepId: ids.source, toStepId: ids.export }],
    name: "Daily orders",
    steps: [
      {
        componentType: "source.rest-api",
        componentVersion: "v1",
        configuration: {
          secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
          values: { endpoint: "https://example.test/orders" },
        },
        id: ids.source,
        kind: "source",
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: "orders.json" } },
        id: ids.export,
        kind: "export",
      },
    ],
    triggers: [{ enabled: true, type: "manual" }],
  };
}

interface DatabaseDoubleOptions {
  readonly failOn?: unknown;
}

/** Builds a transaction double that records graph writes in table order. */
function createDatabaseDouble(options: DatabaseDoubleOptions = {}) {
  const valuesByTable = new Map<unknown, readonly unknown[]>();
  const persistedRecords = new Map<unknown, unknown>([
    [pipelines, [{
      contractVersion: "v1",
      createdAt: now,
      id: ids.pipeline,
      name: "Daily orders",
      ownerUserId: ids.user,
      state: "draft",
      updatedAt: now,
    }]],
    [pipelineComponents, [
      {
        componentType: "source.rest-api",
        componentVersion: "v1",
        configurationValues: { endpoint: "https://example.test/orders" },
        id: ids.source,
        kind: "source" as const,
        pipelineId: ids.pipeline,
        secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configurationValues: { path: "orders.json" },
        id: ids.export,
        kind: "export" as const,
        pipelineId: ids.pipeline,
        secretBindings: [],
      },
    ]],
    [pipelineEdges, [
      { fromComponentId: ids.source, pipelineId: ids.pipeline, toComponentId: ids.export },
    ]],
    [pipelineTriggers, [
      {
        createdAt: now,
        enabled: true,
        id: ids.trigger,
        lastClaimedAt: null,
        nextRunAt: null,
        pipelineId: ids.pipeline,
        type: "manual" as const,
        updatedAt: now,
      },
    ]],
  ]);

  const transaction = {
    insert(table: unknown) {
      return {
        values(values: unknown) {
          valuesByTable.set(table, Array.isArray(values) ? values : [values]);
          return {
            returning: async () => {
              if (table === options.failOn) throw new Error("component insert failed");
              return persistedRecords.get(table);
            },
          };
        },
      };
    },
  };
  const database = {
    transaction: vi.fn(async (callback: (currentTransaction: typeof transaction) => Promise<unknown>) => callback(transaction)),
  } as unknown as DatabaseClient & {
    readonly transaction: ReturnType<typeof vi.fn>;
    valuesFor(table: unknown): readonly unknown[];
  };

  return Object.assign(database, {
    valuesFor: (table: unknown) => valuesByTable.get(table) ?? [],
  });
}
