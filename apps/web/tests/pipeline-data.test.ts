import { QueryClient } from "@tanstack/react-query";
import type { Pipeline } from "@pantaetl/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  PipelineApiError,
  createPipelineApiClient,
  createPipelineMutationOptions,
  deletePipelineMutationOptions,
  pipelineDetailQueryOptions,
  pipelineListQueryOptions,
  pipelineQueryKeys,
  updatePipelineMutationOptions,
} from "../src/data/pipelines/index.js";

const ids = {
  export: "833e4567-e89b-12d3-a456-426614174003",
  pipeline: "833e4567-e89b-12d3-a456-426614174001",
  source: "833e4567-e89b-12d3-a456-426614174002",
  user: "833e4567-e89b-12d3-a456-426614174004",
};

describe("pipeline data layer", () => {
  it("uses centralized owner-scoped keys for list and detail queries", () => {
    const client = createClient();

    expect(pipelineListQueryOptions(client).queryKey).toEqual(["pipelines", "list"]);
    expect(pipelineDetailQueryOptions({ pipelineId: ids.pipeline }, client).queryKey).toEqual([
      "pipelines",
      "detail",
      ids.pipeline,
    ]);
  });

  it("validates successful API responses before exposing a pipeline", async () => {
    const fetch = vi.fn(async () => jsonResponse(pipeline));
    const client = createPipelineApiClient(fetch as typeof globalThis.fetch);

    await expect(client.get({ pipelineId: ids.pipeline })).resolves.toEqual(pipeline);
    expect(fetch).toHaveBeenCalledWith(`/api/pipelines/${ids.pipeline}`, {
      credentials: "same-origin",
      headers: undefined,
      method: "GET",
    });
  });

  it("rejects malformed successful API responses with a structured error", async () => {
    const client = createPipelineApiClient((async () => jsonResponse({ pipeline: "not canonical" })) as typeof globalThis.fetch);

    await expect(client.list()).rejects.toEqual(new PipelineApiError("invalid_response", 200));
  });

  it("does not expose request validation diagnostics or perform a request for invalid input", async () => {
    const fetch = vi.fn();
    const client = createPipelineApiClient(fetch as typeof globalThis.fetch);

    await expect(client.create({ name: "Invalid" } as never)).rejects.toEqual(
      new PipelineApiError("invalid_pipeline_request", undefined),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps safe API failures without retaining response diagnostics", async () => {
    const client = createPipelineApiClient((async () => jsonResponse({ code: "pipeline_locked" }, 409)) as typeof globalThis.fetch);

    await expect(client.update({ pipelineId: ids.pipeline, update: { name: "Blocked update" } })).rejects.toEqual(
      new PipelineApiError("pipeline_locked", 409),
    );
  });

  it("reconciles list and detail caches after creation and updates", async () => {
    const queryClient = new QueryClient();
    const client = createClient();
    queryClient.setQueryData(pipelineQueryKeys.list(), { pipelines: [pipeline] });

    await createPipelineMutationOptions(queryClient, client).onSuccess({ ...pipeline, id: "933e4567-e89b-12d3-a456-426614174001" });
    await updatePipelineMutationOptions(queryClient, client).onSuccess({ ...pipeline, name: "Updated orders" });

    expect(queryClient.getQueryData(pipelineQueryKeys.detail({ pipelineId: ids.pipeline }))).toEqual({
      ...pipeline,
      name: "Updated orders",
    });
    expect(queryClient.getQueryData<{ pipelines: readonly Pipeline[] }>(pipelineQueryKeys.list())).toEqual({
      pipelines: [
        { ...pipeline, name: "Updated orders" },
        { ...pipeline, id: "933e4567-e89b-12d3-a456-426614174001" },
      ],
    });
  });

  it("removes a deleted pipeline from the affected detail and list caches", async () => {
    const queryClient = new QueryClient();
    const client = createClient();
    queryClient.setQueryData(pipelineQueryKeys.detail({ pipelineId: ids.pipeline }), pipeline);
    queryClient.setQueryData(pipelineQueryKeys.list(), { pipelines: [pipeline] });

    await deletePipelineMutationOptions(queryClient, client).onSuccess(undefined, { pipelineId: ids.pipeline });

    expect(queryClient.getQueryData(pipelineQueryKeys.detail({ pipelineId: ids.pipeline }))).toBeUndefined();
    expect(queryClient.getQueryData<{ pipelines: readonly Pipeline[] }>(pipelineQueryKeys.list())).toEqual({ pipelines: [] });
  });
});

/** Creates a no-network API client for query and mutation option tests. */
function createClient() {
  return {
    create: async () => pipeline,
    delete: async () => undefined,
    get: async () => pipeline,
    list: async () => ({ pipelines: [pipeline] }),
    update: async () => pipeline,
  };
}

/** Builds a JSON response with the status codes used by the control-plane boundary. */
function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
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
};
