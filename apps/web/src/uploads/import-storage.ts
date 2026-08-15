import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

/** Where one accepted upload came to rest, described for both execution and retention. */
export interface StoredImport {
  /** The location a Source component resolves, relative to the import directory. */
  readonly sourcePath: string;
  /** The location retention resolves, relative to the configured storage root. */
  readonly storageLocation: string;
}

/** The directory beneath the storage root that Source components read from. */
export const IMPORT_DIRECTORY = "imports";

/** The subdirectory of the import directory that holds browser-supplied files. */
const UPLOAD_DIRECTORY = "uploads";

export { resolveStorageRoot } from "@pantaetl/config";

/**
 * Writes browser-supplied files into the directory file Sources read from.
 *
 * The stored name is generated rather than taken from the request, so a hostile
 * file name cannot decide where bytes land, collide with an existing import, or
 * overwrite one operator's file with another's. Only the extension survives from
 * the client, because components and operators both rely on it to recognize the
 * format. The resolved destination is checked against the root a second time so
 * a future change to the naming scheme cannot silently reintroduce an escape.
 */
export class LocalImportStorage {
  private readonly storageRoot: string;

  /** Binds the writer to the storage root that holds the import directory. */
  public constructor(storageRoot: string) {
    this.storageRoot = resolve(storageRoot);
  }

  /**
   * Stores one uploaded file and reports where it landed.
   *
   * Creates the destination directory when it is missing, so a deployment does
   * not have to pre-create anything for the first upload to succeed.
   */
  public async store(originalFileName: string, contents: Uint8Array): Promise<StoredImport> {
    const storedName = `${randomUUID()}${safeExtension(originalFileName)}`;
    const sourcePath = `${UPLOAD_DIRECTORY}/${storedName}`;
    const storageLocation = `${IMPORT_DIRECTORY}/${sourcePath}`;
    const destination = this.resolveWithinRoot(storageLocation);

    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents, { flag: "wx" });

    return { sourcePath, storageLocation };
  }

  /** Resolves a storage-root-relative location, refusing anything that leaves the root. */
  private resolveWithinRoot(location: string): string {
    const destination = resolve(this.storageRoot, join(...location.split("/")));
    const destinationRelativeToRoot = relative(this.storageRoot, destination);

    if (
      destinationRelativeToRoot.length === 0 ||
      destinationRelativeToRoot === ".." ||
      destinationRelativeToRoot.startsWith(`..${sep}`)
    ) {
      throw new Error("Import location escapes the configured storage root.");
    }

    return destination;
  }
}

/**
 * Keeps a recognizable, harmless extension from a client-supplied file name.
 *
 * A name carrying no extension, a suspiciously long one, or anything outside a
 * conservative character set yields no extension at all rather than a guess.
 */
function safeExtension(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,12}$/.test(extension) ? extension : "";
}
