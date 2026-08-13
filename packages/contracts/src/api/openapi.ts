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
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "PantaETL API token",
          scheme: "bearer",
          type: "http",
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
    },
    servers: [{ url: "/" }],
  };
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
