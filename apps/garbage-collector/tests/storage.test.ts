import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { LocalRetentionStorage } from '../src/storage.js';

describe('local retention storage', () => {
  it('removes only the exact tracked location and leaves unrelated files untouched', async () => {
    const root = await temporaryDirectory();
    const storage = new LocalRetentionStorage(root);
    const tracked = join(root, 'artifacts', 'tracked.json');
    const untracked = join(root, 'artifacts', 'untracked.json');
    await mkdir(join(root, 'artifacts'), { recursive: true });
    await Promise.all([writeFile(tracked, '{}'), writeFile(untracked, '{}')]);

    try {
      await expect(storage.delete({ storageKind: 'local', storageLocation: 'artifacts/tracked.json' })).resolves.toBe(
        'handled',
      );
      await expect(access(tracked)).rejects.toThrow();
      await expect(access(untracked)).resolves.toBeUndefined();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('treats a repeated deletion as a safe no-op', async () => {
    const root = await temporaryDirectory();
    const storage = new LocalRetentionStorage(root);
    const location = 'uploads/expired.csv';
    await mkdir(join(root, 'uploads'), { recursive: true });
    await writeFile(join(root, location), 'id,name');

    try {
      await expect(storage.delete({ storageKind: 'local', storageLocation: location })).resolves.toBe('handled');
      await expect(storage.delete({ storageKind: 'local', storageLocation: location })).resolves.toBe('handled');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects path traversal and leaves a path outside the configured root untouched', async () => {
    const parent = await temporaryDirectory();
    const root = join(parent, 'storage');
    const outside = join(parent, 'outside.txt');
    const storage = new LocalRetentionStorage(root);
    await mkdir(root, { recursive: true });
    await writeFile(outside, 'must remain');

    try {
      await expect(storage.delete({ storageKind: 'local', storageLocation: '../outside.txt' })).rejects.toThrow(
        'escapes the configured root',
      );
      await expect(access(outside)).resolves.toBeUndefined();
    } finally {
      await rm(parent, { force: true, recursive: true });
    }
  });
});

/** Creates one isolated directory for a filesystem cleanup test. */
function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'pantaetl-gc-'));
}
