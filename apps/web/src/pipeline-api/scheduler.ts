import {
  pipelineRunResponseSchema,
  type PipelineRunResponse,
} from "@pantaetl/contracts";

/** Server-only configuration for the authenticated scheduler run endpoint. */
export interface PipelineSchedulerConfig {
  readonly internalToken: string;
  readonly runUrl: string;
}

/** A safe scheduler conflict that pipeline HTTP routes can map without parsing messages. */
export class PipelineSchedulerConflictError extends Error {
  /** Stable reason supplied by the authenticated scheduler boundary. */
  readonly code: "pipeline_locked" | "pipeline_not_enabled" | "pipeline_not_found";

  /** Creates a route-safe scheduler rejection. */
  constructor(code: PipelineSchedulerConflictError["code"]) {
    super("The pipeline action could not be completed.");
    this.name = "PipelineSchedulerConflictError";
    this.code = code;
  }
}

/** Read server-only scheduler credentials and constrain the internal endpoint URL. */
export function loadPipelineSchedulerConfig(environment: NodeJS.ProcessEnv = process.env): PipelineSchedulerConfig {
  const internalToken = environment.SCHEDULER_INTERNAL_TOKEN?.trim();
  if (!internalToken || internalToken.length < 32) {
    throw new Error("SCHEDULER_INTERNAL_TOKEN must contain at least 32 characters.");
  }

  const runUrl = readSchedulerRunUrl(environment.SCHEDULER_RUN_URL);
  return { internalToken, runUrl };
}

/** Enqueue a manually triggered run through the scheduler's authenticated service boundary. */
export async function enqueuePipelineRun(
  configuration: PipelineSchedulerConfig,
  input: { readonly ownerUserId: string; readonly pipelineId: string },
  fetchImplementation: typeof fetch = fetch,
): Promise<PipelineRunResponse> {
  const response = await fetchImplementation(configuration.runUrl, {
    body: JSON.stringify(input),
    headers: {
      authorization: `Bearer ${configuration.internalToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (response.ok) {
    return pipelineRunResponseSchema.parse(await response.json());
  }

  const code = await readConflictCode(response);
  if (code) {
    throw new PipelineSchedulerConflictError(code);
  }

  throw new Error("The scheduler did not accept the pipeline run request.");
}

/** Restrict the scheduler target to a credential-free, fixed internal service endpoint. */
function readSchedulerRunUrl(value: string | undefined): string {
  let url: URL;
  try {
    url = new URL(value?.trim() || "http://127.0.0.1:3010/internal/pipeline-runs");
  } catch {
    throw new Error("SCHEDULER_RUN_URL must be a valid internal scheduler URL.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:")
    || url.username.length > 0
    || url.password.length > 0
    || url.pathname !== "/internal/pipeline-runs"
    || url.search.length > 0
    || url.hash.length > 0
  ) {
    throw new Error("SCHEDULER_RUN_URL must be a credential-free HTTP URL ending in /internal/pipeline-runs.");
  }

  return url.toString();
}

/** Read only safe, documented scheduler conflict codes from a non-success response. */
async function readConflictCode(response: Response): Promise<PipelineSchedulerConflictError["code"] | undefined> {
  if (response.status !== 404 && response.status !== 409) {
    return undefined;
  }

  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || Array.isArray(body) || !("code" in body)) {
      return undefined;
    }

    const code = body.code;
    return code === "pipeline_locked" || code === "pipeline_not_enabled" || code === "pipeline_not_found"
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}
