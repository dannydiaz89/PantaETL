import type { PipelineDetailRequest } from "@pantaetl/contracts";

/** Centralized cache identities for owner-scoped pipeline resources. */
export const pipelineQueryKeys = {
  all: ["pipelines"] as const,
  details: () => [...pipelineQueryKeys.all, "detail"] as const,
  detail: ({ pipelineId }: PipelineDetailRequest) => [...pipelineQueryKeys.details(), pipelineId] as const,
  lists: () => [...pipelineQueryKeys.all, "list"] as const,
  list: () => [...pipelineQueryKeys.lists()] as const,
};
