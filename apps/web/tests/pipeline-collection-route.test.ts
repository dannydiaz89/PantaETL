import { pipelineCreateResponseSchema, type Pipeline, type PipelineCreateRequest } from "@pantaetl/contracts";
import { InvalidPipelineTopologyError, type DatabaseClient } from "@pantaetl/database";
import { describe, expect, it, vi } from "vitest";

import {
  createPipelineCollectionRouteHandlers,
  type PipelineCollectionRouteDependencies,
} from "../src/pipelines/collection-route.js";

const ownerUserId = "123e4567-e89b-12d3-a456-426614174000";
const otherOwnerUserId = "223e4567-e89b-12d3-a456-426614174000";
const pipelineId = "323e4567-e89b-12d3-a456-426614174000";
const sourceId = "423e4567-e89b-12d3-a456-426614174000";
const exportId = "523e4567-e89b-12d3-a456-426614174000";
const triggerId = "623e4567-e89b-12d3-a456-426614174000";

describe("pipeline collection routes", () => {
  it("requires a signed-in user for list and create requests", async () => {
    const dependencies = createDependencies({ session: null });
    const handlers = createPipelineCollectionRouteHandlers(dependencies);

    await expect(handlers.GET({ request: new Request("https://pantaetl.test/api/pipelines") })).resolves.toMatchObject({
      status: 401,
    });
    await expect(handlers.POST({ request: jsonRequest({}) })).resolves.toMatchObject({ status: 401 });
    expect(dependencies.listPipelinesByOwner).not.toHaveBeenCalled();
    expect(dependencies.createPipeline).not.toHaveBeenCalled();
  });

  it("lists only the pipelines for the authenticated user", async () => {
    const pipeline = completePipeline();
    const dependencies = createDependencies({ pipelines: [pipeline] });
    const handlers = createPipelineCollectionRouteHandlers(dependencies);

    const response = await handlers.GET({ request: new Request("https://pantaetl.test/api/pipelines") });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ pipelines: [pipeline] });
    expect(dependencies.listPipelinesByOwner).toHaveBeenCalledWith(dependencies.database, ownerUserId);
    expect(JSON.stringify(pipeline)).not.toContain("usable-secret");
  });

  it("creates a pipeline for the signed-in user and never accepts a caller owner", async () => {
    const request = createRequest();
    const pipeline = completePipeline();
    const dependencies = createDependencies({ created: pipeline });
    const handlers = createPipelineCollectionRouteHandlers(dependencies);

    const response = await handlers.POST({ request: jsonRequest({ ...request, ownerUserId: otherOwnerUserId }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "invalid_pipeline_request" });
    expect(dependencies.createPipeline).not.toHaveBeenCalled();
  });

  it("returns the canonical created pipeline with a 201 response", async () => {
    const request = createRequest();
    const pipeline = completePipeline();
    const dependencies = createDependencies({ created: pipeline });
    const handlers = createPipelineCollectionRouteHandlers(dependencies);

    const response = await handlers.POST({ request: jsonRequest(request) });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(pipeline);
    expect(dependencies.createPipeline).toHaveBeenCalledWith(dependencies.database, {
      ownerUserId,
      pipeline: request,
    });
  });

  it("maps a graph topology rejection to a safe bad-request response", async () => {
    const dependencies = createDependencies({
      createError: new InvalidPipelineTopologyError("The secret must never be exposed."),
    });
    const handlers = createPipelineCollectionRouteHandlers(dependencies);

    const response = await handlers.POST({ request: jsonRequest(createRequest()) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: "invalid_pipeline_request" });
  });
});

/** Creates testable route dependencies without a database or Better Auth runtime. */
function createDependencies(options: {
  readonly created?: Pipeline;
  readonly createError?: Error;
  readonly pipelines?: readonly Pipeline[];
  readonly session?: { readonly user: { readonly id: string } } | null;
} = {}): PipelineCollectionRouteDependencies & {
  readonly createPipeline: ReturnType<typeof vi.fn>;
  readonly listPipelinesByOwner: ReturnType<typeof vi.fn>;
} {
  const database = {} as DatabaseClient;
  const created = options.created ?? completePipeline();
  const create = vi.fn(async () => {
    if (options.createError) throw options.createError;
    return created;
  });
  const list = vi.fn(async () => options.pipelines ?? []);

  return {
    createPipeline: create as never,
    database,
    getSession: async () => options.session === undefined ? { user: { id: ownerUserId } } : options.session,
    listPipelinesByOwner: list as never,
  };
}

/** Creates a JSON request for route-handler testing. */
function jsonRequest(body: unknown): Request {
  return new Request("https://pantaetl.test/api/pipelines", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

/** Builds valid request input that contains no caller-controlled ownership fields. */
function createRequest(): PipelineCreateRequest {
  return {
    contractVersion: "v1",
    edges: [{ fromStepId: sourceId, toStepId: exportId }],
    name: "Daily orders",
    steps: [
      {
        componentType: "source.rest-api",
        componentVersion: "v1",
        configuration: {
          secretBindings: [{ binding: "ORDERS_API_TOKEN", key: "apiToken" }],
          values: { endpoint: "https://example.test/orders" },
        },
        id: sourceId,
        kind: "source",
      },
      {
        componentType: "export.json",
        componentVersion: "v1",
        configuration: { secretBindings: [], values: { path: "orders.json" } },
        id: exportId,
        kind: "export",
      },
    ],
    triggers: [{ enabled: true, type: "manual" }],
  };
}

/** Builds a canonical persisted pipeline response with only secret-binding metadata. */
function completePipeline(): Pipeline {
  return pipelineCreateResponseSchema.parse({
    ...createRequest(),
    createdAt: "2026-08-13T00:00:00.000Z",
    id: pipelineId,
    ownerUserId,
    state: "draft",
    triggers: [{ enabled: true, id: triggerId, pipelineId, type: "manual" }],
    updatedAt: "2026-08-13T00:00:00.000Z",
  });
}
