import type { ComponentCapabilityListRequest } from "@pantaetl/contracts";

/** Centralized cache identities for authenticated component capability resources. */
export const componentCapabilityQueryKeys = {
  all: ["component-capabilities"] as const,
  lists: () => [...componentCapabilityQueryKeys.all, "list"] as const,
  list: (request: ComponentCapabilityListRequest = {}) => [
    ...componentCapabilityQueryKeys.lists(),
    request.kind ?? "all",
  ] as const,
};
