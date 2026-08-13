import {
  pipelineCreateRequestSchema,
  pipelineCreateResponseSchema,
  pipelineDetailRequestSchema,
  pipelineDetailResponseSchema,
  pipelineListResponseSchema,
  pipelineUpdateRequestSchema,
  pipelineUpdateResponseSchema,
  type Pipeline,
  type PipelineCreateRequest,
  type PipelineDetailRequest,
  type PipelineListResponse,
  type PipelineUpdateRequest,
} from "@pantaetl/contracts";

/** Stable categories for safe errors returned by the pipeline HTTP boundary. */
export type PipelineApiErrorCode =
  | "invalid_pipeline_request"
  | "invalid_response"
  | "network_error"
  | "pipeline_has_run_history"
  | "pipeline_locked"
  | "pipeline_not_found"
  | "unauthenticated"
  | "unknown_error";

/** Structured HTTP failure that lets callers select a localized user-facing message. */
export class PipelineApiError extends Error {
  public constructor(
    public readonly code: PipelineApiErrorCode,
    public readonly status: number | undefined,
  ) {
    super(code);
    this.name = "PipelineApiError";
  }
}

/** Fetch implementation used by the browser pipeline API client. */
export type PipelineApiFetch = typeof fetch;

/** Minimal validation boundary required for canonical response validators. */
interface ResponseSchema<T> {
  safeParse(value: unknown):
    | { readonly data: T; readonly success: true }
    | { readonly success: false };
}

/** Typed browser client for authenticated owner-scoped pipeline endpoints. */
export interface PipelineApiClient {
  readonly create: (request: PipelineCreateRequest) => Promise<Pipeline>;
  readonly delete: (request: PipelineDetailRequest) => Promise<void>;
  readonly get: (request: PipelineDetailRequest) => Promise<Pipeline>;
  readonly list: () => Promise<PipelineListResponse>;
  readonly update: (request: PipelineDetailRequest & { readonly update: PipelineUpdateRequest }) => Promise<Pipeline>;
}

/** Creates a pipeline client that validates every request and response at the HTTP boundary. */
export function createPipelineApiClient(requestFetch: PipelineApiFetch = fetch): PipelineApiClient {
  return {
    create: async (request) => {
      const body = parseRequest(pipelineCreateRequestSchema, request);
      return requestJson(requestFetch, "/api/pipelines", {
        body: JSON.stringify(body),
        method: "POST",
      }, pipelineCreateResponseSchema);
    },
    delete: async (request) => {
      const { pipelineId } = parseRequest(pipelineDetailRequestSchema, request);
      await requestEmpty(requestFetch, `/api/pipelines/${encodeURIComponent(pipelineId)}`, { method: "DELETE" });
    },
    get: async (request) => {
      const { pipelineId } = parseRequest(pipelineDetailRequestSchema, request);
      return requestJson(requestFetch, `/api/pipelines/${encodeURIComponent(pipelineId)}`, { method: "GET" }, pipelineDetailResponseSchema);
    },
    list: async () => requestJson(requestFetch, "/api/pipelines", { method: "GET" }, pipelineListResponseSchema),
    update: async ({ pipelineId, update }) => {
      const detail = parseRequest(pipelineDetailRequestSchema, { pipelineId });
      const body = parseRequest(pipelineUpdateRequestSchema, update);
      return requestJson(requestFetch, `/api/pipelines/${encodeURIComponent(detail.pipelineId)}`, {
        body: JSON.stringify(body),
        method: "PATCH",
      }, pipelineUpdateResponseSchema);
    },
  };
}

/** Creates the default browser client used by pipeline queries and mutations. */
export const pipelineApiClient = createPipelineApiClient();

/** Returns whether an unknown error contains the safe API status and code used by UI state. */
export function isPipelineApiError(error: unknown): error is PipelineApiError {
  return error instanceof PipelineApiError;
}

/** Validates caller-controlled input without retaining validation diagnostics in UI error state. */
function parseRequest<T>(schema: ResponseSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new PipelineApiError("invalid_pipeline_request", undefined);
  }

  return parsed.data;
}

/** Makes an authenticated same-origin request and validates a successful JSON response. */
async function requestJson<T>(
  requestFetch: PipelineApiFetch,
  path: string,
  init: RequestInit,
  responseSchema: ResponseSchema<T>,
): Promise<T> {
  const response = await request(requestFetch, path, init);
  const body = await parseJsonResponse(response);
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new PipelineApiError("invalid_response", response.status);
  }

  return parsed.data;
}

/** Makes an authenticated same-origin request that succeeds with no response document. */
async function requestEmpty(requestFetch: PipelineApiFetch, path: string, init: RequestInit): Promise<void> {
  await request(requestFetch, path, init);
}

/** Sends a request and maps transport and non-success responses to safe structured errors. */
async function request(requestFetch: PipelineApiFetch, path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await requestFetch(path, {
      ...init,
      credentials: "same-origin",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    });
  } catch {
    throw new PipelineApiError("network_error", undefined);
  }

  if (response.ok) return response;

  throw new PipelineApiError(await parseErrorCode(response), response.status);
}

/** Parses only the stable API error code and never carries response diagnostics into application state. */
async function parseErrorCode(response: Response): Promise<PipelineApiErrorCode> {
  if (response.status === 401) return "unauthenticated";

  try {
    const body: unknown = await response.json();
    if (isPipelineApiErrorCode(body)) return body.code;
  } catch {
    // The API is allowed to return an empty error response.
  }

  return "unknown_error";
}

/** Reads a successful JSON response while treating an absent or malformed document as invalid. */
async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new PipelineApiError("invalid_response", response.status);
  }
}

/** Restricts parsed error payloads to the public error codes supported by this client. */
function isPipelineApiErrorCode(value: unknown): value is { readonly code: PipelineApiErrorCode } {
  if (typeof value !== "object" || value === null || !("code" in value) || typeof value.code !== "string") {
    return false;
  }

  return [
    "invalid_pipeline_request",
    "pipeline_has_run_history",
    "pipeline_locked",
    "pipeline_not_found",
  ].includes(value.code);
}
