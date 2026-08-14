import { QueryClient } from "@tanstack/react-query";
import type { Pipeline } from "@pantaetl/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  PipelineApiError,
  createPipelineActionApiClient,
  duplicatePipelineMutationOptions,
  pipelineQueryKeys,
  runPipelineMutationOptions,
  statePipelineMutationOptions,
} from "../src/data/pipelines/index.js";

const ids = {
  export: "833e4567-e89b-12d3-a456-426614174003",
  pipeline: "833e4567-e89b-12d3-a456-426614174001",
  run: "833e4567-e89b-12d3-a456-426614174005",
  source: "833e4567-e89b-12d3-a456-426614174002",
  user: "833e4567-e89b-12d3-a456-426614174004",
};

describe("pipeline action data layer", () => {
  it("uses canonical action endpoints and request documents", async () => {
    const fetch = vi.fn(async () => Response.json(pipeline));
    const client = createPipelineActionApiClient(fetch as typeof globalThis.fetch);

    await expect(client.duplicate({ pipelineId: ids.pipeline })).resolves.toEqual(pipeline);
    expect(fetch).toHaveBeenCalledWith(`/api/pipelines/${ids.pipeline}/duplicate`, {
      body: "{}",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  });

  it("maps action conflicts to stable errors without retaining server diagnostics", async () => {
    const client = createPipelineActionApiClient((async () => Response.json({ code: "pipeline_not_enabled" }, { status: 409 })) as typeof globalThis.fetch);

    await expect(client.run({ pipelineId: ids.pipeline })).rejects.toEqual(
      new PipelineApiError("pipeline_not_enabled", 409),
    );
  });

  it("reconciles duplicated and availability state pipelines while invalidating a queued run", async () => {
    const queryClient = new QueryClient();
    const copy = { ...pipeline, id: "933e4567-e89b-12d3-a456-426614174001", state: "draft" as const };
    const client = {
      disable: async () => ({ ...pipeline, state: "disabled" as const }),
      duplicate: async () => copy,
      enable: async () => ({ ...pipeline, state: "enabled" as const }),
      getExecutionState: async () => ({}),
      run: async () => ({ initialJobCount: 1, pipelineId: ids.pipeline, queuedBehindActiveRun: false, runId: ids.run }),
    };
    queryClient.setQueryData(pipelineQueryKeys.detail({ pipelineId: ids.pipeline }), pipeline);
    queryClient.setQueryData(pipelineQueryKeys.list(), { pipelines: [pipeline] });

    await duplicatePipelineMutationOptions(queryClient, client).onSuccess(copy);
    await statePipelineMutationOptions(queryClient, client, "disable").onSuccess({ ...pipeline, state: "disabled" });
    await runPipelineMutationOptions(queryClient, client).onSuccess(
      { initialJobCount: 1, pipelineId: ids.pipeline, queuedBehindActiveRun: false, runId: ids.run },
      { pipelineId: ids.pipeline },
    );

    expect(queryClient.getQueryData(pipelineQueryKeys.detail({ pipelineId: copy.id }))).toEqual(copy);
    expect(queryClient.getQueryData(pipelineQueryKeys.detail({ pipelineId: ids.pipeline }))).toEqual({ ...pipeline, state: "disabled" });
    expect(queryClient.getQueryCache().find({ queryKey: pipelineQueryKeys.detail({ pipelineId: ids.pipeline }) })?.state.isInvalidated).toBe(true);
  });

});

const pipeline: Pipeline = {
  contractVersion: "v1",
  createdAt: "2026-08-13T00:00:00.000Z",
  edges: [{ fromStepId: ids.source, toStepId: ids.export }],
  id: ids.pipeline,
  name: "Daily orders",
  ownerUserId: ids.user,
  state: "enabled",
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
