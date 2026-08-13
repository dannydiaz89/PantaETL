import { and, asc, eq, exists, inArray, lte } from "drizzle-orm";

import type { DatabaseClient } from "./client.js";
import { artifacts } from "./schema/artifacts.js";
import { runLogs, runs } from "./schema/execution.js";
import { datasets, stagedUploads } from "./schema/retention.js";

/** The maximum number of explicitly expired records returned by one retention query. */
export const DEFAULT_RETENTION_BATCH_SIZE = 100;

/** A temporary dataset whose explicitly recorded expiry has elapsed. */
export type ExpiredDataset = Pick<
  typeof datasets.$inferSelect,
  "id" | "storageKind" | "storageLocation" | "expiresAt"
>;

/** A retained artifact whose explicitly recorded expiry has elapsed. */
export type ExpiredArtifact = Pick<
  typeof artifacts.$inferSelect,
  "id" | "storageKind" | "storageLocation" | "expiresAt"
>;

/** A run record whose explicitly recorded expiry has elapsed. */
export type ExpiredRun = Pick<typeof runs.$inferSelect, "id" | "expiresAt">;

/** A run log record whose explicitly recorded expiry has elapsed. */
export type ExpiredRunLog = Pick<typeof runLogs.$inferSelect, "id" | "runId" | "expiresAt">;

/** An uploaded file whose explicit expiry has elapsed before a pipeline claims it. */
export type ExpiredStagedUpload = Pick<
  typeof stagedUploads.$inferSelect,
  "id" | "storageKind" | "storageLocation" | "expiresAt"
>;

const terminalRunStates = ["succeeded", "completed_with_warnings", "failed", "cancelled"] as const;

/**
 * Reads temporary datasets eligible for garbage collection.
 *
 * This query intentionally relies only on the row's explicit `expiresAt` value;
 * it does not infer whether a storage location is safe to remove.
 */
export async function listExpiredDatasets(
  db: DatabaseClient,
  now: Date = new Date(),
  batchSize: number = DEFAULT_RETENTION_BATCH_SIZE,
): Promise<ExpiredDataset[]> {
  const limit = validateBatchSize(batchSize);

  return db
    .select({
      id: datasets.id,
      storageKind: datasets.storageKind,
      storageLocation: datasets.storageLocation,
      expiresAt: datasets.expiresAt,
    })
    .from(datasets)
    .innerJoin(runs, eq(datasets.runId, runs.id))
    .where(and(lte(datasets.expiresAt, now), inArray(runs.state, terminalRunStates)))
    .orderBy(asc(datasets.expiresAt), asc(datasets.id))
    .limit(limit);
}

/** Reads stale uploads whose durable expiry has elapsed before they were claimed. */
export async function listExpiredStagedUploads(
  db: DatabaseClient,
  now: Date = new Date(),
  batchSize: number = DEFAULT_RETENTION_BATCH_SIZE,
): Promise<ExpiredStagedUpload[]> {
  const limit = validateBatchSize(batchSize);

  return db
    .select({
      id: stagedUploads.id,
      storageKind: stagedUploads.storageKind,
      storageLocation: stagedUploads.storageLocation,
      expiresAt: stagedUploads.expiresAt,
    })
    .from(stagedUploads)
    .where(lte(stagedUploads.expiresAt, now))
    .orderBy(asc(stagedUploads.expiresAt), asc(stagedUploads.id))
    .limit(limit);
}

/**
 * Removes artifact metadata only after its explicitly expired storage object was handled.
 *
 * A false result means another collector already completed the idempotent removal.
 */
export async function deleteExpiredArtifact(
  db: DatabaseClient,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  return deleteExpiredRecord(db, artifacts, id, now);
}

/** Removes temporary dataset metadata after an explicitly expired storage cleanup. */
export async function deleteExpiredDataset(
  db: DatabaseClient,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  const terminalRun = db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.id, datasets.runId), inArray(runs.state, terminalRunStates)));
  const deleted = await db
    .delete(datasets)
    .where(and(eq(datasets.id, id), lte(datasets.expiresAt, now), exists(terminalRun)))
    .returning({ id: datasets.id });

  return deleted.length > 0;
}

/** Removes stale-upload metadata after its explicitly expired storage cleanup. */
export async function deleteExpiredStagedUpload(
  db: DatabaseClient,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  return deleteExpiredRecord(db, stagedUploads, id, now);
}

/**
 * Reads retained artifacts eligible for garbage collection.
 *
 * The caller owns the idempotent storage and metadata cleanup; this boundary
 * performs no deletion.
 */
export async function listExpiredArtifacts(
  db: DatabaseClient,
  now: Date = new Date(),
  batchSize: number = DEFAULT_RETENTION_BATCH_SIZE,
): Promise<ExpiredArtifact[]> {
  const limit = validateBatchSize(batchSize);

  return db
    .select({
      id: artifacts.id,
      storageKind: artifacts.storageKind,
      storageLocation: artifacts.storageLocation,
      expiresAt: artifacts.expiresAt,
    })
    .from(artifacts)
    .where(lte(artifacts.expiresAt, now))
    .orderBy(asc(artifacts.expiresAt), asc(artifacts.id))
    .limit(limit);
}

/** Reads expired run records for the run-retention cleanup task. */
export async function listExpiredRuns(
  db: DatabaseClient,
  now: Date = new Date(),
  batchSize: number = DEFAULT_RETENTION_BATCH_SIZE,
): Promise<ExpiredRun[]> {
  const limit = validateBatchSize(batchSize);

  return db
    .select({ id: runs.id, expiresAt: runs.expiresAt })
    .from(runs)
    .where(lte(runs.expiresAt, now))
    .orderBy(asc(runs.expiresAt), asc(runs.id))
    .limit(limit);
}

/** Reads expired run log records for the log-retention cleanup task. */
export async function listExpiredRunLogs(
  db: DatabaseClient,
  now: Date = new Date(),
  batchSize: number = DEFAULT_RETENTION_BATCH_SIZE,
): Promise<ExpiredRunLog[]> {
  const limit = validateBatchSize(batchSize);

  return db
    .select({ id: runLogs.id, runId: runLogs.runId, expiresAt: runLogs.expiresAt })
    .from(runLogs)
    .where(lte(runLogs.expiresAt, now))
    .orderBy(asc(runLogs.expiresAt), asc(runLogs.id))
    .limit(limit);
}

/** Rejects invalid limits before constructing a bounded retention query. */
function validateBatchSize(batchSize: number): number {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Retention batch size must be a positive integer.");
  }

  return batchSize;
}

/** Deletes one tracked row only when the row still carries elapsed expiry metadata. */
async function deleteExpiredRecord(
  db: DatabaseClient,
  table: typeof artifacts | typeof datasets | typeof stagedUploads,
  id: string,
  now: Date,
): Promise<boolean> {
  const deleted = await db
    .delete(table)
    .where(and(eq(table.id, id), lte(table.expiresAt, now)))
    .returning({ id: table.id });

  return deleted.length > 0;
}
