import type {
  DatabaseClient,
  ExpiredArtifact,
  ExpiredDataset,
  ExpiredStagedUpload,
} from '@pantaetl/database';
import {
  deleteExpiredArtifact,
  deleteExpiredDataset,
  deleteExpiredStagedUpload,
  listExpiredArtifacts,
  listExpiredDatasets,
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
  };
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
