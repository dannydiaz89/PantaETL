import {
  deletePipeline,
  getPipeline,
  InvalidPipelineTopologyError,
  PipelineDeletionHasRunHistoryError,
  PipelineDeletionLockedError,
  updatePipeline,
  type DatabaseClient,
} from "@pantaetl/database";
import {
  pipelineDetailRequestSchema,
  pipelineDetailResponseSchema,
  pipelineUpdateRequestSchema,
  pipelineUpdateResponseSchema,
  type PipelineUpdateRequest,
} from "@pantaetl/contracts";
import { PipelineStateTransitionError } from "@pantaetl/pipeline";

import { claimPipelineUploads } from "../uploads/pipeline-claims.js";

/** Minimal authenticated identity required for owner-scoped pipeline operations. */
export interface PipelineApiSession {
  readonly user: {
    readonly id: string;
  };
}

/** Parameters supplied by the router for a request targeting one pipeline. */
export interface PipelineDetailRouteInput {
  readonly params: {
    readonly pipelineId: string;
  };
  readonly request: Request;
}

/** Dependencies used by the pipeline detail HTTP boundary. */
export interface PipelineDetailRouteDependencies {
  readonly database: DatabaseClient;
  readonly deletePipeline: typeof deletePipeline;
  readonly getSession: (headers: Headers) => Promise<PipelineApiSession | null>;
  readonly getPipeline: typeof getPipeline;
  readonly updatePipeline: typeof updatePipeline;
  /** Stops retention from collecting files the saved pipeline now reads. */
  readonly claimUploads?: typeof claimPipelineUploads;
}

/** Builds authenticated owner-scoped handlers for one pipeline resource. */
export function createPipelineDetailRouteHandlers(dependencies: PipelineDetailRouteDependencies) {
  const claimUploads = dependencies.claimUploads ?? claimPipelineUploads;

  return {
    DELETE: async (input: PipelineDetailRouteInput): Promise<Response> => {
      const session = await dependencies.getSession(input.request.headers);
      if (session === null) return unauthenticatedResponse();

      const detailRequest = parseDetailRequest(input.params.pipelineId);
      if (!detailRequest) return invalidRequestResponse();

      try {
        const deleted = await dependencies.deletePipeline(dependencies.database, {
          ownerUserId: session.user.id,
          pipelineId: detailRequest.pipelineId,
        });
        return deleted ? new Response(null, { status: 204 }) : notFoundResponse();
      } catch (error) {
        return deletionErrorResponse(error);
      }
    },
    GET: async (input: PipelineDetailRouteInput): Promise<Response> => {
      const session = await dependencies.getSession(input.request.headers);
      if (session === null) return unauthenticatedResponse();

      const detailRequest = parseDetailRequest(input.params.pipelineId);
      if (!detailRequest) return invalidRequestResponse();

      const pipeline = await dependencies.getPipeline(dependencies.database, {
        ownerUserId: session.user.id,
        pipelineId: detailRequest.pipelineId,
      });
      if (!pipeline) return notFoundResponse();

      return Response.json(pipelineDetailResponseSchema.parse(pipeline));
    },
    PATCH: async (input: PipelineDetailRouteInput): Promise<Response> => {
      const session = await dependencies.getSession(input.request.headers);
      if (session === null) return unauthenticatedResponse();

      const detailRequest = parseDetailRequest(input.params.pipelineId);
      const updateRequest = await parseUpdateRequest(input.request);
      if (!detailRequest || !updateRequest) return invalidRequestResponse();

      try {
        const pipeline = await dependencies.updatePipeline(dependencies.database, {
          ownerUserId: session.user.id,
          pipelineId: detailRequest.pipelineId,
          update: updateRequest,
        });
        if (!pipeline) return notFoundResponse();

        await claimUploads(dependencies.database, session.user.id, pipeline);
        return Response.json(pipelineUpdateResponseSchema.parse(pipeline));
      } catch (error) {
        return updateErrorResponse(error);
      }
    },
  };
}

/** Validate an untrusted path value before it becomes an owner-scoped repository input. */
function parseDetailRequest(pipelineId: string) {
  const result = pipelineDetailRequestSchema.safeParse({ pipelineId });
  return result.success ? result.data : undefined;
}

/** Read and validate a strict update document without accepting malformed JSON. */
async function parseUpdateRequest(request: Request): Promise<PipelineUpdateRequest | undefined> {
  try {
    const result = pipelineUpdateRequestSchema.safeParse(await request.json());
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** Use the same safe response for an absent and an inaccessible pipeline. */
function notFoundResponse(): Response {
  return Response.json({ code: "pipeline_not_found" }, { status: 404 });
}

/** Reject malformed path or update input without including parser details. */
function invalidRequestResponse(): Response {
  return Response.json({ code: "invalid_pipeline_request" }, { status: 400 });
}

/** Avoid attempting any owner-scoped access without an authenticated session. */
function unauthenticatedResponse(): Response {
  return new Response(null, { status: 401 });
}

/** Map only known graph and execution failures to safe client-facing statuses. */
function updateErrorResponse(error: unknown): Response {
  if (error instanceof InvalidPipelineTopologyError) return invalidRequestResponse();
  if (error instanceof PipelineStateTransitionError) return conflictResponse("pipeline_locked");
  throw error;
}

/** Map only known destructive-operation conflicts to safe client-facing statuses. */
function deletionErrorResponse(error: unknown): Response {
  if (error instanceof PipelineDeletionLockedError) return conflictResponse("pipeline_locked");
  if (error instanceof PipelineDeletionHasRunHistoryError) return conflictResponse("pipeline_has_run_history");
  throw error;
}

/** Return a generic conflict payload that does not disclose pipeline configuration. */
function conflictResponse(code: "pipeline_has_run_history" | "pipeline_locked"): Response {
  return Response.json({ code }, { status: 409 });
}
