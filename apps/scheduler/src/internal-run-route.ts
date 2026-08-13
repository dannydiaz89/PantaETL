import { timingSafeEqual } from "node:crypto";

import {
  pipelineRunResponseSchema,
  pipelineIdSchema,
  userIdSchema,
} from "@pantaetl/contracts";
import {
  PipelineActionConflictError,
  type DatabaseClient,
  type PipelineActionInput,
} from "@pantaetl/database";

import { enqueuePipelineRunForOwner } from "./pipeline-actions.js";

/** Dependencies required to safely serve one control-plane run-enqueue request. */
export interface InternalPipelineRunRouteDependencies {
  /** Authenticates the web control plane before it may request scheduling work. */
  readonly internalToken: string;
  /** Scheduler database client used by the owner-scoped action service. */
  readonly database: DatabaseClient;
  /** Creates a durable run through the scheduler's queue boundary. */
  readonly enqueuePipelineRunForOwner: typeof enqueuePipelineRunForOwner;
}

/** Builds the authenticated internal endpoint that creates one manual pipeline run. */
export function createInternalPipelineRunRouteHandler(dependencies: InternalPipelineRunRouteDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405 });
    }

    if (!hasValidInternalToken(request.headers.get("authorization"), dependencies.internalToken)) {
      return new Response(null, { status: 401 });
    }

    const input = await parseActionInput(request);
    if (!input) {
      return Response.json({ code: "invalid_pipeline_request" }, { status: 400 });
    }

    try {
      const run = await dependencies.enqueuePipelineRunForOwner(dependencies.database, input);
      return Response.json(pipelineRunResponseSchema.parse(run));
    } catch (error) {
      return actionErrorResponse(error);
    }
  };
}

/** Compare the complete bearer token in constant time without accepting malformed credentials. */
function hasValidInternalToken(header: string | null, expectedToken: string): boolean {
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix)) {
    return false;
  }

  const received = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(expectedToken);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Parse only the trusted identity values required by the owner-scoped scheduler service. */
async function parseActionInput(request: Request): Promise<PipelineActionInput | undefined> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return undefined;
    }

    const input = body as { ownerUserId?: unknown; pipelineId?: unknown };
    if (Object.keys(input).length !== 2 || !("ownerUserId" in input) || !("pipelineId" in input)) {
      return undefined;
    }

    const ownerUserId = userIdSchema.safeParse(input.ownerUserId);
    const pipelineId = pipelineIdSchema.safeParse(input.pipelineId);
    if (!ownerUserId.success || !pipelineId.success) {
      return undefined;
    }

    return { ownerUserId: ownerUserId.data as string, pipelineId: pipelineId.data as string };
  } catch {
    return undefined;
  }
}

/** Map domain conflicts to safe internal responses for the authenticated control plane. */
function actionErrorResponse(error: unknown): Response {
  if (error instanceof PipelineActionConflictError) {
    const code = error.reason === "locked" ? "pipeline_locked" : error.reason === "not_enabled"
      ? "pipeline_not_enabled"
      : "pipeline_not_found";
    return Response.json({ code }, { status: error.reason === "not_found" ? 404 : 409 });
  }

  throw error;
}
