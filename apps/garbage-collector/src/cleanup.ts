import type {
  DatabaseClient,
  ExpiredArtifact,
  ExpiredDataset,
  ExpiredRun,
  ExpiredRunLog,
  ExpiredStagedUpload,
} from '@pantaetl/database';
import {
  deleteExpiredArtifact,
  deleteExpiredDataset,
  deleteExpiredRun,
  deleteExpiredRunLog,
  deleteExpiredStagedUpload,
  listExpiredArtifacts,
  listExpiredDatasets,
  listExpiredRunLogs,
  listExpiredRuns,
  listExpiredStagedUploads,
} from '@pantaetl/database';

import type { RetentionStorage, StoredObject } from './storage.js';

/** Bounded retention reads and conditional metadata deletion used by the collector. */
export interface RetentionRepository {
  listExpiredArtifacts(now: Date, batchSize: number): Promise<ExpiredArtifact[]>;
  listExpiredDatasets(now: Date, batchSize: number): Promise<ExpiredDataset[]>;
  listExpiredStagedUploads(now: Date, batchSize: number): Promise<ExpiredStagedUpload[]>;
  deleteExpiredArtifact(id: string, now: Date): Promise<boolean>;
  deleteExpiredDataset(id: string, now: Date): Promise<boolean>;
  deleteExpiredStagedUpload(id: string, now: Date): Promise<boolean>;
  listExpiredRuns(now: Date, batchSize: number): Promise<ExpiredRun[]>;
  listExpiredRunLogs(now: Date, batchSize: number): Promise<ExpiredRunLog[]>;
  deleteExpiredRun(id: string, now: Date): Promise<boolean>;
  deleteExpiredRunLog(id: string, now: Date): Promise<boolean>;
}

/** Counters for one safe, bounded retention cleanup pass. */
export interface CleanupSummary {
  readonly candidates: number;
  readonly metadataDeleted: number;
  readonly failed: number;
  readonly skipped: number;
}

/** Creates the PostgreSQL retention boundary used by the garbage collector. */
export function createRetentionRepository(database: DatabaseClient): RetentionRepository {
  return {
    listExpiredArtifacts: (now, batchSize) => listExpiredArtifacts(database, now, batchSize),
    listExpiredDatasets: (now, batchSize) => listExpiredDatasets(database, now, batchSize),
    listExpiredStagedUploads: (now, batchSize) => listExpiredStagedUploads(database, now, batchSize),
    deleteExpiredArtifact: (id, now) => deleteExpiredArtifact(database, id, now),
    deleteExpiredDataset: (id, now) => deleteExpiredDataset(database, id, now),
    deleteExpiredStagedUpload: (id, now) => deleteExpiredStagedUpload(database, id, now),
    listExpiredRuns: (now, batchSize) => listExpiredRuns(database, now, batchSize),
    listExpiredRunLogs: (now, batchSize) => listExpiredRunLogs(database, now, batchSize),
    deleteExpiredRun: (id, now) => deleteExpiredRun(database, id, now),
    deleteExpiredRunLog: (id, now) => deleteExpiredRunLog(database, id, now),
  };
}

/** Counters for one safe pass over expired run history and operational logs. */
export interface ExecutionCleanupSummary {
  readonly logsDeleted: number;
  readonly runCandidates: number;
  readonly runsDeleted: number;
}

/**
 * Removes explicitly expired logs before attempting terminal run deletion.
 *
 * Conditional metadata deletes make concurrent collectors and retrying a pass
 * harmless; a run with remaining dependencies remains available for a later pass.
 */
export class ExecutionRetentionCleanup {
  public constructor(
    private readonly repository: RetentionRepository,
    private readonly batchSize: number,
  ) {}

  /** Executes one bounded, ordered run/log retention pass. */
  public async run(now: Date = new Date()): Promise<ExecutionCleanupSummary> {
    const expiredLogs = await this.repository.listExpiredRunLogs(now, this.batchSize);
    const deletedLogs = await Promise.all(
      expiredLogs.map((log) => this.repository.deleteExpiredRunLog(log.id, now)),
    );
    const expiredRuns = await this.repository.listExpiredRuns(now, this.batchSize);
    const deletedRuns = await Promise.all(
      expiredRuns.map((run) => this.repository.deleteExpiredRun(run.id, now)),
    );

    return {
      logsDeleted: countDeleted(deletedLogs),
      runCandidates: expiredRuns.length,
      runsDeleted: countDeleted(deletedRuns),
    };
  }
}

/**
 * Removes storage objects selected by explicit, expired metadata and then removes
 * that metadata conditionally. It never scans storage or guesses ownership.
 */
export class RetentionCleanup {
  public constructor(
    private readonly repository: RetentionRepository,
    private readonly storage: RetentionStorage,
    private readonly batchSize: number,
  ) {}

  /** Executes one bounded cleanup pass that is safe to repeat after partial failure. */
  public async run(now: Date = new Date()): Promise<CleanupSummary> {
    const [artifacts, datasets, uploads] = await Promise.all([
      this.repository.listExpiredArtifacts(now, this.batchSize),
      this.repository.listExpiredDatasets(now, this.batchSize),
      this.repository.listExpiredStagedUploads(now, this.batchSize),
    ]);

    const summaries = await Promise.all([
      this.cleanupRecords(artifacts, now, (id, currentTime) => this.repository.deleteExpiredArtifact(id, currentTime)),
      this.cleanupRecords(datasets, now, (id, currentTime) => this.repository.deleteExpiredDataset(id, currentTime)),
      this.cleanupRecords(uploads, now, (id, currentTime) => this.repository.deleteExpiredStagedUpload(id, currentTime)),
    ]);

    return summaries.reduce(addSummaries, emptySummary());
  }

  /** Cleans each independently owned storage object without allowing one failure to stop the batch. */
  private async cleanupRecords(
    records: ReadonlyArray<ExpiredStorageRecord>,
    now: Date,
    deleteMetadata: (id: string, currentTime: Date) => Promise<boolean>,
  ): Promise<CleanupSummary> {
    const results = await Promise.all(records.map(async (record) => {
      try {
        const outcome = await this.storage.delete(record);
        if (outcome === 'unsupported') {
          return { ...emptySummary(), candidates: 1, skipped: 1 };
        }

        const metadataDeleted = await deleteMetadata(record.id, now);
        return { ...emptySummary(), candidates: 1, metadataDeleted: Number(metadataDeleted) };
      } catch {
        return { ...emptySummary(), candidates: 1, failed: 1 };
      }
    }));

    return results.reduce(addSummaries, emptySummary());
  }
}

type ExpiredStorageRecord = (ExpiredArtifact | ExpiredDataset | ExpiredStagedUpload) & StoredObject;

/** Produces a zero-value cleanup result without mutable shared counters. */
function emptySummary(): CleanupSummary {
  return { candidates: 0, metadataDeleted: 0, failed: 0, skipped: 0 };
}

/** Adds two immutable cleanup summaries. */
function addSummaries(left: CleanupSummary, right: CleanupSummary): CleanupSummary {
  return {
    candidates: left.candidates + right.candidates,
    metadataDeleted: left.metadataDeleted + right.metadataDeleted,
    failed: left.failed + right.failed,
    skipped: left.skipped + right.skipped,
  };
}

/** Counts successful conditional metadata deletes without mutable shared state. */
function countDeleted(results: readonly boolean[]): number {
  return results.filter(Boolean).length;
}
