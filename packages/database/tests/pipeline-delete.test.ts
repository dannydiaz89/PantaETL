import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDatabaseConnection, type DatabaseClient, type DatabaseConnection } from "../src/client.js";
import {
  deletePipeline,
  PipelineDeletionHasRunHistoryError,
  PipelineDeletionLockedError,
  type DeletePipelineInput,
} from "../src/pipelines/delete.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../src/schema/pipelines.js";
import { runs } from "../src/schema/execution.js";
import { users } from "../src/schema/users.js";

const ids = {
  pipeline: "323e4567-e89b-12d3-a456-426614174001",
  run: "323e4567-e89b-12d3-a456-426614174002",
  user: "323e4567-e89b-12d3-a456-426614174003",
};

describe("pipeline repository delete operation", () => {
  it("deletes only a matching idle owner-scoped pipeline", async () => {
    const database = deleteDatabase();

    await expect(deletePipeline(database, { ownerUserId: ids.user, pipelineId: ids.pipeline })).resolves.toBe(true);

    expect(database.deletedPipelineIds).toEqual([ids.pipeline]);
    expect(database.transaction).toHaveBeenCalledTimes(1);
  });

  it("does not reveal or delete a pipeline outside the caller's owner scope", async () => {
    const database = deleteDatabase({ pipeline: undefined });

    await expect(deletePipeline(database, { ownerUserId: ids.user, pipelineId: ids.pipeline })).resolves.toBe(false);

    expect(database.deletedPipelineIds).toEqual([]);
    expect(database.select).toHaveBeenCalledTimes(1);
  });

  it.each(["queued", "running"] as const)("rejects deletion while a run is %s", async (state) => {
    const database = deleteDatabase({ activeRun: { cancellationRequestedAt: null, id: ids.run, state } });

    await expect(deletePipeline(database, { ownerUserId: ids.user, pipelineId: ids.pipeline })).rejects.toBeInstanceOf(
      PipelineDeletionLockedError,
    );

    expect(database.deletedPipelineIds).toEqual([]);
  });

  it("preserves durable historical runs instead of attempting a cascading pipeline deletion", async () => {
    const database = deleteDatabase({ retainedRun: { id: ids.run } });

    await expect(deletePipeline(database, { ownerUserId: ids.user, pipelineId: ids.pipeline })).rejects.toBeInstanceOf(
      PipelineDeletionHasRunHistoryError,
    );

    expect(database.deletedPipelineIds).toEqual([]);
  });

  it("uses the database's deliberate graph cascades while run records remain restrictive", () => {
    expect(foreignKeyToPipeline(pipelineComponents).onDelete).toBe("cascade");
    expect(foreignKeyToPipeline(pipelineEdges).onDelete).toBe("cascade");
    expect(foreignKeyToPipeline(pipelineTriggers).onDelete).toBe("cascade");
    expect(foreignKeyToPipeline(runs).onDelete).toBe("restrict");
  });
});

const describeDatabase = process.env["DATABASE_URL"] ? describe : describe.skip;

describeDatabase("pipeline repository deletion against PostgreSQL", () => {
  let connection: DatabaseConnection | undefined;
  let fixture: DatabaseFixture | undefined;

  beforeEach(async () => {
    connection = createDatabaseConnection(requireDatabaseUrl());
    fixture = await createDatabaseFixture(connection.db);
  });

  afterEach(async () => {
    if (connection && fixture) await destroyDatabaseFixture(connection.db, fixture);
    await connection?.close();
    connection = undefined;
    fixture = undefined;
  });

  it("cascades an idle definition's components, edges, and triggers", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;

    await expect(deletePipeline(database, activeFixture.ownerScope)).resolves.toBe(true);

    await expect(database.select().from(pipelines).where(eq(pipelines.id, activeFixture.pipelineId))).resolves.toEqual([]);
    await expect(database.select().from(pipelineComponents).where(eq(pipelineComponents.pipelineId, activeFixture.pipelineId))).resolves.toEqual([]);
    await expect(database.select().from(pipelineEdges).where(eq(pipelineEdges.pipelineId, activeFixture.pipelineId))).resolves.toEqual([]);
    await expect(database.select().from(pipelineTriggers).where(eq(pipelineTriggers.pipelineId, activeFixture.pipelineId))).resolves.toEqual([]);
  });

  it("rejects deletion and retains durable run history", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;
    const runId = randomUUID();
    await database.insert(runs).values({ id: runId, pipelineId: activeFixture.pipelineId, state: "succeeded" });

    await expect(deletePipeline(database, activeFixture.ownerScope)).rejects.toBeInstanceOf(
      PipelineDeletionHasRunHistoryError,
    );
    await expect(database.select().from(pipelines).where(eq(pipelines.id, activeFixture.pipelineId))).resolves.toHaveLength(1);
    await expect(database.select().from(runs).where(eq(runs.id, runId))).resolves.toHaveLength(1);
  });
});

interface DeleteDatabaseOptions {
  readonly activeRun?: { readonly cancellationRequestedAt: Date | null; readonly id: string; readonly state: "queued" | "running" };
  readonly pipeline?: { readonly id: string; readonly state: "draft" | "disabled" | "enabled" } | undefined;
  readonly retainedRun?: { readonly id: string };
}

interface DatabaseFixture {
  readonly ownerScope: DeletePipelineInput;
  readonly pipelineId: string;
  readonly userId: string;
}

/** Builds a typed transaction double for owner-scoped deletion repository tests. */
function deleteDatabase(options: DeleteDatabaseOptions = {}) {
  const pipeline = options.pipeline === undefined && Object.hasOwn(options, "pipeline")
    ? undefined
    : options.pipeline ?? { id: ids.pipeline, state: "draft" as const };
  const deletedPipelineIds: string[] = [];
  let runQueryCount = 0;
  const select = vi.fn(() => ({
    from(table: unknown) {
      const rows = recordsForQuery(table);
      return {
        where() {
          return {
            limit() {
              return {
                for: async () => rows,
                then: <TResult1 = readonly unknown[], TResult2 = never>(
                  onfulfilled?: ((value: readonly unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
                  onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
                ) => Promise.resolve(rows).then(onfulfilled, onrejected),
              };
            },
          };
        },
      };
    },
  }));

  /** Return active-run and retained-history query results in repository order. */
  function recordsForQuery(table: unknown): readonly unknown[] {
    if (table === pipelines) return pipeline === undefined ? [] : [pipeline];
    if (table !== runs) throw new Error("Unexpected table read.");

    runQueryCount += 1;
    if (runQueryCount === 1) return options.activeRun === undefined ? [] : [options.activeRun];
    return options.retainedRun === undefined ? [] : [options.retainedRun];
  }

  const transaction = {
    delete(table: unknown) {
      if (table !== pipelines) throw new Error("Only pipelines may be deleted.");
      return {
        where() {
          return {
            returning: async () => {
              if (pipeline === undefined) return [];
              deletedPipelineIds.push(pipeline.id);
              return [{ id: pipeline.id }];
            },
          };
        },
      };
    },
    select,
  };
  const database = {
    transaction: vi.fn(async (callback: (currentTransaction: typeof transaction) => Promise<unknown>) => callback(transaction)),
  } as unknown as DatabaseClient & {
    readonly select: ReturnType<typeof vi.fn>;
    readonly transaction: ReturnType<typeof vi.fn>;
    readonly deletedPipelineIds: readonly string[];
  };

  return Object.assign(database, { deletedPipelineIds, select });
}

/** Finds the foreign key from a child record to its owning pipeline. */
function foreignKeyToPipeline(table: typeof pipelineComponents | typeof pipelineEdges | typeof pipelineTriggers | typeof runs) {
  const foreignKey = getTableConfig(table).foreignKeys.find(
    (candidate) => candidate.reference().foreignTable === pipelines,
  );

  if (!foreignKey) throw new Error("Expected a pipeline foreign key.");
  return foreignKey;
}

/** Creates a complete, isolated pipeline graph in a migrated PostgreSQL database. */
async function createDatabaseFixture(db: DatabaseClient): Promise<DatabaseFixture> {
  const componentSourceId = randomUUID();
  const componentExportId = randomUUID();
  const pipelineId = randomUUID();
  const triggerId = randomUUID();
  const userId = randomUUID();

  await db.insert(users).values({
    email: `pipeline-delete-${userId}@example.test`,
    id: userId,
    username: `pipeline-delete-${userId}`,
  });
  await db.insert(pipelines).values({ id: pipelineId, name: "Deletion fixture", ownerUserId: userId });
  await db.insert(pipelineComponents).values([
    {
      componentType: "source.csv",
      componentVersion: "v1",
      configurationValues: { path: "input.csv" },
      id: componentSourceId,
      kind: "source",
      pipelineId,
    },
    {
      componentType: "export.json",
      componentVersion: "v1",
      configurationValues: { path: "output.json" },
      id: componentExportId,
      kind: "export",
      pipelineId,
    },
  ]);
  await db.insert(pipelineEdges).values({
    fromComponentId: componentSourceId,
    pipelineId,
    toComponentId: componentExportId,
  });
  await db.insert(pipelineTriggers).values({ id: triggerId, pipelineId, type: "manual" });

  return { ownerScope: { ownerUserId: userId, pipelineId }, pipelineId, userId };
}

/** Removes only the fixture records this integration suite created. */
async function destroyDatabaseFixture(db: DatabaseClient, activeFixture: DatabaseFixture): Promise<void> {
  await db.delete(runs).where(eq(runs.pipelineId, activeFixture.pipelineId));
  await db.delete(pipelines).where(eq(pipelines.id, activeFixture.pipelineId));
  await db.delete(users).where(eq(users.id, activeFixture.userId));
}

/** Require the explicit test database connection to avoid accidental integration runs. */
function requireDatabaseUrl(): string {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
  return databaseUrl;
}

/** Return a configured fixture after the suite setup has completed. */
function requireFixture(activeFixture: DatabaseFixture | undefined): DatabaseFixture {
  if (!activeFixture) throw new Error("Pipeline deletion test fixture was not created.");
  return activeFixture;
}

/** Return the active database connection after suite setup has completed. */
function requireConnection(activeConnection: DatabaseConnection | undefined): DatabaseConnection {
  if (!activeConnection) throw new Error("Pipeline deletion test database was not connected.");
  return activeConnection;
}
