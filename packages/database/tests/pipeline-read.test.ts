import type { DatabaseClient } from "../src/client.js";
import { hydratePipeline, type PersistedPipelineGraph } from "../src/pipelines/hydration.js";
import { getPipeline, listPipelinesByOwner } from "../src/pipelines/read.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../src/schema/pipelines.js";
import { describe, expect, it, vi } from "vitest";

const ids = {
  edgeTarget: "123e4567-e89b-12d3-a456-426614174004",
  pipeline: "123e4567-e89b-12d3-a456-426614174001",
  scheduleTrigger: "123e4567-e89b-12d3-a456-426614174007",
  source: "123e4567-e89b-12d3-a456-426614174002",
  trigger: "123e4567-e89b-12d3-a456-426614174005",
  user: "123e4567-e89b-12d3-a456-426614174006",
};
const createdAt = new Date("2026-08-13T00:00:00.000Z");
const updatedAt = new Date("2026-08-13T01:00:00.000Z");

function persistedGraph(): PersistedPipelineGraph {
  return {
    components: [
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
        id: ids.edgeTarget,
        kind: "export",
        pipelineId: ids.pipeline,
        secretBindings: [],
      },
    ],
    edges: [
      {
        fromComponentId: ids.source,
        pipelineId: ids.pipeline,
        toComponentId: ids.edgeTarget,
      },
    ],
    pipeline: {
      contractVersion: "v1",
      createdAt,
      id: ids.pipeline,
      name: "Daily orders",
      ownerUserId: ids.user,
      state: "enabled",
      updatedAt,
    },
    triggers: [
      {
        createdAt,
        enabled: true,
        id: ids.trigger,
        lastClaimedAt: null,
        nextRunAt: null,
        pipelineId: ids.pipeline,
        type: "manual",
        updatedAt,
      },
      {
        createdAt,
        cron: "0 8 * * *",
        enabled: false,
        id: ids.scheduleTrigger,
        lastClaimedAt: null,
        nextRunAt: null,
        pipelineId: ids.pipeline,
        timezone: "UTC",
        type: "schedule",
        updatedAt,
      },
    ],
  };
}

describe("pipeline repository read operations", () => {
  it("hydrates every persisted graph record through the canonical browser-safe contract", () => {
    expect(hydratePipeline(persistedGraph())).toEqual({
      contractVersion: "v1",
      createdAt: createdAt.toISOString(),
      edges: [{ fromStepId: ids.source, toStepId: ids.edgeTarget }],
      id: ids.pipeline,
      name: "Daily orders",
      ownerUserId: ids.user,
      state: "enabled",
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
          id: ids.edgeTarget,
          kind: "export",
        },
      ],
      triggers: [
        { enabled: true, id: ids.trigger, pipelineId: ids.pipeline, type: "manual" },
        {
          cron: "0 8 * * *",
          enabled: false,
          id: ids.scheduleTrigger,
          pipelineId: ids.pipeline,
          timezone: "UTC",
          type: "schedule",
        },
      ],
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("rejects configuration data that would expose a usable secret", () => {
    const graph = persistedGraph();
    const unsafeGraph = {
      ...graph,
      components: graph.components.map((component, index) => (
        index === 0 ? { ...component, configurationValues: { apiToken: "usable-secret" } } : component
      )),
    };

    expect(() => hydratePipeline(unsafeGraph)).toThrow();
  });

  it("lists only hydrated owner-scoped pipeline graphs", async () => {
    const graph = persistedGraph();
    const database = readDatabase({
      components: graph.components,
      edges: graph.edges,
      pipelines: [graph.pipeline],
      triggers: graph.triggers,
    });

    await expect(listPipelinesByOwner(database, ids.user)).resolves.toEqual([hydratePipeline(graph)]);
    expect(database.select).toHaveBeenCalledTimes(4);
  });

  it("returns no detail when the owner-scoped pipeline selection finds no record", async () => {
    const database = readDatabase({ components: [], edges: [], pipelines: [], triggers: [] });

    await expect(getPipeline(database, { ownerUserId: ids.user, pipelineId: ids.pipeline })).resolves.toBeUndefined();
    expect(database.select).toHaveBeenCalledTimes(1);
  });

  it("hydrates one owner-scoped pipeline detail with all child records", async () => {
    const graph = persistedGraph();
    const database = readDatabase({
      components: graph.components,
      edges: graph.edges,
      pipelines: [graph.pipeline],
      triggers: graph.triggers,
    });

    await expect(getPipeline(database, { ownerUserId: ids.user, pipelineId: ids.pipeline })).resolves.toEqual(
      hydratePipeline(graph),
    );
    expect(database.select).toHaveBeenCalledTimes(4);
  });
});

interface ReadDatabaseRecords {
  readonly components: readonly (typeof pipelineComponents.$inferSelect)[];
  readonly edges: readonly (typeof pipelineEdges.$inferSelect)[];
  readonly pipelines: readonly (typeof pipelines.$inferSelect)[];
  readonly triggers: readonly (typeof pipelineTriggers.$inferSelect)[];
}

/** Builds a typed query-double that returns records for the table selected by the repository. */
function readDatabase(records: ReadDatabaseRecords): DatabaseClient & { select: ReturnType<typeof vi.fn> } {
  const select = vi.fn(() => ({
    from(table: unknown) {
      const rows = recordsForTable(table, records);

      return {
        where() {
          return Object.assign(Promise.resolve(rows), {
            limit: async () => rows,
            orderBy: async () => rows,
          });
        },
      };
    },
  }));

  return { select } as unknown as DatabaseClient & { select: ReturnType<typeof vi.fn> };
}

/** Returns fixture records for a Drizzle table without simulating SQL evaluation. */
function recordsForTable(table: unknown, records: ReadDatabaseRecords): readonly unknown[] {
  if (table === pipelines) {
    return records.pipelines;
  }

  if (table === pipelineComponents) {
    return records.components;
  }

  if (table === pipelineEdges) {
    return records.edges;
  }

  if (table === pipelineTriggers) {
    return records.triggers;
  }

  throw new Error("Unexpected table read.");
}
