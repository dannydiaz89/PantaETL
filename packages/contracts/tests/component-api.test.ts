import { describe, expect, it } from "vitest";

import {
  componentCapabilityListRequestSchema,
  componentCapabilityListResponseSchema,
  filterComponentCapabilities,
} from "../src/api/index.js";
import { createOpenApiDocument } from "../src/api/openapi.js";
import { componentCapabilityListResponseSchema as publicComponentCapabilityListResponseSchema } from "../src/index.js";

const components = [
  {
    configFields: [],
    descriptionKey: "component.source.csv.description",
    displayNameKey: "component.source.csv.name",
    inputFamilies: [],
    kind: "source",
    outputFamilies: ["tabular"],
    type: "source.csv",
    version: "v1",
  },
  {
    configFields: [],
    descriptionKey: "component.export.csv.description",
    displayNameKey: "component.export.csv.name",
    inputFamilies: ["tabular"],
    kind: "export",
    outputFamilies: [],
    type: "export.csv",
    version: "v1",
  },
] as const;

describe("component capability API contracts", () => {
  it("validates the optional kind filter and canonical component metadata response", () => {
    expect(componentCapabilityListRequestSchema.safeParse({}).success).toBe(true);
    expect(componentCapabilityListRequestSchema.safeParse({ kind: "transform" }).success).toBe(true);
    expect(componentCapabilityListRequestSchema.safeParse({ kind: "connector" }).success).toBe(false);
    expect(componentCapabilityListRequestSchema.safeParse({ kind: "source", page: 1 }).success).toBe(false);
    expect(componentCapabilityListResponseSchema.safeParse({ components }).success).toBe(true);
    expect(componentCapabilityListResponseSchema.safeParse({ components: [{ ...components[0], executor: "unsafe" }] }).success).toBe(false);
  });

  it("filters validated catalog metadata without defining a UI-only component type", () => {
    expect(filterComponentCapabilities(components, "source")).toEqual([components[0]]);
    expect(filterComponentCapabilities(components, undefined)).toEqual(components);
  });

  it("exports the canonical response validator through the package root", () => {
    expect(publicComponentCapabilityListResponseSchema).toBe(componentCapabilityListResponseSchema);
  });

  it("publishes self-contained capability schemas for OpenAPI consumers", () => {
    const document = createOpenApiDocument();
    const request = JSON.stringify(document.components.schemas.ComponentCapabilityListRequest);
    const response = JSON.stringify(document.components.schemas.ComponentCapabilityListResponse);

    expect(document.components.schemas.ComponentCapabilityListRequest).toBeDefined();
    expect(document.components.schemas.ComponentCapabilityListResponse).toBeDefined();
    expect(request).toContain("#/components/schemas/ComponentKind");
    expect(response).toContain("#/components/schemas/ComponentMetadata");
    expect(request).not.toContain("https://pantaetl.dev/schemas/");
    expect(response).not.toContain("https://pantaetl.dev/schemas/");
  });
});
