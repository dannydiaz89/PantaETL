import { canonicalSchemas, definitionSchema, propertySchema } from "../json-schema.js";

const pipelineSchemaIdentifier = "https://pantaetl.dev/schemas/pipeline.schema.json";
const commonSchemaIdentifier = "https://pantaetl.dev/schemas/common.schema.json";

const openApiReferences: Readonly<Record<string, string>> = {
  [commonSchemaIdentifier + "#/properties/identifier"]: "#/components/schemas/PipelineIdentifier",
  [pipelineSchemaIdentifier]: "#/components/schemas/Pipeline",
  [pipelineSchemaIdentifier + "#/properties/contractVersion"]: "#/components/schemas/PipelineContractVersion",
  [pipelineSchemaIdentifier + "#/properties/edges"]: "#/components/schemas/PipelineEdges",
  [pipelineSchemaIdentifier + "#/properties/name"]: "#/components/schemas/PipelineName",
  [pipelineSchemaIdentifier + "#/properties/state"]: "#/components/schemas/PipelineState",
  [pipelineSchemaIdentifier + "#/properties/steps"]: "#/components/schemas/PipelineSteps",
  [pipelineSchemaIdentifier + "#/properties/triggers"]: "#/components/schemas/PipelineTriggers",
};

/** OpenAPI document shape emitted by the control-plane contract baseline. */
export interface OpenApiDocument {
  readonly components: {
    readonly parameters: Record<string, unknown>;
    readonly schemas: Record<string, unknown>;
    readonly securitySchemes: Record<string, unknown>;
  };
  readonly info: {
    readonly description: string;
    readonly title: string;
    readonly version: string;
  };
  readonly jsonSchemaDialect: string;
  readonly openapi: "3.1.1";
  readonly paths: Record<string, unknown>;
  readonly servers: readonly {
    readonly url: string;
  }[];
}

/**
 * Creates the control-plane OpenAPI document from canonical contract schemas.
 *
 * The component entries retain canonical schemas or mechanically rewrite their
 * references, so API consumers never depend on duplicate endpoint definitions.
 */
export function createOpenApiDocument(): OpenApiDocument {
  return {
    components: {
      schemas: {
        ArtifactDescriptor: canonicalSchemas.artifactDescriptor,
        CommonPrimitives: canonicalSchemas.common,
        ComponentMetadata: canonicalSchemas.componentMetadata,
        DatasetDescriptor: canonicalSchemas.datasetDescriptor,
        Job: canonicalSchemas.job,
        Pipeline: canonicalSchemas.pipeline,
        PipelineContractVersion: propertySchema(canonicalSchemas.pipeline, "contractVersion"),
        PipelineCreateRequest: pipelineApiComponent("pipelineCreateRequest"),
        PipelineCreateResponse: pipelineApiComponent("pipelineCreateResponse"),
        PipelineDeleteRequest: pipelineApiComponent("pipelineDeleteRequest"),
        PipelineDetailRequest: pipelineApiComponent("pipelineDetailRequest"),
        PipelineDetailResponse: pipelineApiComponent("pipelineDetailResponse"),
        PipelineDuplicateBodyRequest: pipelineApiComponent("pipelineDuplicateBodyRequest"),
        PipelineDuplicateRequest: pipelineApiComponent("pipelineDuplicateRequest"),
        PipelineDuplicateResponse: pipelineApiComponent("pipelineDuplicateResponse"),
        PipelineEdges: propertySchema(canonicalSchemas.pipeline, "edges"),
        PipelineIdentifier: propertySchema(canonicalSchemas.common, "identifier"),
        PipelineListRequest: pipelineApiComponent("pipelineListRequest"),
        PipelineListResponse: pipelineApiComponent("pipelineListResponse"),
        PipelineName: propertySchema(canonicalSchemas.pipeline, "name"),
        PipelineRunRequest: pipelineApiComponent("pipelineRunRequest"),
        PipelineRunResponse: pipelineApiComponent("pipelineRunResponse"),
        PipelineState: propertySchema(canonicalSchemas.pipeline, "state"),
        PipelineStateActionRequest: pipelineApiComponent("pipelineStateActionRequest"),
        PipelineStateActionResponse: pipelineApiComponent("pipelineStateActionResponse"),
        PipelineSteps: propertySchema(canonicalSchemas.pipeline, "steps"),
        PipelineTriggers: propertySchema(canonicalSchemas.pipeline, "triggers"),
        PipelineUpdateRequest: pipelineApiComponent("pipelineUpdateRequest"),
        PipelineUpdateResponse: pipelineApiComponent("pipelineUpdateResponse"),
        Run: canonicalSchemas.run,
        SourceExecutionRequest: canonicalSchemas.sourceExecutionRequest,
      },
      parameters: {
        PipelineIdentifier: {
          in: "path",
          name: "pipelineId",
          required: true,
          schema: { $ref: "#/components/schemas/PipelineIdentifier" },
        },
      },
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "PantaETL API token",
          scheme: "bearer",
          type: "http",
        },
        sessionAuth: {
          description: "Authenticated browser session established by the control plane.",
          in: "cookie",
          name: "better-auth.session_token",
          type: "apiKey",
        },
      },
    },
    info: {
      description: "PantaETL control-plane contract schemas.",
      title: "PantaETL API",
      version: "v1",
    },
    jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base",
    openapi: "3.1.1",
    paths: {
      "/api/authentication": {
        get: {
          operationId: "getAuthenticatedIdentity",
          responses: {
            200: { description: "The authenticated API-token owner." },
            401: { description: "A valid API token is required." },
          },
          security: [{ bearerAuth: [] }],
          summary: "Authenticate an API token",
          tags: ["authentication"],
        },
      },
      "/api/openapi.json": {
        get: {
          operationId: "getOpenApiDocument",
          responses: {
            200: {
              description: "The current OpenAPI document.",
            },
          },
          summary: "Get the OpenAPI document",
          tags: ["documentation"],
        },
      },
      "/api/pipelines": {
        get: {
          operationId: "listPipelines",
          responses: {
            200: jsonResponse("The authenticated owner's pipeline collection.", "PipelineListResponse"),
            401: unauthenticatedResponse(),
          },
          security: [sessionSecurityRequirement],
          summary: "List pipelines",
          tags: ["pipelines"],
        },
        post: {
          operationId: "createPipeline",
          requestBody: jsonRequestBody("PipelineCreateRequest", true),
          responses: {
            201: jsonResponse("The created pipeline.", "PipelineCreateResponse"),
            400: invalidRequestResponse(),
            401: unauthenticatedResponse(),
          },
          security: [sessionSecurityRequirement],
          summary: "Create a pipeline",
          tags: ["pipelines"],
        },
      },
      "/api/pipelines/{pipelineId}": {
        delete: {
          operationId: "deletePipeline",
          parameters: [pipelineIdentifierParameter],
          responses: {
            204: { description: "The pipeline was deleted." },
            400: invalidRequestResponse(),
            401: unauthenticatedResponse(),
            404: pipelineNotFoundResponse(),
            409: pipelineConflictResponse(),
          },
          security: [sessionSecurityRequirement],
          summary: "Delete a pipeline",
          tags: ["pipelines"],
        },
        get: {
          operationId: "getPipeline",
          parameters: [pipelineIdentifierParameter],
          responses: {
            200: jsonResponse("The requested pipeline.", "PipelineDetailResponse"),
            400: invalidRequestResponse(),
            401: unauthenticatedResponse(),
            404: pipelineNotFoundResponse(),
          },
          security: [sessionSecurityRequirement],
          summary: "Get a pipeline",
          tags: ["pipelines"],
        },
        patch: {
          operationId: "updatePipeline",
          parameters: [pipelineIdentifierParameter],
          requestBody: jsonRequestBody("PipelineUpdateRequest", true),
          responses: {
            200: jsonResponse("The updated pipeline.", "PipelineUpdateResponse"),
            400: invalidRequestResponse(),
            401: unauthenticatedResponse(),
            404: pipelineNotFoundResponse(),
            409: pipelineConflictResponse(),
          },
          security: [sessionSecurityRequirement],
          summary: "Update an idle pipeline",
          tags: ["pipelines"],
        },
      },
      "/api/pipelines/{pipelineId}/disable": pipelineStateActionPath("disablePipeline", "Disable a pipeline"),
      "/api/pipelines/{pipelineId}/duplicate": {
        post: {
          operationId: "duplicatePipeline",
          parameters: [pipelineIdentifierParameter],
          requestBody: jsonRequestBody("PipelineDuplicateBodyRequest", false),
          responses: {
            201: jsonResponse("The new draft pipeline.", "PipelineDuplicateResponse"),
            400: invalidRequestResponse(),
            401: unauthenticatedResponse(),
            404: pipelineNotFoundResponse(),
          },
          security: [sessionSecurityRequirement],
          summary: "Duplicate a pipeline",
          tags: ["pipelines"],
        },
      },
      "/api/pipelines/{pipelineId}/enable": pipelineStateActionPath("enablePipeline", "Enable a pipeline"),
      "/api/pipelines/{pipelineId}/run": {
        post: {
          operationId: "runPipeline",
          parameters: [pipelineIdentifierParameter],
          responses: {
            200: jsonResponse("The queued pipeline run.", "PipelineRunResponse"),
            400: invalidRequestResponse(),
            401: unauthenticatedResponse(),
            404: pipelineNotFoundResponse(),
            409: pipelineConflictResponse(),
          },
          security: [sessionSecurityRequirement],
          summary: "Run an enabled pipeline",
          tags: ["pipelines"],
        },
      },
    },
    servers: [{ url: "/" }],
  };
}

const pipelineIdentifierParameter = { $ref: "#/components/parameters/PipelineIdentifier" };
const sessionSecurityRequirement = { sessionAuth: [] };

/** Build the shared POST operation shape for the two pipeline availability actions. */
function pipelineStateActionPath(operationId: string, summary: string): unknown {
  return {
    post: {
      operationId,
      parameters: [pipelineIdentifierParameter],
      responses: {
        200: jsonResponse("The pipeline after its state transition.", "PipelineStateActionResponse"),
        400: invalidRequestResponse(),
        401: unauthenticatedResponse(),
        404: pipelineNotFoundResponse(),
        409: pipelineConflictResponse(),
      },
      security: [sessionSecurityRequirement],
      summary,
      tags: ["pipelines"],
    },
  };
}

/** Reference a canonical component for a JSON request body. */
function jsonRequestBody(componentName: string, required: boolean): unknown {
  return {
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${componentName}` },
      },
    },
    required,
  };
}

/** Reference a canonical component for a successful JSON response. */
function jsonResponse(description: string, componentName: string): unknown {
  return {
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${componentName}` },
      },
    },
    description,
  };
}

/** Describe malformed paths, bodies, and pipeline topology without exposing parser details. */
function invalidRequestResponse(): unknown {
  return { description: "The pipeline path or request document is invalid." };
}

/** Describe the session requirement shared by authenticated pipeline endpoints. */
function unauthenticatedResponse(): unknown {
  return { description: "An authenticated control-plane session is required." };
}

/** Hide absent and inaccessible pipelines behind the same not-found response. */
function pipelineNotFoundResponse(): unknown {
  return { description: "The pipeline does not exist or is not accessible to the authenticated user." };
}

/** Describe state and durable-history conflicts that prevent the requested write. */
function pipelineConflictResponse(): unknown {
  return { description: "The pipeline state does not allow this operation." };
}

/** Convert canonical external references into OpenAPI component references without copying schemas. */
function pipelineApiComponent(definitionName: string): unknown {
  return replaceCanonicalReferences(
    definitionSchema(canonicalSchemas.pipelineApi, definitionName),
  );
}

/** Rewrite only known canonical document references for a self-contained OpenAPI document. */
function replaceCanonicalReferences(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(replaceCanonicalReferences);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [
    key,
    key === "$ref" && typeof child === "string" ? (openApiReferences[child] ?? child) : replaceCanonicalReferences(child),
  ]));
}
