import {
  deletePipeline,
  getPipeline,
  PipelineDeletionLockedError,
  updatePipeline,
  type DatabaseClient,
} from "@pantaetl/database";
import type { Pipeline } from "@pantaetl/contracts";
import { PipelineStateTransitionError } from "@pantaetl/pipeline";
import { describe, expect, it, vi } from "vitest";

import { createPipelineDetailRouteHandlers } from "../src/pipeline-api/detail.js";

const ids = {
  export: "623e4567-e89b-12d3-a456-426614174003",
  pipeline: "623e4567-e89b-12d3-a456-426614174001",
  source: "623e4567-e89b-12d3-a456-426614174002",
  user: "623e4567-e89b-12d3-a456-426614174004",
};

describe("pipeline detail API routes", () => {
  it("returns an authenticated owner's canonical pipeline", async () => {
    const dependencies = createDependencies({ getPipelineResult: pipeline });
    const handlers = createPipelineDetailRouteHandlers(dependencies);

    const response = await handlers.GET(routeInput());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(pipeline);
    expect(dependencies.getPipeline).toHaveBeenCalledWith(dependencies.database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
    });
  });

  it("makes inaccessible and absent pipelines indistinguishable", async () => {
    const absentDependencies = createDependencies({ getPipelineResult: undefined });
    const absentResponse = await createPipelineDetailRouteHandlers(absentDependencies).GET(routeInput());
    const inaccessibleDependencies = createDependencies({ getPipelineResult: undefined });
    const inaccessibleResponse = await createPipelineDetailRouteHandlers(inaccessibleDependencies).GET(routeInput());

    expect(absentResponse.status).toBe(404);
    expect(inaccessibleResponse.status).toBe(404);
    await expect(absentResponse.json()).resolves.toEqual(await inaccessibleResponse.json());
  });

  it("rejects unauthenticated requests before accessing pipeline data", async () => {
    const dependencies = createDependencies({ session: null });

    const response = await createPipelineDetailRouteHandlers(dependencies).GET(routeInput());

    expect(response.status).toBe(401);
    expect(dependencies.getPipeline).not.toHaveBeenCalled();
  });

  it("validates and atomically updates an authenticated owner's pipeline", async () => {
    const updated = { ...pipeline, name: "Updated orders", updatedAt: "2026-08-14T00:00:00.000Z" };
    const dependencies = createDependencies({ updatePipelineResult: updated });
    const request = new Request("https://pantaetl.test/api/pipelines/example", {
      body: JSON.stringify({ name: "Updated orders" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const response = await createPipelineDetailRouteHandlers(dependencies).PATCH(routeInput(request));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(updated);
    expect(dependencies.updatePipeline).toHaveBeenCalledWith(dependencies.database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
      update: { name: "Updated orders" },
    });
  });

  it("rejects malformed update documents before calling the repository", async () => {
    const dependencies = createDependencies();
    const request = new Request("https://pantaetl.test/api/pipelines/example", {
      body: JSON.stringify({ ownerUserId: "attacker" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const response = await createPipelineDetailRouteHandlers(dependencies).PATCH(routeInput(request));

    expect(response.status).toBe(400);
    expect(dependencies.updatePipeline).not.toHaveBeenCalled();
  });

  it("returns a safe conflict when queued or running work locks an update", async () => {
    const dependencies = createDependencies({
      updatePipelineError: new PipelineStateTransitionError("Pipeline configuration is locked while a run is queued or active."),
    });
    const request = new Request("https://pantaetl.test/api/pipelines/example", {
      body: JSON.stringify({ name: "Blocked" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const response = await createPipelineDetailRouteHandlers(dependencies).PATCH(routeInput(request));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "pipeline_locked" });
  });

  it("deletes only an authenticated owner's idle pipeline", async () => {
    const dependencies = createDependencies({ deletePipelineResult: true });

    const response = await createPipelineDetailRouteHandlers(dependencies).DELETE(routeInput());

    expect(response.status).toBe(204);
    expect(dependencies.deletePipeline).toHaveBeenCalledWith(dependencies.database, {
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
    });
  });

  it("maps deletion locks to a safe conflict without exposing pipeline details", async () => {
    const dependencies = createDependencies({ deletePipelineError: new PipelineDeletionLockedError() });

    const response = await createPipelineDetailRouteHandlers(dependencies).DELETE(routeInput());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "pipeline_locked" });
  });
});

interface DependencyOptions {
  readonly deletePipelineError?: Error;
  readonly deletePipelineResult?: boolean;
  readonly getPipelineResult?: Pipeline | undefined;
  readonly session?: { readonly user: { readonly id: string } } | null;
  readonly updatePipelineError?: Error;
  readonly updatePipelineResult?: Pipeline | undefined;
}

/** Creates isolated route dependencies so HTTP behavior can be tested without PostgreSQL or Better Auth. */
function createDependencies(options: DependencyOptions = {}) {
  const database = {} as DatabaseClient;
  const getSession = vi.fn(async () => options.session === undefined ? { user: { id: ids.user } } : options.session);
  const getPipelineMock = vi.fn(async () => options.getPipelineResult);
  const updatePipelineMock = vi.fn(async () => {
    if (options.updatePipelineError) throw options.updatePipelineError;
    return options.updatePipelineResult;
  });
  const deletePipelineMock = vi.fn(async () => {
    if (options.deletePipelineError) throw options.deletePipelineError;
    return options.deletePipelineResult ?? false;
  });

  return {
    database,
    deletePipeline: deletePipelineMock as typeof deletePipeline,
    getPipeline: getPipelineMock as typeof getPipeline,
    getSession,
    updatePipeline: updatePipelineMock as typeof updatePipeline,
  };
}

/** Creates route-shaped input with a valid pipeline identity. */
function routeInput(request: Request = new Request("https://pantaetl.test/api/pipelines/example")) {
  return { params: { pipelineId: ids.pipeline }, request };
}

const pipeline: Pipeline = {
  contractVersion: "v1",
  createdAt: "2026-08-13T00:00:00.000Z",
  edges: [{ fromStepId: ids.source, toStepId: ids.export }],
  id: ids.pipeline,
  name: "Daily orders",
  ownerUserId: ids.user,
  state: "draft",
  steps: [
    {
      componentType: "source.csv",
      componentVersion: "v1",
      configuration: { secretBindings: [{ binding: "ORDERS_TOKEN", key: "token" }], values: { path: "orders.csv" } },
      id: ids.source,
      kind: "source",
    },
    {
      componentType: "export.json",
      componentVersion: "v1",
      configuration: { secretBindings: [], values: { path: "orders.json" } },
      id: ids.export,
      kind: "export",
    },
  ],
  triggers: [],
  updatedAt: "2026-08-13T00:00:00.000Z",
};
