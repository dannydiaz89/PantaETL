import { describe, expect, it } from "vitest";

import { createOpenApiDocument } from "../src/api/index.js";
import { canonicalSchemas } from "../src/json-schema.js";

describe("OpenAPI contract baseline", () => {
  it("exposes the canonical JSON Schema documents as OpenAPI components", () => {
    const document = createOpenApiDocument();

    expect(document.openapi).toBe("3.1.1");
    expect(document.components.schemas.ArtifactDescriptor).toBe(canonicalSchemas.artifactDescriptor);
    expect(document.components.schemas.CommonPrimitives).toBe(canonicalSchemas.common);
    expect(document.components.schemas.ComponentMetadata).toBe(canonicalSchemas.componentMetadata);
    expect(document.components.schemas.ComponentKind).toEqual(
      expect.objectContaining({ enum: ["source", "transform", "export"] }),
    );
    expect(document.components.schemas.DatasetDescriptor).toBe(canonicalSchemas.datasetDescriptor);
    expect(document.components.schemas.Job).toBe(canonicalSchemas.job);
    expect(document.components.schemas.Pipeline).toBe(canonicalSchemas.pipeline);
    expect(document.components.schemas.Run).toBe(canonicalSchemas.run);
    expect(document.components.schemas.SourceExecutionRequest).toBe(canonicalSchemas.sourceExecutionRequest);
  });

  it("documents the machine-readable specification endpoint without request schemas", () => {
    const document = createOpenApiDocument();
    const endpoint = document.paths["/api/openapi.json"] as {
      get?: { responses?: Record<string, unknown> };
    };

    expect(endpoint.get?.responses).toHaveProperty("200");
    expect(endpoint.get).not.toHaveProperty("requestBody");
  });

  it("documents the API-token Bearer security scheme", () => {
    const document = createOpenApiDocument();
    const endpoint = document.paths["/api/authentication"] as {
      get?: { security?: readonly { bearerAuth?: readonly unknown[] }[] };
    };

    expect(document.components.securitySchemes.bearerAuth).toEqual({
      bearerFormat: "PantaETL API token",
      scheme: "bearer",
      type: "http",
    });
    expect(endpoint.get?.security).toEqual([{ bearerAuth: [] }]);
  });

  it("documents the authenticated component capability collection", () => {
    const document = createOpenApiDocument();
    const endpoint = document.paths["/api/components"] as { readonly get?: OpenApiOperation } | undefined;

    expect(endpoint?.get?.security).toEqual([{ sessionAuth: [] }]);
    expect(endpoint?.get?.parameters).toEqual([{ $ref: "#/components/parameters/ComponentKindQuery" }]);
    expect(endpoint?.get?.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ComponentCapabilityListResponse",
    });
  });

  it("documents every pipeline route with canonical request and response components", () => {
    const document = createOpenApiDocument();

    expect(document.components.parameters.PipelineIdentifier).toEqual({
      in: "path",
      name: "pipelineId",
      required: true,
      schema: { $ref: "#/components/schemas/PipelineIdentifier" },
    });
    expect(document.components.securitySchemes.sessionAuth).toMatchObject({
      in: "cookie",
      name: "better-auth.session_token",
      type: "apiKey",
    });

    expectPipelineOperation(document, "/api/pipelines", "get", "PipelineListResponse", ["200", "401"]);
    expectPipelineOperation(document, "/api/pipelines", "post", "PipelineCreateResponse", ["201", "400", "401"]);
    expectPipelineOperation(document, "/api/pipelines/{pipelineId}", "get", "PipelineDetailResponse", ["200", "400", "401", "404"]);
    expectPipelineOperation(document, "/api/pipelines/{pipelineId}", "patch", "PipelineUpdateResponse", ["200", "400", "401", "404", "409"]);
    expectPipelineOperation(document, "/api/pipelines/{pipelineId}", "delete", undefined, ["204", "400", "401", "404", "409"]);
    expectPipelineOperation(document, "/api/pipelines/{pipelineId}/duplicate", "post", "PipelineDuplicateResponse", ["201", "400", "401", "404"]);
    expectPipelineOperation(document, "/api/pipelines/{pipelineId}/run", "post", "PipelineRunResponse", ["200", "400", "401", "404", "409"]);
    expectPipelineOperation(document, "/api/pipelines/{pipelineId}/enable", "post", "PipelineStateActionResponse", ["200", "400", "401", "404", "409"]);
    expectPipelineOperation(document, "/api/pipelines/{pipelineId}/disable", "post", "PipelineStateActionResponse", ["200", "400", "401", "404", "409"]);

    expectPipelineRequestBody(document, "/api/pipelines", "post", "PipelineCreateRequest", true);
    expectPipelineRequestBody(document, "/api/pipelines/{pipelineId}", "patch", "PipelineUpdateRequest", true);
    expectPipelineRequestBody(document, "/api/pipelines/{pipelineId}/duplicate", "post", "PipelineDuplicateBodyRequest", false);
  });
});

interface OpenApiOperation {
  readonly parameters?: readonly { readonly $ref?: string }[];
  readonly requestBody?: {
    readonly content?: {
      readonly "application/json"?: { readonly schema?: { readonly $ref?: string } };
    };
    readonly required?: boolean;
  };
  readonly responses?: Record<string, {
    readonly content?: {
      readonly "application/json"?: { readonly schema?: { readonly $ref?: string } };
    };
  }>;
  readonly security?: readonly { readonly sessionAuth?: readonly unknown[] }[];
}

/** Assert the stable security, path-parameter, response, and status behavior for one pipeline operation. */
function expectPipelineOperation(
  document: ReturnType<typeof createOpenApiDocument>,
  path: string,
  method: "delete" | "get" | "patch" | "post",
  responseComponent: string | undefined,
  statusCodes: readonly string[],
) {
  const operation = (document.paths[path] as Record<string, OpenApiOperation> | undefined)?.[method];

  expect(operation?.security).toEqual([{ sessionAuth: [] }]);
  expect(operation?.responses).toEqual(expect.objectContaining(
    Object.fromEntries(statusCodes.map((status) => [status, expect.any(Object)])),
  ));

  if (path !== "/api/pipelines") {
    expect(operation?.parameters).toEqual([{ $ref: "#/components/parameters/PipelineIdentifier" }]);
  }

  if (responseComponent) {
    expect(operation?.responses?.[statusCodes[0]]?.content?.["application/json"]?.schema).toEqual({
      $ref: `#/components/schemas/${responseComponent}`,
    });
  }
}

/** Assert a JSON body uses the exact canonical component used by its runtime validator. */
function expectPipelineRequestBody(
  document: ReturnType<typeof createOpenApiDocument>,
  path: string,
  method: "patch" | "post",
  componentName: string,
  required: boolean,
) {
  const operation = (document.paths[path] as Record<string, OpenApiOperation> | undefined)?.[method];

  expect(operation?.requestBody?.content?.["application/json"]?.schema).toEqual({
    $ref: `#/components/schemas/${componentName}`,
  });
  expect(operation?.requestBody?.required).toBe(required);
}
