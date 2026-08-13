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
});
