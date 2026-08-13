import type {
  ExpiredArtifact,
  ExpiredDataset,
  ExpiredStagedUpload,
} from '@pantaetl/database';
import { describe, expect, it, vi } from 'vitest';

import { RetentionCleanup, type RetentionRepository } from '../src/cleanup.js';
import type { RetentionStorage } from '../src/storage.js';

const now = new Date('2026-08-13T00:00:00.000Z');

describe('retention cleanup', () => {
  it('repeats safe storage and conditional metadata cleanup without scanning filenames', async () => {
    const artifacts: ExpiredArtifact[] = [storageRecord('artifact-1', 'artifacts/export.csv')];
    const repository = repositoryWith({ artifacts });
    const storage: RetentionStorage = { delete: vi.fn().mockResolvedValue('handled') };
    const cleanup = new RetentionCleanup(repository, storage, 10);

    await expect(cleanup.run(now)).resolves.toEqual({ candidates: 1, failed: 0, metadataDeleted: 1, skipped: 0 });
    await expect(cleanup.run(now)).resolves.toEqual({ candidates: 1, failed: 0, metadataDeleted: 1, skipped: 0 });

    expect(storage.delete).toHaveBeenCalledWith({
      id: 'artifact-1',
      expiresAt: now,
      storageKind: 'local',
      storageLocation: 'artifacts/export.csv',
    });
    expect(repository.deleteExpiredArtifact).toHaveBeenCalledTimes(2);
    expect(repository.deleteExpiredArtifact).toHaveBeenLastCalledWith('artifact-1', now);
  });

  it('keeps metadata when its storage backend is not configured', async () => {
    const uploads: ExpiredStagedUpload[] = [storageRecord('upload-1', 'uploads/import.csv', 's3')];
    const repository = repositoryWith({ uploads });
    const storage: RetentionStorage = { delete: vi.fn().mockResolvedValue('unsupported') };

    await expect(new RetentionCleanup(repository, storage, 10).run(now)).resolves.toEqual({
      candidates: 1,
      failed: 0,
      metadataDeleted: 0,
      skipped: 1,
    });
    expect(repository.deleteExpiredStagedUpload).not.toHaveBeenCalled();
  });

  it('leaves metadata for a later retry when storage cleanup fails', async () => {
    const datasets: ExpiredDataset[] = [storageRecord('dataset-1', '../outside.parquet')];
    const repository = repositoryWith({ datasets });
    const storage: RetentionStorage = {
      delete: vi.fn().mockRejectedValue(new Error('unsafe storage location')),
    };

    await expect(new RetentionCleanup(repository, storage, 10).run(now)).resolves.toEqual({
      candidates: 1,
      failed: 1,
      metadataDeleted: 0,
      skipped: 0,
    });
    expect(repository.deleteExpiredDataset).not.toHaveBeenCalled();
  });
});

/** Creates one tracked, explicitly expired record for any storage-backed retention table. */
function storageRecord(
  id: string,
  storageLocation: string,
  storageKind: 'local' | 's3' = 'local',
): ExpiredArtifact & ExpiredDataset & ExpiredStagedUpload {
  return { id, expiresAt: now, storageKind, storageLocation };
}

/** Builds a fully typed retention boundary with only the requested expired records. */
function repositoryWith({
  artifacts = [],
  datasets = [],
  uploads = [],
}: {
  artifacts?: ExpiredArtifact[];
  datasets?: ExpiredDataset[];
  uploads?: ExpiredStagedUpload[];
}): RetentionRepository {
  return {
    listExpiredArtifacts: vi.fn().mockResolvedValue(artifacts),
    listExpiredDatasets: vi.fn().mockResolvedValue(datasets),
    listExpiredStagedUploads: vi.fn().mockResolvedValue(uploads),
    deleteExpiredArtifact: vi.fn().mockResolvedValue(true),
    deleteExpiredDataset: vi.fn().mockResolvedValue(true),
    deleteExpiredStagedUpload: vi.fn().mockResolvedValue(true),
  };
}
