import { describe, expect, it } from "vitest";

import { pipelineSchema, triggerSchema } from "../src/pipeline/index.js";

const ids = {
  export: "123e4567-e89b-12d3-a456-426614174020",
  pipeline: "123e4567-e89b-12d3-a456-426614174021",
  source: "123e4567-e89b-12d3-a456-426614174022",
  trigger: "123e4567-e89b-12d3-a456-426614174023",
  user: "123e4567-e89b-12d3-a456-426614174024",
};
const timestamp = "2026-08-13T01:00:00Z";

describe("portable pipelines", () => {
  it("keeps triggers separate from Source steps and binds secrets by reference", () => {
    expect(
      pipelineSchema.safeParse({
        contractVersion: "v1",
        id: ids.pipeline,
        ownerUserId: ids.user,
        name: "Daily export",
        state: "enabled",
        createdAt: timestamp,
        updatedAt: timestamp,
        steps: [
          {
            id: ids.source,
            kind: "source",
            componentType: "source.rest-api",
            componentVersion: "v1",
            configuration: {
              values: { endpoint: "https://example.test/data" },
              secretBindings: [{ key: "apiToken", binding: "REST_API_TOKEN" }],
            },
          },
          {
            id: ids.export,
            kind: "export",
            componentType: "export.json",
            componentVersion: "v1",
            configuration: { values: { path: "daily.json" }, secretBindings: [] },
          },
        ],
        edges: [{ fromStepId: ids.source, toStepId: ids.export }],
        triggers: [
          {
            id: ids.trigger,
            pipelineId: ids.pipeline,
            type: "schedule",
            enabled: true,
            cron: "0 8 * * *",
            timezone: "UTC",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects usable secret values in portable configuration", () => {
    expect(
      pipelineSchema.safeParse({
        contractVersion: "v1",
        id: ids.pipeline,
        ownerUserId: ids.user,
        name: "Unsafe export",
        state: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
        steps: [
          {
            id: ids.source,
            kind: "source",
            componentType: "source.rest-api",
            componentVersion: "v1",
            configuration: {
              values: { apiToken: "usable-secret" },
              secretBindings: [],
            },
          },
          {
            id: ids.export,
            kind: "export",
            componentType: "export.json",
            componentVersion: "v1",
            configuration: { values: {}, secretBindings: [] },
          },
        ],
        edges: [{ fromStepId: ids.source, toStepId: ids.export }],
        triggers: [],
      }).success,
    ).toBe(false);
  });

  it("validates a standalone trigger as a distinct contract", () => {
    expect(
      triggerSchema.safeParse({
        id: ids.trigger,
        pipelineId: ids.pipeline,
        type: "manual",
        enabled: true,
      }).success,
    ).toBe(true);
  });
});
