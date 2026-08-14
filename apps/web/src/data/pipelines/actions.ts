import {
  pipelineDetailRequestSchema,
  pipelineDuplicateBodyRequestSchema,
  pipelineDuplicateRequestSchema,
  pipelineDuplicateResponseSchema,
  pipelineExecutionStateResponseSchema,
  pipelineRunResponseSchema,
  pipelineStateActionResponseSchema,
  type Pipeline,
  type PipelineDetailRequest,
  type PipelineDuplicateRequest,
  type PipelineExecutionStateResponse,
  type PipelineRunResponse,
} from "@pantaetl/contracts";

import { PipelineApiError, type PipelineApiFetch } from "./api.js";

/** Browser client for owner-scoped pipeline actions that change execution or availability state. */
export interface PipelineActionApiClient {
  readonly disable: (request: PipelineDetailRequest) => Promise<Pipeline>;
  readonly duplicate: (request: PipelineDuplicateRequest) => Promise<Pipeline>;
  readonly enable: (request: PipelineDetailRequest) => Promise<Pipeline>;
  readonly getExecutionState: (request: PipelineDetailRequest) => Promise<PipelineExecutionStateResponse>;
  readonly run: (request: PipelineDetailRequest) => Promise<PipelineRunResponse>;
}

/** Creates a validated browser client for the pipeline action endpoints. */
export function createPipelineActionApiClient(requestFetch: PipelineApiFetch = fetch): PipelineActionApiClient {
  return {
    disable: (request) => requestPipelineAction(requestFetch, request, "disable"),
    duplicate: async (request) => {
      const parsed = parseRequest(pipelineDuplicateRequestSchema, request);
      const body = parseRequest(pipelineDuplicateBodyRequestSchema, { name: parsed.name });
      return requestJson(requestFetch, `/api/pipelines/${encodeURIComponent(parsed.pipelineId)}/duplicate`, {
        body: JSON.stringify(body),
        method: "POST",
      }, pipelineDuplicateResponseSchema);
    },
    enable: (request) => requestPipelineAction(requestFetch, request, "enable"),
    getExecutionState: async (request) => {
      const parsed = parseRequest(pipelineDetailRequestSchema, request);
      return requestJson(requestFetch, `/api/pipelines/${encodeURIComponent(parsed.pipelineId)}/execution-state`, {
        method: "GET",
      }, pipelineExecutionStateResponseSchema);
    },
    run: async (request) => {
      const parsed = parseRequest(pipelineDetailRequestSchema, request);
      return requestJson(requestFetch, `/api/pipelines/${encodeURIComponent(parsed.pipelineId)}/run`, {
        method: "POST",
      }, pipelineRunResponseSchema);
    },
  };
}

/** Default action client used by the pipeline action mutations. */
export const pipelineActionApiClient = createPipelineActionApiClient();

/** Performs one action that returns the resulting canonical pipeline graph. */
function requestPipelineAction(
  requestFetch: PipelineApiFetch,
  request: PipelineDetailRequest,
  action: "disable" | "enable",
): Promise<Pipeline> {
  const parsed = parseRequest(pipelineDetailRequestSchema, request);
  return requestJson(requestFetch, `/api/pipelines/${encodeURIComponent(parsed.pipelineId)}/${action}`, {
    method: "POST",
  }, pipelineStateActionResponseSchema);
}

/** Minimal validator surface shared by canonical request and response schemas. */
interface ResponseSchema<T> {
  safeParse(value: unknown):
    | { readonly data: T; readonly success: true }
    | { readonly success: false };
}

/** Validates caller-provided data without carrying diagnostics into application state. */
function parseRequest<T>(schema: ResponseSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new PipelineApiError("invalid_pipeline_request", undefined);
  return parsed.data;
}

/** Makes an action request and validates its JSON response at the browser boundary. */
async function requestJson<T>(
  requestFetch: PipelineApiFetch,
  path: string,
  init: RequestInit,
  responseSchema: ResponseSchema<T>,
): Promise<T> {
  const response = await request(requestFetch, path, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PipelineApiError("invalid_response", response.status);
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new PipelineApiError("invalid_response", response.status);
  return parsed.data;
}

/** Sends a same-origin action request and maps public action failures to safe UI error codes. */
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

/** Reads only documented error codes and deliberately discards all response diagnostics. */
async function parseErrorCode(response: Response): Promise<PipelineApiError["code"]> {
  if (response.status === 401) return "unauthenticated";

  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body && typeof body.code === "string") {
      if (["pipeline_locked", "pipeline_not_enabled", "pipeline_not_found"].includes(body.code)) {
        return body.code as PipelineApiError["code"];
      }
    }
  } catch {
    // The route may return no JSON document for an error.
  }

  return "unknown_error";
}
