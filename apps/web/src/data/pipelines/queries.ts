import { queryOptions, useQuery } from "@tanstack/react-query";
import type { PipelineDetailRequest } from "@pantaetl/contracts";

import { pipelineApiClient, type PipelineApiClient } from "./api.js";
import { pipelineQueryKeys } from "./keys.js";

/** Returns reusable options for the authenticated owner's pipeline collection. */
export function pipelineListQueryOptions(client: PipelineApiClient = pipelineApiClient) {
  return queryOptions({
    queryFn: client.list,
    queryKey: pipelineQueryKeys.list(),
  });
}

/** Returns reusable options for one authenticated owner's pipeline graph. */
export function pipelineDetailQueryOptions(
  request: PipelineDetailRequest,
  client: PipelineApiClient = pipelineApiClient,
) {
  return queryOptions({
    queryFn: () => client.get(request),
    queryKey: pipelineQueryKeys.detail(request),
  });
}

/** Reads the authenticated owner's complete pipeline collection. */
export function usePipelineListQuery(client: PipelineApiClient = pipelineApiClient) {
  return useQuery(pipelineListQueryOptions(client));
}

/** Reads one pipeline graph belonging to the authenticated user. */
export function usePipelineDetailQuery(
  request: PipelineDetailRequest,
  client: PipelineApiClient = pipelineApiClient,
) {
  return useQuery(pipelineDetailQueryOptions(request, client));
}
