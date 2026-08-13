import {
  pipelineCreateRequestSchema,
  pipelineCreateResponseSchema,
  pipelineListRequestSchema,
  pipelineListResponseSchema,
  type PipelineCreateRequest,
} from "@pantaetl/contracts";
import {
  createPipeline,
  InvalidPipelineTopologyError,
  listPipelinesByOwner,
  type DatabaseClient,
} from "@pantaetl/database";

/** Minimal authenticated identity required by the pipeline collection routes. */
export interface PipelineCollectionSession {
  readonly user: {
    readonly id: string;
  };
}

/** Dependencies for the authenticated pipeline collection route handlers. */
export interface PipelineCollectionRouteDependencies {
  /** Creates a pipeline graph for the trusted authenticated owner. */
  readonly createPipeline: typeof createPipeline;
  /** Resolves the signed-in user from request session headers. */
  readonly getSession: (request: Request) => Promise<PipelineCollectionSession | null>;
  /** Lists complete pipeline graphs for the trusted authenticated owner. */
  readonly listPipelinesByOwner: typeof listPipelinesByOwner;
  /** Shared control-plane database connection. */
  readonly database: DatabaseClient;
}

/** Request context required by the collection route's server handlers. */
export interface PipelineCollectionRouteContext {
  readonly request: Request;
}

/** Builds authenticated GET and POST handlers for the pipeline collection resource. */
export function createPipelineCollectionRouteHandlers(dependencies: PipelineCollectionRouteDependencies) {
  return {
    /** Returns every pipeline owned by the authenticated user. */
    GET: async ({ request }: PipelineCollectionRouteContext): Promise<Response> => {
      const session = await dependencies.getSession(request);
      if (session === null) {
        return new Response(null, { status: 401 });
      }

      pipelineListRequestSchema.parse({});
      const pipelines = await dependencies.listPipelinesByOwner(dependencies.database, session.user.id);
      const response = pipelineListResponseSchema.parse({ pipelines });
      return Response.json(response, { headers: { "cache-control": "no-store" } });
    },

    /** Creates a complete pipeline graph for the authenticated user. */
    POST: async ({ request }: PipelineCollectionRouteContext): Promise<Response> => {
      const session = await dependencies.getSession(request);
      if (session === null) {
        return new Response(null, { status: 401 });
      }

      const parsedRequest = pipelineCreateRequestSchema.safeParse(await readJsonObject(request));
      if (!parsedRequest.success) {
        return invalidPipelineRequestResponse();
      }

      try {
        const created = await dependencies.createPipeline(dependencies.database, {
          ownerUserId: session.user.id,
          pipeline: parsedRequest.data as PipelineCreateRequest,
        });
        const response = pipelineCreateResponseSchema.parse(created);
        return Response.json(response, { headers: { "cache-control": "no-store" }, status: 201 });
      } catch (error) {
        if (error instanceof InvalidPipelineTopologyError) {
          return invalidPipelineRequestResponse();
        }

        throw error;
      }
    },
  };
}

/** Reads a JSON object while treating malformed and non-object payloads as invalid input. */
async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }

    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Returns a stable, safe response for invalid pipeline request data or topology. */
function invalidPipelineRequestResponse(): Response {
  return Response.json({ code: "invalid_pipeline_request" }, { status: 400 });
}
