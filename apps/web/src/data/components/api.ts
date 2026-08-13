import {
  componentCapabilityListRequestSchema,
  componentCapabilityListResponseSchema,
  type ComponentCapabilityListRequest,
  type ComponentCapabilityListResponse,
} from "@pantaetl/contracts";

/** Stable categories for safe failures returned by the component capability HTTP boundary. */
export type ComponentCapabilityApiErrorCode =
  | "invalid_component_capability_request"
  | "invalid_response"
  | "network_error"
  | "unauthenticated"
  | "unknown_error";

/** Structured HTTP failure that lets feature UI select a localized message. */
export class ComponentCapabilityApiError extends Error {
  public constructor(
    public readonly code: ComponentCapabilityApiErrorCode,
    public readonly status: number | undefined,
  ) {
    super(code);
    this.name = "ComponentCapabilityApiError";
  }
}

/** Fetch implementation used by the browser component capability API client. */
export type ComponentCapabilityApiFetch = typeof fetch;

/** Minimal validation boundary required for canonical request and response validators. */
interface ResponseSchema<T> {
  safeParse(value: unknown):
    | { readonly data: T; readonly success: true }
    | { readonly success: false };
}

/** Typed browser client for the authenticated component capability collection. */
export interface ComponentCapabilityApiClient {
  readonly list: (request?: ComponentCapabilityListRequest) => Promise<ComponentCapabilityListResponse>;
}

/** Creates a capability client that validates input and output at the same-origin HTTP boundary. */
export function createComponentCapabilityApiClient(
  requestFetch: ComponentCapabilityApiFetch = fetch,
): ComponentCapabilityApiClient {
  return {
    list: async (request = {}) => {
      const parsedRequest = parseRequest(componentCapabilityListRequestSchema, request);
      const query = parsedRequest.kind === undefined ? "" : `?${new URLSearchParams({ kind: parsedRequest.kind })}`;
      return requestJson(
        requestFetch,
        `/api/components${query}`,
        componentCapabilityListResponseSchema,
      );
    },
  };
}

/** Creates the default browser client used by capability queries. */
export const componentCapabilityApiClient = createComponentCapabilityApiClient();

/** Returns whether an unknown error carries the safe code and status used by capability UI. */
export function isComponentCapabilityApiError(error: unknown): error is ComponentCapabilityApiError {
  return error instanceof ComponentCapabilityApiError;
}

/** Validates caller-controlled input without retaining parser diagnostics in UI error state. */
function parseRequest<T>(schema: ResponseSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ComponentCapabilityApiError("invalid_component_capability_request", undefined);
  }

  return parsed.data;
}

/** Makes an authenticated same-origin request and validates the successful JSON response. */
async function requestJson<T>(
  requestFetch: ComponentCapabilityApiFetch,
  path: string,
  responseSchema: ResponseSchema<T>,
): Promise<T> {
  const response = await request(requestFetch, path);
  const body = await parseJsonResponse(response);
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ComponentCapabilityApiError("invalid_response", response.status);
  }

  return parsed.data;
}

/** Sends a request and maps transport and non-success responses to stable safe errors. */
async function request(requestFetch: ComponentCapabilityApiFetch, path: string): Promise<Response> {
  let response: Response;
  try {
    response = await requestFetch(path, { credentials: "same-origin", method: "GET" });
  } catch {
    throw new ComponentCapabilityApiError("network_error", undefined);
  }

  if (response.ok) return response;

  throw new ComponentCapabilityApiError(await parseErrorCode(response), response.status);
}

/** Parses only stable API error codes without retaining error-body details in browser state. */
async function parseErrorCode(response: Response): Promise<ComponentCapabilityApiErrorCode> {
  if (response.status === 401) return "unauthenticated";

  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body && body.code === "invalid_component_capability_request") {
      return body.code;
    }
  } catch {
    // The API is allowed to return an empty error response.
  }

  return "unknown_error";
}

/** Reads successful JSON while treating an absent or malformed document as invalid. */
async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ComponentCapabilityApiError("invalid_response", response.status);
  }
}
