import { describe, expect, it, vi } from "vitest";

import {
  PipelineActionConflictError,
  type DatabaseClient,
  type EnqueuedPipelineRun,
} from "@pantaetl/database";
import { pipelineCreateResponseSchema, type ComponentMetadata, type Pipeline } from "@pantaetl/contracts";

import { createPipelineActionRouteHandlers } from "../src/pipeline-api/actions.js";
import { PipelineSchedulerConflictError } from "../src/pipeline-api/scheduler.js";

const ids = {
  export: "123e4567-e89b-12d3-a456-426614174001",
  pipeline: "123e4567-e89b-12d3-a456-426614174002",
  run: "123e4567-e89b-12d3-a456-426614174003",
  source: "123e4567-e89b-12d3-a456-426614174004",
  user: "123e4567-e89b-12d3-a456-426614174005",
};

describe("pipeline action API routes", () => {
  it("requires authentication before duplicate, run, enable, or disable actions", async () => {
    const dependencies = createDependencies({ session: null });
    const handlers = createPipelineActionRouteHandlers(dependencies);

    for (const handler of [handlers.DUPLICATE, handlers.RUN, handlers.ENABLE, handlers.DISABLE]) {
      await expect(handler(routeInput())).resolves.toMatchObject({ status: 401 });
    }

    expect(dependencies.duplicatePipeline).not.toHaveBeenCalled();
    expect(dependencies.enqueuePipelineRun).not.toHaveBeenCalled();
    expect(dependencies.enablePipelineForOwner).not.toHaveBeenCalled();
    expect(dependencies.disablePipelineForOwner).not.toHaveBeenCalled();
  });

  it("duplicates an owner-scoped pipeline as a canonical draft response", async () => {
    const duplicate = { ...pipeline, id: "223e4567-e89b-12d3-a456-426614174002", name: "Orders copy" };
    const dependencies = createDependencies({ duplicated: duplicate });
    const request = jsonRequest({ name: "Orders copy" });

    const response = await createPipelineActionRouteHandlers(dependencies).DUPLICATE(routeInput(request));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(duplicate);
    expect(dependencies.duplicatePipeline).toHaveBeenCalledWith(dependencies.database, {
      name: "Orders copy",
      ownerUserId: ids.user,
      pipelineId: ids.pipeline,
    });
  });

  it("rejects caller-controlled duplicate identifiers before accessing the repository", async () => {
    const dependencies = createDependencies();
    const response = await createPipelineActionRouteHandlers(dependencies).DUPLICATE(routeInput(jsonRequest({
      pipelineId: "223e4567-e89b-12d3-a456-426614174002",
    })));

    expect(response.status).toBe(400);
    expect(dependencies.duplicatePipeline).not.toHaveBeenCalled();
  });

  it("enqueues a validated manual run through the scheduler adapter", async () => {
    const run: EnqueuedPipelineRun = {
      initialJobCount: 1,
      pipelineId: ids.pipeline as EnqueuedPipelineRun["pipelineId"],
      queuedBehindActiveRun: false,
      runId: ids.run,
    };
    const dependencies = createDependencies({ run });

    const response = await createPipelineActionRouteHandlers(dependencies).RUN(routeInput());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(run);
    expect(dependencies.enqueuePipelineRun).toHaveBeenCalledWith({ ownerUserId: ids.user, pipelineId: ids.pipeline });
  });

  it("maps a scheduler invalid-state conflict without exposing details", async () => {
    const dependencies = createDependencies({
      runError: new PipelineSchedulerConflictError("pipeline_not_enabled"),
    });

    const response = await createPipelineActionRouteHandlers(dependencies).RUN(routeInput());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "pipeline_not_enabled" });
  });

  it("returns the canonical pipeline after enabling an idle owner-scoped pipeline", async () => {
    const enabled = { ...pipeline, state: "enabled" as const };
    const dependencies = createDependencies({ getPipelineResult: enabled });

    const response = await createPipelineActionRouteHandlers(dependencies).ENABLE(routeInput());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(enabled);
    expect(dependencies.enablePipelineForOwner).toHaveBeenCalledWith(
      dependencies.database,
      { ownerUserId: ids.user, pipelineId: ids.pipeline },
      dependencies.availableComponents,
    );
  });

  it("returns a structured conflict with violations when a pipeline fails executable validation", async () => {
    const violations = [{ kind: "missing-export" as const }];
    const dependencies = createDependencies({
      enableError: new PipelineActionConflictError(
        "not_executable",
        "The pipeline is not executable and cannot be enabled.",
        violations,
      ),
    });

    const response = await createPipelineActionRouteHandlers(dependencies).ENABLE(routeInput());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "pipeline_not_executable", violations });
  });

  it("returns a safe conflict when queued work prevents disabling", async () => {
    const dependencies = createDependencies({
      disableError: new PipelineActionConflictError("locked", "The pipeline is locked while a run is active."),
    });

    const response = await createPipelineActionRouteHandlers(dependencies).DISABLE(routeInput());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "pipeline_locked" });
  });
});

/** Creates route dependencies with no Better Auth, PostgreSQL, or scheduler network requirement. */
function createDependencies(options: {
  readonly disableError?: Error;
  readonly duplicated?: Pipeline;
  readonly enableError?: Error;
  readonly getPipelineResult?: Pipeline;
  readonly run?: EnqueuedPipelineRun;
  readonly runError?: Error;
  readonly session?: { readonly user: { readonly id: string } } | null;
} = {}) {
  const database = {} as DatabaseClient;
  const availableComponents: readonly ComponentMetadata[] = [];
  const duplicatePipeline = vi.fn(async () => options.duplicated ?? pipeline);
  const enqueuePipelineRun = vi.fn(async () => {
    if (options.runError) throw options.runError;
    return options.run ?? {
      initialJobCount: 1,
      pipelineId: ids.pipeline,
      queuedBehindActiveRun: false,
      runId: ids.run,
    };
  });
  const enablePipelineForOwner = vi.fn(async () => {
    if (options.enableError) throw options.enableError;
    return { pipelineId: ids.pipeline, state: "enabled" };
  });
  const disablePipelineForOwner = vi.fn(async () => {
    if (options.disableError) throw options.disableError;
    return { pipelineId: ids.pipeline, state: "disabled" };
  });
  const getPipeline = vi.fn(async () => options.getPipelineResult ?? pipeline);

  return {
    availableComponents,
    database,
    disablePipelineForOwner: disablePipelineForOwner as never,
    duplicatePipeline: duplicatePipeline as never,
    enablePipelineForOwner: enablePipelineForOwner as never,
    enqueuePipelineRun: enqueuePipelineRun as never,
    getPipeline: getPipeline as never,
    getSession: async () => options.session === undefined ? { user: { id: ids.user } } : options.session,
  };
}

/** Creates a route-shaped request with the valid pipeline identity. */
function routeInput(request: Request = new Request("https://pantaetl.test/api/pipelines/example/run")) {
  return { params: { pipelineId: ids.pipeline }, request };
}

/** Creates a JSON action request to exercise duplicate request parsing. */
function jsonRequest(body: unknown): Request {
  return new Request("https://pantaetl.test/api/pipelines/example/duplicate", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

/** Creates the persisted canonical pipeline used by successful action responses. */
const pipeline = pipelineCreateResponseSchema.parse({
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
      configuration: { secretBindings: [], values: { path: "orders.csv" } },
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
});
