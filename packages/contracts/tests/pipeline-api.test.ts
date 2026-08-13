import { describe, expect, it } from "vitest";

import {
  pipelineCreateRequestSchema,
  pipelineDetailRequestSchema,
  pipelineDuplicateRequestSchema,
  pipelineListRequestSchema,
  pipelineListResponseSchema,
  pipelineRunRequestSchema,
  pipelineRunResponseSchema,
  pipelineStateActionRequestSchema,
  pipelineStateActionResponseSchema,
  pipelineUpdateRequestSchema,
} from "../src/api/index.js";
import { createOpenApiDocument } from "../src/api/openapi.js";
import { pipelineCreateRequestSchema as publicPipelineCreateRequestSchema } from "../src/index.js";

const identifiers = {
  export: "423e4567-e89b-12d3-a456-426614174001",
  pipeline: "423e4567-e89b-12d3-a456-426614174002",
  run: "423e4567-e89b-12d3-a456-426614174003",
  source: "423e4567-e89b-12d3-a456-426614174004",
  user: "423e4567-e89b-12d3-a456-426614174005",
};

describe("pipeline API contracts", () => {
  it("validates list, create, detail, update, and action boundaries from canonical schemas", () => {
    const pipeline = persistedPipeline();

    expect(pipelineListRequestSchema.safeParse({}).success).toBe(true);
    expect(pipelineListResponseSchema.safeParse({ pipelines: [pipeline] }).success).toBe(true);
    expect(pipelineCreateRequestSchema.safeParse(createRequest()).success).toBe(true);
    expect(pipelineDetailRequestSchema.safeParse({ pipelineId: identifiers.pipeline }).success).toBe(true);
    expect(pipelineUpdateRequestSchema.safeParse({ name: "Renamed export" }).success).toBe(true);
    expect(pipelineDuplicateRequestSchema.safeParse({ pipelineId: identifiers.pipeline }).success).toBe(true);
    expect(pipelineRunRequestSchema.safeParse({ pipelineId: identifiers.pipeline }).success).toBe(true);
    expect(pipelineRunResponseSchema.safeParse({
      initialJobCount: 1,
      pipelineId: identifiers.pipeline,
      queuedBehindActiveRun: false,
      runId: identifiers.run,
    }).success).toBe(true);
    expect(pipelineStateActionRequestSchema.safeParse({ pipelineId: identifiers.pipeline }).success).toBe(true);
    expect(pipelineStateActionResponseSchema.safeParse(pipeline).success).toBe(true);
  });

  it("exports API contract validators through the package root", () => {
    expect(publicPipelineCreateRequestSchema).toBe(pipelineCreateRequestSchema);
  });

  it("rejects identity and owner rewrites from update input", () => {
    expect(pipelineUpdateRequestSchema.safeParse({}).success).toBe(false);
    expect(pipelineUpdateRequestSchema.safeParse({ id: identifiers.pipeline, name: "Unsafe" }).success).toBe(false);
    expect(pipelineUpdateRequestSchema.safeParse({ ownerUserId: identifiers.user, name: "Unsafe" }).success).toBe(false);
    expect(pipelineUpdateRequestSchema.safeParse({ createdAt: "2026-08-13T00:00:00.000Z" }).success).toBe(false);
  });

  it("accepts only secret binding references and rejects usable secret values in requests and responses", () => {
    const request = createRequest();
    const unsafeRequest = {
      ...request,
      steps: request.steps.map((step) => (
        step.id === identifiers.source
          ? { ...step, configuration: { ...step.configuration, values: { apiToken: "usable-secret" } } }
          : step
      )),
    };
    const unsafeResponse = {
      ...persistedPipeline(),
      steps: persistedPipeline().steps.map((step) => (
        step.id === identifiers.source
          ? { ...step, configuration: { ...step.configuration, values: { password: "usable-secret" } } }
          : step
      )),
    };

    expect(pipelineCreateRequestSchema.safeParse(request).success).toBe(true);
    expect(pipelineCreateRequestSchema.safeParse(unsafeRequest).success).toBe(false);
    expect(pipelineListResponseSchema.safeParse({ pipelines: [unsafeResponse] }).success).toBe(false);
  });

  it("publishes API schemas that OpenAPI can consume without external contract fetches", () => {
    const document = createOpenApiDocument();
    const createRequest = JSON.stringify(document.components.schemas.PipelineCreateRequest);
    const listResponse = JSON.stringify(document.components.schemas.PipelineListResponse);

    expect(document.components.schemas).toHaveProperty("PipelineRunResponse");
    expect(document.components.schemas).toHaveProperty("PipelineStateActionResponse");
    expect(createRequest).toContain("#/components/schemas/PipelineSteps");
    expect(listResponse).toContain("#/components/schemas/Pipeline");
    expect(createRequest).not.toContain("https://pantaetl.dev/schemas/");
    expect(listResponse).not.toContain("https://pantaetl.dev/schemas/");
  });
});

function createRequest() {
  const pipeline = persistedPipeline();
  return {
    contractVersion: pipeline.contractVersion,
    edges: pipeline.edges,
    name: pipeline.name,
    steps: pipeline.steps,
    triggers: pipeline.triggers.map((trigger) => (
      trigger.type === "manual"
        ? { enabled: trigger.enabled, type: trigger.type }
        : {
          cron: trigger.cron,
          enabled: trigger.enabled,
          timezone: trigger.timezone,
          type: trigger.type,
        }
    )),
  };
}

function persistedPipeline() {
  return {
    contractVersion: "v1",
    createdAt: "2026-08-13T00:00:00.000Z",
    edges: [{ fromStepId: identifiers.source, toStepId: identifiers.export }],
    id: identifiers.pipeline,
    name: "Daily orders export",
    ownerUserId: identifiers.user,
    state: "draft",
    steps: [
      {
        componentType: "source.rest",
        componentVersion: "v1",
        configuration: {
          secretBindings: [{ binding: "orders-api", key: "apiToken" }],
          values: { url: "https://api.example.test/orders" },
        },
        id: identifiers.source,
        kind: "source",
      },
      {
        componentType: "export.csv",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { fileName: "orders.csv" } },
        id: identifiers.export,
        kind: "export",
      },
    ],
    triggers: [{ enabled: true, id: "423e4567-e89b-12d3-a456-426614174006", pipelineId: identifiers.pipeline, type: "manual" }],
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}
