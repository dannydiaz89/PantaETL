import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IMPORT_DIRECTORY, LocalImportStorage, resolveStorageRoot } from "../src/uploads/import-storage.js";

describe("local import storage", () => {
  it("stores a file beneath the import directory and reports both locations", async () => {
    const root = await mkdtemp(join(tmpdir(), "pantaetl-imports-"));
    const stored = await new LocalImportStorage(root).store("orders.csv", encode("id\n1\n"));

    expect(stored.storageLocation).toBe(`${IMPORT_DIRECTORY}/${stored.sourcePath}`);
    await expect(readFile(join(root, stored.storageLocation), "utf8")).resolves.toBe("id\n1\n");
  });

  it("never lets a client-supplied name decide where bytes land", async () => {
    const root = await mkdtemp(join(tmpdir(), "pantaetl-imports-"));
    const stored = await new LocalImportStorage(root).store("../../etc/passwd.csv", encode("id\n1\n"));

    expect(stored.sourcePath).toMatch(/^uploads\/[0-9a-f-]{36}\.csv$/);
    expect(stored.sourcePath).not.toContain("..");
    expect(stored.sourcePath).not.toContain("passwd");
    await expect(readFile(join(root, stored.storageLocation), "utf8")).resolves.toBe("id\n1\n");
  });

  it("gives two uploads of the same name distinct locations", async () => {
    const storage = new LocalImportStorage(await mkdtemp(join(tmpdir(), "pantaetl-imports-")));

    const first = await storage.store("orders.csv", encode("first"));
    const second = await storage.store("orders.csv", encode("second"));

    expect(first.sourcePath).not.toBe(second.sourcePath);
  });

  it("keeps a recognizable extension but drops an implausible one", async () => {
    const storage = new LocalImportStorage(await mkdtemp(join(tmpdir(), "pantaetl-imports-")));

    await expect(storage.store("workbook.XLSX", encode("x"))).resolves.toMatchObject({
      sourcePath: expect.stringMatching(/\.xlsx$/) as unknown as string,
    });
    await expect(storage.store("no-extension", encode("x"))).resolves.toMatchObject({
      sourcePath: expect.stringMatching(/^uploads\/[0-9a-f-]{36}$/) as unknown as string,
    });
    await expect(storage.store("odd.thisisnotanextension", encode("x"))).resolves.toMatchObject({
      sourcePath: expect.stringMatching(/^uploads\/[0-9a-f-]{36}$/) as unknown as string,
    });
  });

  it("reads the storage root shared with execution and retention", () => {
    expect(resolveStorageRoot({ STORAGE_ROOT: "/application/storage" })).toBe("/application/storage");
    expect(resolveStorageRoot({ STORAGE_ROOT: "   " })).toBe("/var/lib/pantaetl/storage");
    expect(resolveStorageRoot({})).toBe("/var/lib/pantaetl/storage");
  });
});

/** Encodes test content as the byte array the storage boundary accepts. */
function encode(contents: string): Uint8Array {
  return new TextEncoder().encode(contents);
}
