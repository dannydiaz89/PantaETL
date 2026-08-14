import {
  pipelineDuplicateRequestSchema,
  pipelineDuplicateBodyRequestSchema,
  pipelineDuplicateResponseSchema,
  pipelineRunRequestSchema,
  pipelineRunResponseSchema,
  pipelineStateActionRequestSchema,
  pipelineStateActionResponseSchema,
  type ComponentMetadata,
  type PipelineDuplicateRequest,
} from "@pantaetl/contracts";
import {
  disablePipelineForOwner,
  duplicatePipeline,
  enablePipelineForOwner,
  getPipeline,
  PipelineActionConflictError,
  type DatabaseClient,
  type PipelineActionInput,
  type PipelineStateActionResult,
} from "@pantaetl/database";

import { PipelineSchedulerConflictError } from "./scheduler.js";

/** Minimal signed-in identity required by pipeline action routes. */
export interface PipelineActionSession {
  readonly user: {
    readonly id: string;
  };
}

/** Router input for an action targeting one owner-scoped pipeline. */
export interface PipelineActionRouteInput {
  readonly params: {
    readonly pipelineId: string;
  };
  readonly request: Request;
}

/** Dependencies used by the authenticated pipeline action HTTP boundary. */
export interface PipelineActionRouteDependencies {
  /** Component metadata the deployment can currently execute, checked before a pipeline may enable. */
  readonly availableComponents: readonly ComponentMetadata[];
  readonly database: DatabaseClient;
  readonly disablePipelineForOwner: typeof disablePipelineForOwner;
  readonly duplicatePipeline: typeof duplicatePipeline;
  readonly enablePipelineForOwner: typeof enablePipelineForOwner;
  readonly enqueuePipelineRun: (
    input: { readonly ownerUserId: string; readonly pipelineId: string },
  ) => Promise<ReturnType<typeof pipelineRunResponseSchema.parse>>;
  readonly getPipeline: typeof getPipeline;
  readonly getSession: (headers: Headers) => Promise<PipelineActionSession | null>;
}

/** Builds authenticated handlers for pipeline duplication and execution-state actions. */
export function createPipelineActionRouteHandlers(dependencies: PipelineActionRouteDependencies) {
  return {
    DISABLE: async (input: PipelineActionRouteInput): Promise<Response> => stateActionResponse(
      dependencies,
      input,
      dependencies.disablePipelineForOwner,
    ),
    DUPLICATE: async (input: PipelineActionRouteInput): Promise<Response> => {
      const session = await dependencies.getSession(input.request.headers);
      if (session === null) return unauthenticatedResponse();

      const duplicateRequest = await parseDuplicateRequest(input);
      if (!duplicateRequest) return invalidRequestResponse();

      const pipeline = await dependencies.duplicatePipeline(dependencies.database, {
        name: duplicateRequest.name,
        ownerUserId: session.user.id,
        pipelineId: duplicateRequest.pipelineId,
      });
      if (!pipeline) return notFoundResponse();

      return Response.json(pipelineDuplicateResponseSchema.parse(pipeline), {
        headers: { "cache-control": "no-store" },
        status: 201,
      });
    },
    ENABLE: async (input: PipelineActionRouteInput): Promise<Response> => stateActionResponse(
      dependencies,
      input,
      (db, actionInput) => dependencies.enablePipelineForOwner(db, actionInput, dependencies.availableComponents),
    ),
    RUN: async (input: PipelineActionRouteInput): Promise<Response> => {
      const session = await dependencies.getSession(input.request.headers);
      if (session === null) return unauthenticatedResponse();

      const parsed = pipelineRunRequestSchema.safeParse({ pipelineId: input.params.pipelineId });
      if (!parsed.success) return invalidRequestResponse();

      try {
        const run = await dependencies.enqueuePipelineRun({
          ownerUserId: session.user.id,
          pipelineId: parsed.data.pipelineId,
        });
        return Response.json(pipelineRunResponseSchema.parse(run), { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return actionErrorResponse(error);
      }
    },
  };
}

/** Apply one owner-scoped state transition, then return its canonical hydrated pipeline. */
async function stateActionResponse(
  dependencies: PipelineActionRouteDependencies,
  input: PipelineActionRouteInput,
  action: (db: DatabaseClient, actionInput: PipelineActionInput) => Promise<PipelineStateActionResult>,
): Promise<Response> {
  const session = await dependencies.getSession(input.request.headers);
  if (session === null) return unauthenticatedResponse();

  const parsed = pipelineStateActionRequestSchema.safeParse({ pipelineId: input.params.pipelineId });
  if (!parsed.success) return invalidRequestResponse();

  try {
    await action(dependencies.database, { ownerUserId: session.user.id, pipelineId: parsed.data.pipelineId });
    const pipeline = await dependencies.getPipeline(dependencies.database, {
      ownerUserId: session.user.id,
      pipelineId: parsed.data.pipelineId,
    });
    if (!pipeline) return notFoundResponse();

    return Response.json(pipelineStateActionResponseSchema.parse(pipeline), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return actionErrorResponse(error);
  }
}

/** Validate a duplicate's optional request body as the canonical path-plus-body request. */
async function parseDuplicateRequest(input: PipelineActionRouteInput): Promise<PipelineDuplicateRequest | undefined> {
  const body = await readOptionalJsonObject(input.request);
  if (!body) return undefined;

  const parsedBody = pipelineDuplicateBodyRequestSchema.safeParse(body);
  if (!parsedBody.success) return undefined;

  const parsed = pipelineDuplicateRequestSchema.safeParse({ ...parsedBody.data, pipelineId: input.params.pipelineId });
  return parsed.success ? parsed.data : undefined;
}

/** Accept an absent duplicate body as an unnamed copy while rejecting malformed JSON and arrays. */
async function readOptionalJsonObject(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const text = await request.text();
    if (text.trim().length === 0) return {};

    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;

    return value as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Hide absent and inaccessible resources behind the same response. */
function notFoundResponse(): Response {
  return Response.json({ code: "pipeline_not_found" }, { status: 404 });
}

/** Return a stable response for malformed paths or action documents. */
function invalidRequestResponse(): Response {
  return Response.json({ code: "invalid_pipeline_request" }, { status: 400 });
}

/** Reject owner-scoped actions before any repository or scheduler operation without a session. */
function unauthenticatedResponse(): Response {
  return new Response(null, { status: 401 });
}

/** Map structured ownership, state, and scheduler conflicts without exposing domain details. */
function actionErrorResponse(error: unknown): Response {
  if (error instanceof PipelineActionConflictError) {
    return pipelineActionConflictResponse(error);
  }
  if (error instanceof PipelineSchedulerConflictError) {
    return schedulerConflictResponse(error.code);
  }

  throw error;
}

/** Return the documented status for a database action conflict, carrying violations for a failed enable. */
function pipelineActionConflictResponse(error: PipelineActionConflictError): Response {
  if (error.reason === "not_found") return notFoundResponse();
  if (error.reason === "not_executable") {
    return Response.json(
      { code: "pipeline_not_executable", violations: error.violations ?? [] },
      { status: 409 },
    );
  }

  return Response.json(
    { code: error.reason === "locked" ? "pipeline_locked" : "pipeline_not_enabled" },
    { status: 409 },
  );
}

/** Map scheduler-side responses to the equivalent public API action result. */
function schedulerConflictResponse(code: PipelineSchedulerConflictError["code"]): Response {
  return code === "pipeline_not_found"
    ? notFoundResponse()
    : Response.json({ code }, { status: 409 });
}
