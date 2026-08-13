import { canonicalSchemas } from "../json-schema.js";

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
 * The component entries deliberately retain the original JSON Schema objects:
 * API consumers, TypeScript validators, and Python models therefore share one
 * schema definition instead of maintaining endpoint-specific copies.
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
