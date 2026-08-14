import { sourceUploadResponseSchema } from "@pantaetl/contracts";
import { createStagedUpload, type DatabaseClient } from "@pantaetl/database";

import type { LocalImportStorage } from "./import-storage.js";

/** The largest file the control plane will accept in one upload. */
export const MAXIMUM_UPLOAD_BYTES = 100 * 1024 * 1024;

/** How long an uploaded file survives before retention reclaims it unclaimed. */
export const UPLOAD_RETENTION_HOURS = 24;

/**
 * File types a file-backed Source can actually read.
 *
 * Restricting the accepted set keeps internal storage from becoming a general
 * file drop: an operator can only stage something a Source could consume.
 */
const PERMITTED_EXTENSIONS: readonly string[] = [".csv", ".tsv", ".json", ".xlsx", ".xls"];

/** The form field carrying the uploaded file. */
const FILE_FIELD = "file";

/** Minimal authenticated identity required to stage a file. */
export interface SourceUploadSession {
  readonly user: {
    readonly id: string;
  };
}

/** Dependencies for the authenticated source upload route handler. */
export interface SourceUploadRouteDependencies {
  /** Records durable owner and expiry metadata for a staged file. */
  readonly createStagedUpload: typeof createStagedUpload;
  /** Shared control-plane database connection. */
  readonly database: DatabaseClient;
  /** Resolves the signed-in user from request session headers. */
  readonly getSession: (request: Request) => Promise<SourceUploadSession | null>;
  /** Writes accepted files into the directory file Sources read from. */
  readonly storage: Pick<LocalImportStorage, "store">;
  /** Supplies the current time, so expiry is testable. */
  readonly now?: () => Date;
}

/** Request context required by the upload route's server handler. */
export interface SourceUploadRouteContext {
  readonly request: Request;
}

/**
 * Builds the authenticated handler that stages a file for a file-backed Source.
 *
 * The file is written before its metadata row exists, because a row pointing at
 * nothing would be indistinguishable from one whose file retention already
 * collected. Every accepted file carries an owner and an expiry, so a staged
 * file that no pipeline ever references is reclaimed rather than accumulating.
 */
export function createSourceUploadRouteHandlers(dependencies: SourceUploadRouteDependencies) {
  const now = dependencies.now ?? (() => new Date());

  return {
    /** Stores one uploaded file and reports the source path that reads it. */
    POST: async ({ request }: SourceUploadRouteContext): Promise<Response> => {
      const session = await dependencies.getSession(request);
      if (session === null) {
        return new Response(null, { status: 401 });
      }

      const file = await readUploadedFile(request);
      if (file === null) {
        return uploadRejectedResponse("invalid_upload_request");
      }

      if (file.size > MAXIMUM_UPLOAD_BYTES) {
        return uploadRejectedResponse("upload_too_large", 413);
      }

      if (!hasPermittedExtension(file.name)) {
        return uploadRejectedResponse("unsupported_upload_type", 415);
      }

      const contents = new Uint8Array(await file.arrayBuffer());
      if (contents.byteLength > MAXIMUM_UPLOAD_BYTES) {
        return uploadRejectedResponse("upload_too_large", 413);
      }

      const stored = await dependencies.storage.store(file.name, contents);
      const expiresAt = new Date(now().getTime() + UPLOAD_RETENTION_HOURS * 60 * 60 * 1000);

      await dependencies.createStagedUpload(dependencies.database, {
        ownerUserId: session.user.id,
        storageKind: "local",
        storageLocation: stored.storageLocation,
        expiresAt,
      });

      const response = sourceUploadResponseSchema.parse({
        sourcePath: stored.sourcePath,
        fileName: file.name,
        byteSize: contents.byteLength,
        expiresAt: expiresAt.toISOString(),
      });
      return Response.json(response, { headers: { "cache-control": "no-store" }, status: 201 });
    },
  };
}

/** Reads the single uploaded file, treating a malformed or empty body as no file at all. */
async function readUploadedFile(request: Request): Promise<File | null> {
  try {
    const form = await request.formData();
    const file = form.get(FILE_FIELD);
    return file instanceof File && file.name.length > 0 ? file : null;
  } catch {
    return null;
  }
}

/** Accepts only the file types a built-in Source can read. */
function hasPermittedExtension(fileName: string): boolean {
  const lowercaseName = fileName.toLowerCase();
  return PERMITTED_EXTENSIONS.some((extension) => lowercaseName.endsWith(extension));
}

/** Returns a stable rejection code without echoing any client-supplied detail. */
function uploadRejectedResponse(code: string, status = 400): Response {
  return Response.json({ code }, { status });
}
