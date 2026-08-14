import { sourceUploadResponseSchema, type SourceUploadResponse } from "@pantaetl/contracts";

/** Stable categories for safe failures returned by the source upload HTTP boundary. */
export type SourceUploadApiErrorCode =
  | "invalid_response"
  | "network_error"
  | "unauthenticated"
  | "unknown_error"
  | "unsupported_upload_type"
  | "upload_too_large";

/** Structured HTTP failure that lets feature UI select a localized message. */
export class SourceUploadApiError extends Error {
  public constructor(
    public readonly code: SourceUploadApiErrorCode,
    public readonly status: number | undefined,
  ) {
    super(code);
    this.name = "SourceUploadApiError";
  }
}

/** Fetch implementation used by the browser source upload client. */
export type SourceUploadApiFetch = typeof fetch;

/** Typed browser client for staging a file that a file-backed Source will read. */
export interface SourceUploadApiClient {
  readonly upload: (file: File) => Promise<SourceUploadResponse>;
}

/**
 * Creates an upload client that validates the response at the same-origin HTTP boundary.
 *
 * Size and type limits are enforced by the control plane rather than here, so a
 * client that skips this module cannot bypass them; the codes it returns exist so
 * the builder can explain a rejection instead of failing silently.
 */
export function createSourceUploadApiClient(
  requestFetch: SourceUploadApiFetch = fetch,
): SourceUploadApiClient {
  return {
    upload: async (file) => {
      const body = new FormData();
      body.set("file", file);

      let response: Response;
      try {
        response = await requestFetch("/api/uploads", { body, credentials: "same-origin", method: "POST" });
      } catch {
        throw new SourceUploadApiError("network_error", undefined);
      }

      if (!response.ok) {
        throw new SourceUploadApiError(uploadErrorCode(response.status), response.status);
      }

      const parsed = sourceUploadResponseSchema.safeParse(await parseJsonResponse(response));
      if (!parsed.success) {
        throw new SourceUploadApiError("invalid_response", response.status);
      }

      return parsed.data;
    },
  };
}

/** Creates the default browser client used by the pipeline builder. */
export const sourceUploadApiClient = createSourceUploadApiClient();

/** Returns whether an unknown error carries the safe code and status used by upload UI. */
export function isSourceUploadApiError(error: unknown): error is SourceUploadApiError {
  return error instanceof SourceUploadApiError;
}

/** Maps a rejection status to the stable code the builder explains to the operator. */
function uploadErrorCode(status: number): SourceUploadApiErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 413) return "upload_too_large";
  if (status === 415) return "unsupported_upload_type";
  return "unknown_error";
}

/** Reads successful JSON while treating an absent or malformed document as invalid. */
async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new SourceUploadApiError("invalid_response", response.status);
  }
}
