import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  Pipeline,
  PipelineDetailRequest,
  PipelineListResponse,
  PipelineUpdateRequest,
} from "@pantaetl/contracts";

import { pipelineApiClient, type PipelineApiClient } from "./api.js";
import { pipelineQueryKeys } from "./keys.js";

/** Variables needed to atomically update one authenticated owner's pipeline. */
export interface UpdatePipelineVariables extends PipelineDetailRequest {
  readonly update: PipelineUpdateRequest;
}

/** Returns a mutation that creates a pipeline and reconciles its known collection and detail caches. */
export function useCreatePipelineMutation(client: PipelineApiClient = pipelineApiClient) {
  const queryClient = useQueryClient();
  return useMutation(createPipelineMutationOptions(queryClient, client));
}

/** Returns a mutation that updates a pipeline and reconciles every affected cache entry. */
export function useUpdatePipelineMutation(client: PipelineApiClient = pipelineApiClient) {
  const queryClient = useQueryClient();
  return useMutation(updatePipelineMutationOptions(queryClient, client));
}

/** Returns a mutation that deletes a pipeline and removes obsolete collection and detail cache entries. */
export function useDeletePipelineMutation(client: PipelineApiClient = pipelineApiClient) {
  const queryClient = useQueryClient();
  return useMutation(deletePipelineMutationOptions(queryClient, client));
}

/** Creates testable mutation options for pipeline creation. */
export function createPipelineMutationOptions(queryClient: QueryClient, client: PipelineApiClient = pipelineApiClient) {
  return {
    mutationFn: client.create,
    onSuccess: async (pipeline: Pipeline) => {
      writePipeline(queryClient, pipeline);
      await queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.lists() });
    },
  };
}

/** Creates testable mutation options for atomic pipeline updates. */
export function updatePipelineMutationOptions(queryClient: QueryClient, client: PipelineApiClient = pipelineApiClient) {
  return {
    mutationFn: client.update,
    onSuccess: async (pipeline: Pipeline) => {
      writePipeline(queryClient, pipeline);
      await queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.lists() });
    },
  };
}

/** Creates testable mutation options for owner-scoped pipeline deletion. */
export function deletePipelineMutationOptions(queryClient: QueryClient, client: PipelineApiClient = pipelineApiClient) {
  return {
    mutationFn: async (request: PipelineDetailRequest) => {
      await client.delete(request);
      return undefined;
    },
    onSuccess: async (_unused: undefined, request: PipelineDetailRequest) => {
      queryClient.removeQueries({ queryKey: pipelineQueryKeys.detail(request) });
      removePipelineFromList(queryClient, request);
      await queryClient.invalidateQueries({ queryKey: pipelineQueryKeys.lists() });
    },
  };
}

/** Writes a fresh pipeline to its detail cache and replaces it in a cached collection when available. */
function writePipeline(queryClient: QueryClient, pipeline: Pipeline): void {
  queryClient.setQueryData(pipelineQueryKeys.detail({ pipelineId: pipeline.id }), pipeline);
  queryClient.setQueryData<PipelineListResponse>(pipelineQueryKeys.list(), (current) => {
    if (current === undefined) return current;

    const existingIndex = current.pipelines.findIndex((candidate) => candidate.id === pipeline.id);
    const pipelines = existingIndex === -1
      ? [...current.pipelines, pipeline]
      : current.pipelines.map((candidate) => candidate.id === pipeline.id ? pipeline : candidate);
    return { pipelines };
  });
}

/** Removes a deleted pipeline from a cached collection when that collection is already present. */
function removePipelineFromList(queryClient: QueryClient, request: PipelineDetailRequest): void {
  queryClient.setQueryData<PipelineListResponse>(pipelineQueryKeys.list(), (current) => {
    if (current === undefined) return current;

    return { pipelines: current.pipelines.filter((pipeline) => pipeline.id !== request.pipelineId) };
  });
}
