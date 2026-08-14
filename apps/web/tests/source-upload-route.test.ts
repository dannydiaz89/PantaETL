import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DatabaseClient } from "@pantaetl/database";
import { describe, expect, it, vi } from "vitest";

import {
  createSourceUploadRouteHandlers,
  MAXIMUM_UPLOAD_BYTES,
  UPLOAD_RETENTION_HOURS,
  type SourceUploadRouteDependencies,
} from "../src/uploads/collection-route.js";
import { IMPORT_DIRECTORY, LocalImportStorage } from "../src/uploads/import-storage.js";

const ownerUserId = "123e4567-e89b-12d3-a456-426614174000";
const uploadedAt = new Date("2026-08-14T10:00:00.000Z");

describe("source upload route", () => {
  it("refuses to stage anything for a signed-out caller", async () => {
    const dependencies = await createDependencies({ session: null });
    const handlers = createSourceUploadRouteHandlers(dependencies);

    const response = await handlers.POST({ request: uploadRequest("orders.csv", "id,total\n1,2\n") });

    expect(response.status).toBe(401);
    expect(dependencies.createStagedUpload).not.toHaveBeenCalled();
    expect(dependencies.storage.store).not.toHaveBeenCalled();
  });

  it("stages an accepted file and reports the path a source reads", async () => {
    const dependencies = await createDependencies();
    const handlers = createSourceUploadRouteHandlers(dependencies);

    const response = await handlers.POST({ request: uploadRequest("orders.csv", "id,total\n1,2\n") });

    expect(response.status).toBe(201);
    const body = await response.json() as { sourcePath: string; fileName: string; byteSize: number; expiresAt: string };
    expect(body.fileName).toBe("orders.csv");
    expect(body.byteSize).toBe("id,total\n1,2\n".length);
    expect(body.sourcePath).toMatch(/^uploads\/[0-9a-f-]{36}\.csv$/);
    expect(body.expiresAt).toBe(new Date(uploadedAt.getTime() + UPLOAD_RETENTION_HOURS * 3_600_000).toISOString());
  });

  it("writes the file where the source input root resolves it", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "pantaetl-uploads-"));
    const dependencies = await createDependencies({ storageRoot });
    const handlers = createSourceUploadRouteHandlers(dependencies);

    const response = await handlers.POST({ request: uploadRequest("orders.csv", "id,total\n1,2\n") });
    const { sourcePath } = await response.json() as { sourcePath: string };

    await expect(readFile(join(storageRoot, IMPORT_DIRECTORY, sourcePath), "utf8"))
      .resolves.toBe("id,total\n1,2\n");
  });

  it("records a durable owner and expiry so retention can reclaim an unclaimed file", async () => {
    const dependencies = await createDependencies();
    const handlers = createSourceUploadRouteHandlers(dependencies);

    const response = await handlers.POST({ request: uploadRequest("orders.csv", "id,total\n1,2\n") });
    const { sourcePath } = await response.json() as { sourcePath: string };

    expect(dependencies.createStagedUpload).toHaveBeenCalledWith(dependencies.database, {
      expiresAt: new Date(uploadedAt.getTime() + UPLOAD_RETENTION_HOURS * 3_600_000),
      ownerUserId,
      storageKind: "local",
      storageLocation: `${IMPORT_DIRECTORY}/${sourcePath}`,
    });
  });

  it("rejects a file type no built-in source can read", async () => {
    const dependencies = await createDependencies();
    const handlers = createSourceUploadRouteHandlers(dependencies);

    const response = await handlers.POST({ request: uploadRequest("payload.sh", "#!/bin/sh\n") });

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ code: "unsupported_upload_type" });
    expect(dependencies.storage.store).not.toHaveBeenCalled();
    expect(dependencies.createStagedUpload).not.toHaveBeenCalled();
  });

  it("rejects a file beyond the accepted size before writing anything", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "pantaetl-uploads-"));
    const dependencies = await createDependencies({ storageRoot });
    const handlers = createSourceUploadRouteHandlers(dependencies);

    const response = await handlers.POST({
      request: uploadRequest("huge.csv", "x".repeat(MAXIMUM_UPLOAD_BYTES + 1)),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ code: "upload_too_large" });
    await expect(readdir(join(storageRoot, IMPORT_DIRECTORY, "uploads"))).rejects.toThrow();
  });

  it("treats a request carrying no file as invalid input", async () => {
    const dependencies = await createDependencies();
    const handlers = createSourceUploadRouteHandlers(dependencies);

    const response = await handlers.POST({
      request: new Request("https://pantaetl.test/api/uploads", { body: new FormData(), method: "POST" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "invalid_upload_request" });
  });
});

/** Builds an upload request carrying one named file, as a browser form submission would. */
function uploadRequest(fileName: string, contents: string): Request {
  const body = new FormData();
  body.set("file", new File([contents], fileName));
  return new Request("https://pantaetl.test/api/uploads", { body, method: "POST" });
}

/** Assembles route dependencies against a real temporary storage root. */
async function createDependencies({
  session = { user: { id: ownerUserId } },
  storageRoot,
}: {
  session?: { user: { id: string } } | null;
  storageRoot?: string;
} = {}): Promise<SourceUploadRouteDependencies & {
  createStagedUpload: ReturnType<typeof vi.fn>;
  storage: { store: ReturnType<typeof vi.fn> };
}> {
  const root = storageRoot ?? await mkdtemp(join(tmpdir(), "pantaetl-uploads-"));
  const realStorage = new LocalImportStorage(root);

  return {
    createStagedUpload: vi.fn().mockResolvedValue({ id: "723e4567-e89b-12d3-a456-426614174000" }),
    database: {} as DatabaseClient,
    getSession: () => Promise.resolve(session),
    now: () => uploadedAt,
    storage: { store: vi.fn((name: string, contents: Uint8Array) => realStorage.store(name, contents)) },
  };
}
