import { randomUUID } from "node:crypto";

import type { PipelineCreateRequest } from "@pantaetl/contracts";
import { PipelineStateTransitionError } from "@pantaetl/pipeline";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDatabaseConnection, type DatabaseClient, type DatabaseConnection } from "../src/client.js";
import {
  PipelineActionConflictError,
  PipelineDeletionLockedError,
  createPipeline,
  deletePipeline,
  duplicatePipeline,
  getPipeline,
  listPipelinesByOwner,
  runPipelineForOwner,
  updatePipeline,
} from "../src/index.js";
import { runs } from "../src/schema/execution.js";
import { pipelineComponents, pipelineEdges, pipelines, pipelineTriggers } from "../src/schema/pipelines.js";
import { users } from "../src/schema/users.js";

const describeDatabase = process.env["DATABASE_URL"] ? describe : describe.skip;

describeDatabase("pipeline CRUD repository integration against PostgreSQL", () => {
  let connection: DatabaseConnection | undefined;
  let fixture: DatabaseFixture | undefined;

  beforeEach(async () => {
    connection = createDatabaseConnection(requireDatabaseUrl());
    fixture = await createFixture(connection.db);
  });

  afterEach(async () => {
    if (connection && fixture) await destroyFixture(connection.db, fixture);
    await connection?.close();
    connection = undefined;
    fixture = undefined;
  });

  it("persists a complete graph through create, read, update, and delete", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;
    const request = buildPipelineRequest("Daily orders");

    const created = await createPipeline(database, { ownerUserId: activeFixture.ownerUserId, pipeline: request });
    activeFixture.pipelineIds.add(created.id);

    expect(created).toMatchObject({
      edges: request.edges,
      name: "Daily orders",
      state: "draft",
      steps: request.steps,
      triggers: [
        expect.objectContaining({ enabled: true, type: "manual" }),
        expect.objectContaining({ cron: "0 8 * * *", enabled: true, timezone: "UTC", type: "schedule" }),
      ],
    });

    await expect(getPipeline(database, { ownerUserId: activeFixture.ownerUserId, pipelineId: created.id })).resolves.toEqual(created);
    await expect(listPipelinesByOwner(database, activeFixture.ownerUserId)).resolves.toEqual([created]);

    const updated = await updatePipeline(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipelineId: created.id,
      update: { name: "Daily orders revised" },
    });

    expect(updated).toMatchObject({
      edges: request.edges,
      name: "Daily orders revised",
      steps: request.steps,
      triggers: created.triggers,
    });
    await expect(deletePipeline(database, { ownerUserId: activeFixture.ownerUserId, pipelineId: created.id })).resolves.toBe(true);
    await expect(getPipeline(database, { ownerUserId: activeFixture.ownerUserId, pipelineId: created.id })).resolves.toBeUndefined();
    await expect(childGraphCounts(database, created.id)).resolves.toEqual({ components: 0, edges: 0, triggers: 0 });
  });

  it("keeps pipeline reads and mutations within the authenticated owner scope", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;
    const created = await createPipeline(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipeline: buildPipelineRequest("Private orders"),
    });
    activeFixture.pipelineIds.add(created.id);

    await expect(getPipeline(database, { ownerUserId: activeFixture.otherUserId, pipelineId: created.id })).resolves.toBeUndefined();
    await expect(listPipelinesByOwner(database, activeFixture.otherUserId)).resolves.toEqual([]);
    await expect(updatePipeline(database, {
      ownerUserId: activeFixture.otherUserId,
      pipelineId: created.id,
      update: { name: "Attempted takeover" },
    })).resolves.toBeUndefined();
    await expect(deletePipeline(database, { ownerUserId: activeFixture.otherUserId, pipelineId: created.id })).resolves.toBe(false);
    await expect(getPipeline(database, { ownerUserId: activeFixture.ownerUserId, pipelineId: created.id })).resolves.toEqual(created);
  });

  it("rejects updates and deletion while a pipeline has queued work", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;
    const created = await createPipeline(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipeline: buildPipelineRequest("Locked orders"),
    });
    activeFixture.pipelineIds.add(created.id);
    await database.insert(runs).values({ isActive: true, pipelineId: created.id, state: "queued" });

    await expect(updatePipeline(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipelineId: created.id,
      update: { name: "Blocked update" },
    })).rejects.toBeInstanceOf(PipelineStateTransitionError);
    await expect(deletePipeline(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipelineId: created.id,
    })).rejects.toBeInstanceOf(PipelineDeletionLockedError);
    await expect(getPipeline(database, { ownerUserId: activeFixture.ownerUserId, pipelineId: created.id })).resolves.toEqual(created);
  });

  it("duplicates configuration while clearing secret bindings and disabling triggers", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;
    const source = await createPipeline(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipeline: buildPipelineRequest("Secret-bound orders"),
    });
    activeFixture.pipelineIds.add(source.id);

    const copied = await duplicatePipeline(database, {
      name: "Secret-bound orders copy",
      ownerUserId: activeFixture.ownerUserId,
      pipelineId: source.id,
    });
    if (!copied) throw new Error("Expected the owner-scoped duplicate to be created.");
    activeFixture.pipelineIds.add(copied.id);

    expect(copied).toMatchObject({ name: "Secret-bound orders copy", state: "draft" });
    expect(copied.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentType: "source.rest-api",
        configuration: {
          secretBindings: [],
          values: { endpoint: "https://example.test/orders" },
        },
      }),
    ]));
    expect(copied.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ enabled: false, type: "manual" }),
      expect.objectContaining({ enabled: false, type: "schedule" }),
    ]));
  });

  it("rejects a manual run for a pipeline that is not enabled", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;
    const created = await createPipeline(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipeline: buildPipelineRequest("Draft orders"),
    });
    activeFixture.pipelineIds.add(created.id);
    const enqueue = vi.fn();

    await expect(runPipelineForOwner(database, {
      ownerUserId: activeFixture.ownerUserId,
      pipelineId: created.id,
    }, enqueue)).rejects.toMatchObject({
      name: "PipelineActionConflictError",
      reason: "not_enabled",
    } satisfies Partial<PipelineActionConflictError>);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rolls back a graph create when a component write violates a persisted constraint", async () => {
    const activeFixture = requireFixture(fixture);
    const database = requireConnection(connection).db;
    const occupiedComponentId = randomUUID();
    const seed = buildPipelineRequest("Existing graph", { sourceId: occupiedComponentId });
    const existing = await createPipeline(database, { ownerUserId: activeFixture.ownerUserId, pipeline: seed });
    activeFixture.pipelineIds.add(existing.id);
    const failing = buildPipelineRequest("Rollback graph", { sourceId: occupiedComponentId });
    const failingSource = failing.steps.find((step) => step.id === occupiedComponentId);
    if (!failingSource) throw new Error("Expected the rollback graph to include the reused component identifier.");

    await expect(createPipeline(database, { ownerUserId: activeFixture.ownerUserId, pipeline: failing })).rejects.toThrow();
    await expect(database.select().from(pipelines).where(and(
      eq(pipelines.ownerUserId, activeFixture.ownerUserId),
      eq(pipelines.name, failing.name),
    ))).resolves.toEqual([]);
    await expect(database.select().from(pipelineComponents).where(eq(pipelineComponents.id, failingSource.id))).resolves.toHaveLength(1);
  });
});

interface DatabaseFixture {
  readonly otherUserId: string;
  readonly ownerUserId: string;
  readonly pipelineIds: Set<string>;
}

interface PipelineRequestOptions {
  readonly sourceId?: string;
}

/** Creates an isolated owner pair used only by the PostgreSQL-backed suite. */
async function createFixture(database: DatabaseClient): Promise<DatabaseFixture> {
  const ownerUserId = randomUUID();
  const otherUserId = randomUUID();

  await database.insert(users).values([
    { email: `pipeline-crud-owner-${ownerUserId}@example.test`, id: ownerUserId, username: `pipeline-crud-owner-${ownerUserId}` },
    { email: `pipeline-crud-other-${otherUserId}@example.test`, id: otherUserId, username: `pipeline-crud-other-${otherUserId}` },
  ]);

  return { otherUserId, ownerUserId, pipelineIds: new Set() };
}

/** Deletes only records created by this suite, including graphs rejected after a database write attempt. */
async function destroyFixture(database: DatabaseClient, fixture: DatabaseFixture): Promise<void> {
  const ownedPipelines = await database
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(inArray(pipelines.ownerUserId, [fixture.ownerUserId, fixture.otherUserId]));
  const pipelineIds = ownedPipelines.map((pipeline) => pipeline.id);

  if (pipelineIds.length > 0) {
    await database.delete(runs).where(inArray(runs.pipelineId, pipelineIds));
    await database.delete(pipelines).where(inArray(pipelines.id, pipelineIds));
  }

  await database.delete(users).where(inArray(users.id, [fixture.ownerUserId, fixture.otherUserId]));
}

/** Builds a contract-valid Source-to-Transform-to-Export graph with manual and scheduled triggers. */
function buildPipelineRequest(name: string, options: PipelineRequestOptions = {}): PipelineCreateRequest {
  const sourceId = options.sourceId ?? randomUUID();
  const transformId = randomUUID();
  const exportId = randomUUID();

  return {
    contractVersion: "v1",
    edges: [
      { fromStepId: sourceId, toStepId: transformId },
      { fromStepId: transformId, toStepId: exportId },
    ],
    name,
    steps: [
      {
        componentType: "source.rest-api",
        componentVersion: "v1",
        configuration: {
          secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
          values: { endpoint: "https://example.test/orders" },
        },
        id: sourceId,
        kind: "source",
      },
      {
        componentType: "transform.normalize",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { trim: true } },
        id: transformId,
        kind: "transform",
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: "orders.json" } },
        id: exportId,
        kind: "export",
      },
    ],
    triggers: [
      { enabled: true, type: "manual" },
      { cron: "0 8 * * *", enabled: true, timezone: "UTC", type: "schedule" },
    ],
  };
}

/** Counts a graph's child rows to prove database cascades removed the entire definition. */
async function childGraphCounts(database: DatabaseClient, pipelineId: string): Promise<Record<string, number>> {
  const [components, edges, triggers] = await Promise.all([
    database.select().from(pipelineComponents).where(eq(pipelineComponents.pipelineId, pipelineId)),
    database.select().from(pipelineEdges).where(eq(pipelineEdges.pipelineId, pipelineId)),
    database.select().from(pipelineTriggers).where(eq(pipelineTriggers.pipelineId, pipelineId)),
  ]);

  return { components: components.length, edges: edges.length, triggers: triggers.length };
}

/** Requires intentional DATABASE_URL configuration before opening a real PostgreSQL connection. */
function requireDatabaseUrl(): string {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
  return databaseUrl;
}

/** Returns the fixture created for the current integration test. */
function requireFixture(activeFixture: DatabaseFixture | undefined): DatabaseFixture {
  if (!activeFixture) throw new Error("Pipeline CRUD integration fixture was not created.");
  return activeFixture;
}

/** Returns the configured PostgreSQL connection for the current integration test. */
function requireConnection(activeConnection: DatabaseConnection | undefined): DatabaseConnection {
  if (!activeConnection) throw new Error("Pipeline CRUD integration database was not connected.");
  return activeConnection;
}
