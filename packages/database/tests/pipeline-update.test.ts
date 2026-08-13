import type { PipelineUpdateRequest } from "@pantaetl/contracts";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../src/client.js";
import { updatePipeline } from "../src/pipelines/update.js";
import { runs } from "../src/schema/execution.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../src/schema/pipelines.js";

const ids = {
  export: "323e4567-e89b-12d3-a456-426614174003",
  pipeline: "323e4567-e89b-12d3-a456-426614174001",
  source: "323e4567-e89b-12d3-a456-426614174002",
  trigger: "323e4567-e89b-12d3-a456-426614174004",
  user: "323e4567-e89b-12d3-a456-426614174005",
};
const previousUpdate = new Date("2026-08-13T00:00:00.000Z");
const updateTime = new Date("2026-08-13T01:00:00.000Z");

describe("pipeline repository update operation", () => {
  it("updates an idle pipeline graph atomically and returns its canonical representation", async () => {
    const database = createDatabaseDouble();
    const request: PipelineUpdateRequest = {
      edges: [{ fromStepId: ids.source, toStepId: ids.export }],
      name: "Renamed orders",
      state: "enabled",
      steps: replacementSteps(),
      triggers: [{ cron: "0 9 * * *", enabled: true, timezone: "UTC", type: "schedule" }],
    };

    await expect(updatePipeline(database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
      update: request,
    }, updateTime)).resolves.toEqual(expect.objectContaining({
      name: "Renamed orders",
      state: "enabled",
      updatedAt: updateTime.toISOString(),
      triggers: [{
        cron: "0 9 * * *",
        enabled: true,
        id: ids.trigger,
        pipelineId: ids.pipeline,
        timezone: "UTC",
        type: "schedule",
      }],
    }));

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(database.updateValuesFor(pipelines)).toEqual([
      { name: "Renamed orders", state: "enabled", updatedAt: updateTime },
    ]);
    expect(database.deleteTables()).toEqual([pipelineEdges, pipelineComponents, pipelineTriggers]);
    expect(database.insertValuesFor(pipelineComponents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: ids.source,
        secretBindings: [{ binding: "ORDERS_API_TOKEN_V2", key: "apiToken" }],
      }),
    ]));
    expect(database.insertValuesFor(pipelineTriggers)).toEqual([
      { cron: "0 9 * * *", enabled: true, pipelineId: ids.pipeline, timezone: "UTC", type: "schedule" },
    ]);
  });

  it("preserves component secret binding references when an update does not replace steps", async () => {
    const database = createDatabaseDouble();

    await expect(updatePipeline(database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
      update: { name: "New name" },
    }, updateTime)).resolves.toEqual(expect.objectContaining({
      name: "New name",
      steps: expect.arrayContaining([
        expect.objectContaining({
          configuration: expect.objectContaining({
            secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
          }),
        }),
      ]),
    }));

    expect(database.deleteTables()).toEqual([]);
    expect(database.insertValuesFor(pipelineComponents)).toEqual([]);
  });

  it("rejects queued and running pipeline updates before graph writes", async () => {
    const database = createDatabaseDouble({ activeRun: "queued" });

    await expect(updatePipeline(database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
      update: { name: "Blocked change" },
    }, updateTime)).rejects.toThrow("Pipeline configuration is locked while a run is queued or active.");

    expect(database.updateValuesFor(pipelines)).toEqual([]);
    expect(database.deleteTables()).toEqual([]);
  });

  it("returns no result when the pipeline is not owned by the authenticated user", async () => {
    const database = createDatabaseDouble({ pipelineExists: false });

    await expect(updatePipeline(database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
      update: { name: "Unauthorized change" },
    }, updateTime)).resolves.toBeUndefined();

    expect(database.updateValuesFor(pipelines)).toEqual([]);
  });

  it("propagates graph write failures so the surrounding transaction rolls back", async () => {
    const database = createDatabaseDouble({ failOnInsert: pipelineComponents });

    await expect(updatePipeline(database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
      update: { steps: replacementSteps() },
    }, updateTime)).rejects.toThrow("component insert failed");

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(database.deleteTables()).toEqual([pipelineEdges, pipelineComponents]);
  });
});

/** Returns a complete component replacement with an explicit replacement secret binding. */
function replacementSteps(): PipelineUpdateRequest["steps"] {
  return [
    {
      componentType: "source.rest-api",
      componentVersion: "v1",
      configuration: {
        secretBindings: [{ binding: "ORDERS_API_TOKEN_V2", key: "apiToken" }],
        values: { endpoint: "https://example.test/v2/orders" },
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
  ];
}

interface DatabaseDoubleOptions {
  readonly activeRun?: "queued" | "running";
  readonly failOnInsert?: unknown;
  readonly pipelineExists?: boolean;
}

/** Builds a transactional query double with enough behavior to assert update ordering and values. */
function createDatabaseDouble(options: DatabaseDoubleOptions = {}) {
  const insertValuesByTable = new Map<unknown, readonly Record<string, unknown>[]>();
  const updateValuesByTable = new Map<unknown, readonly Record<string, unknown>[]>();
  const deletedTables: unknown[] = [];
  const initialRecords = records(options);

  const transaction = {
    select() {
      return {
        from(table: unknown) {
          const selected = initialRecords.get(table) ?? [];
          const query = Promise.resolve(selected);
          const lockableQuery = Object.assign(query, {
            for: () => lockableQuery,
            limit: async (limit: number) => selected.slice(0, limit),
          });

          return { where: () => lockableQuery };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          updateValuesByTable.set(table, [values]);
          return {
            where: () => ({
              returning: async () => {
                const [existing] = initialRecords.get(table) ?? [];
                return existing ? [{ ...existing, ...values }] : [];
              },
            }),
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where: async () => {
          deletedTables.push(table);
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown> | readonly Record<string, unknown>[]) {
          const rows = Array.isArray(values) ? values : [values];
          insertValuesByTable.set(table, rows);
          return {
            returning: async () => {
              if (table === options.failOnInsert) throw new Error("component insert failed");
              return persistedInsertRecords(table, rows);
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
    deleteTables(): readonly unknown[];
    insertValuesFor(table: unknown): readonly Record<string, unknown>[];
    updateValuesFor(table: unknown): readonly Record<string, unknown>[];
  };

  return Object.assign(database, {
    deleteTables: () => deletedTables,
    insertValuesFor: (table: unknown) => insertValuesByTable.get(table) ?? [],
    updateValuesFor: (table: unknown) => updateValuesByTable.get(table) ?? [],
  });
}

/** Fixture rows returned by owner-scoped graph and active-run reads. */
function records(options: DatabaseDoubleOptions): Map<unknown, readonly Record<string, unknown>[]> {
  return new Map([
    [pipelines, options.pipelineExists === false ? [] : [{
      contractVersion: "v1",
      createdAt: previousUpdate,
      id: ids.pipeline,
      name: "Daily orders",
      ownerUserId: ids.user,
      state: "draft",
      updatedAt: previousUpdate,
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
    [pipelineTriggers, [{
      createdAt: previousUpdate,
      enabled: true,
      id: ids.trigger,
      lastClaimedAt: null,
      nextRunAt: null,
      pipelineId: ids.pipeline,
      type: "manual",
      updatedAt: previousUpdate,
    }]],
    [runs, options.activeRun ? [{ cancellationRequestedAt: null, id: "423e4567-e89b-12d3-a456-426614174001", state: options.activeRun }] : []],
  ]);
}

/** Shape write values like PostgreSQL's `returning()` records for canonical hydration. */
function persistedInsertRecords(
  table: unknown,
  values: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  if (table === pipelineComponents || table === pipelineEdges) {
    return values;
  }

  if (table === pipelineTriggers) {
    return values.map((value) => ({
      ...value,
      createdAt: updateTime,
      id: ids.trigger,
      lastClaimedAt: null,
      nextRunAt: null,
      updatedAt: updateTime,
    }));
  }

  return values;
}
