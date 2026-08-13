import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Pipeline, PipelineDetailRequest, PipelineDuplicateRequest, PipelineRunResponse } from "@pantaetl/contracts";

import { pipelineActionApiClient, type PipelineActionApiClient } from "./actions.js";
import { pipelineQueryKeys } from "./keys.js";

/** Returns the mutation used to create a fresh disabled draft copy of a pipeline. */
export function useDuplicatePipelineMutation(client: PipelineActionApiClient = pipelineActionApiClient) {
  const queryClient = useQueryClient();
  return useMutation(duplicatePipelineMutationOptions(queryClient, client));
}

/** Returns the mutation used to enqueue one enabled pipeline for execution. */
export function useRunPipelineMutation(client: PipelineActionApiClient = pipelineActionApiClient) {
  const queryClient = useQueryClient();
  return useMutation(runPipelineMutationOptions(queryClient, client));
}

/** Returns the mutation used to enable an idle pipeline. */
export function useEnablePipelineMutation(client: PipelineActionApiClient = pipelineActionApiClient) {
  const queryClient = useQueryClient();
  return useMutation(statePipelineMutationOptions(queryClient, client, "enable"));
}

/** Returns the mutation used to disable an idle pipeline. */
export function useDisablePipelineMutation(client: PipelineActionApiClient = pipelineActionApiClient) {
  const queryClient = useQueryClient();
  return useMutation(statePipelineMutationOptions(queryClient, client, "disable"));
}

/** Creates testable cache-reconciliation behavior for a successfully duplicated pipeline. */
export function duplicatePipelineMutationOptions(queryClient: QueryClient, client: PipelineActionApiClient = pipelineActionApiClient) {
  return {
    mutationFn: (request: PipelineDuplicateRequest) => client.duplicate(request),
    onSuccess: async (pipeline: Pipeline) => {
      writePipeline(queryClient, pipeline);
      await queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.lists() });
    },
  };
}

/** Creates testable cache-invalidation behavior for an execution request. */
export function runPipelineMutationOptions(queryClient: QueryClient, client: PipelineActionApiClient = pipelineActionApiClient) {
  return {
    mutationFn: (request: PipelineDetailRequest) => client.run(request),
    onSuccess: async (_run: PipelineRunResponse, request: PipelineDetailRequest) => {
      await invalidatePipeline(queryClient, request);
    },
  };
}

/** Creates testable cache-reconciliation behavior for a successful availability state change. */
export function statePipelineMutationOptions(
  queryClient: QueryClient,
  client: PipelineActionApiClient = pipelineActionApiClient,
  action: "disable" | "enable",
) {
  return {
    mutationFn: (request: PipelineDetailRequest) => client[action](request),
    onSuccess: async (pipeline: Pipeline) => {
      writePipeline(queryClient, pipeline);
      await queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.lists() });
    },
  };
}

/** Writes an action result into the owner-scoped detail cache before collection refetching. */
function writePipeline(queryClient: QueryClient, pipeline: Pipeline): void {
  queryClient.setQueryData(pipelineQueryKeys.detail({ pipelineId: pipeline.id }), pipeline);
}

/** Invalidate only the collection and selected graph affected by a newly queued run. */
async function invalidatePipeline(queryClient: QueryClient, request: PipelineDetailRequest): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.detail(request) }),
    queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.lists() }),
  ]);
}
