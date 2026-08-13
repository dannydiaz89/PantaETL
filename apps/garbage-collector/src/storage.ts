import { rm } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

/** Explicit metadata needed to remove one internally stored file. */
export interface StoredObject {
  readonly storageKind: 'local' | 's3';
  readonly storageLocation: string;
}

/** Result of an idempotent storage cleanup attempt. */
export type StorageCleanupResult = 'handled' | 'unsupported';

/** Storage boundary used by retention cleanup without scanning directory contents. */
export interface RetentionStorage {
  /** Removes exactly one storage object described by durable metadata. */
  delete(object: StoredObject): Promise<StorageCleanupResult>;
}

/**
 * Deletes explicitly tracked local files beneath one configured storage root.
 *
 * It never enumerates a directory or derives a deletion target from a file
 * name. Missing files are a successful no-op, allowing cleanup retries.
 */
export class LocalRetentionStorage implements RetentionStorage {
  private readonly root: string;

  public constructor(root: string) {
    this.root = resolve(root);
  }

  public async delete(object: StoredObject): Promise<StorageCleanupResult> {
    if (object.storageKind !== 'local') {
      return 'unsupported';
    }

    await rm(this.pathForLocation(object.storageLocation), { force: true });
    return 'handled';
  }

  /** Resolves a durable, root-relative storage location without allowing traversal. */
  private pathForLocation(location: string): string {
    if (location.length === 0 || location.includes('\\')) {
      throw new Error('Storage location must be a safe relative POSIX path.');
    }

    const path = resolve(this.root, location);
    const pathRelativeToRoot = relative(this.root, path);
    if (
      pathRelativeToRoot.length === 0 ||
      pathRelativeToRoot === '..' ||
      pathRelativeToRoot.startsWith(`..${sep}`)
    ) {
      throw new Error('Storage location escapes the configured root.');
    }

    return path;
  }
}
