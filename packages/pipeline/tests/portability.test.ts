import { describe, expect, it } from "vitest";

import type { Pipeline } from "@pantaetl/contracts";

import {
  duplicatePipelineDefinition,
  exportPortablePipelineDefinition,
  importPortablePipelineDefinition,
  UnavailablePipelineCapabilityError,
} from "../src/index.js";

const ids = {
  export: "123e4567-e89b-12d3-a456-426614174020",
  pipeline: "123e4567-e89b-12d3-a456-426614174021",
  source: "123e4567-e89b-12d3-a456-426614174022",
  user: "123e4567-e89b-12d3-a456-426614174023",
};

const pipeline: Pipeline = {
  contractVersion: "v1",
  id: ids.pipeline,
  ownerUserId: ids.user,
  name: "Daily orders",
  state: "enabled",
  createdAt: "2026-08-13T01:00:00Z",
  updatedAt: "2026-08-13T01:00:00Z",
  steps: [
    {
      id: ids.source,
      kind: "source",
      componentType: "source.rest-api",
      componentVersion: "v1",
      configuration: {
        values: { endpoint: "https://example.test/orders" },
        secretBindings: [{ key: "apiToken", binding: "ORDERS_API_TOKEN" }],
      },
    },
    {
      id: ids.export,
      kind: "export",
      componentType: "export.json",
      componentVersion: "v1",
      configuration: { values: { path: "orders.json" }, secretBindings: [] },
    },
  ],
  edges: [{ fromStepId: ids.source, toStepId: ids.export }],
  triggers: [],
};

describe("pipeline portability", () => {
  it("exports and duplicates non-secret configuration without bindings or deployment identity", () => {
    const exported = exportPortablePipelineDefinition(pipeline);
    const duplicate = duplicatePipelineDefinition(pipeline, "Daily orders copy");

    expect(exported).not.toHaveProperty("id");
    expect(exported).not.toHaveProperty("triggers");
    expect(exported.steps[0]?.configuration).toEqual({
      values: { endpoint: "https://example.test/orders" },
      secretBindings: [],
    });
    expect(exported.steps[0]?.configuration.values).not.toBe(pipeline.steps[0]?.configuration.values);
    expect(duplicate).toMatchObject({ name: "Daily orders copy", state: "draft" });
  });

  it("imports only when all component capabilities are available and leaves the pipeline in draft", () => {
    const definition = exportPortablePipelineDefinition(pipeline);
    const imported = importPortablePipelineDefinition(definition, [
      { type: "source.rest-api", version: "v1" },
      { type: "export.json", version: "v1" },
    ]);

    expect(imported.state).toBe("draft");
    expect(imported.steps[0]?.configuration.secretBindings).toEqual([]);
  });

  it("rejects imports that require an unavailable component capability", () => {
    expect(() =>
      importPortablePipelineDefinition(exportPortablePipelineDefinition(pipeline), [
        { type: "source.rest-api", version: "v1" },
      ]),
    ).toThrow(UnavailablePipelineCapabilityError);
  });
});
