import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ComponentCapabilityListRequest } from "@pantaetl/contracts";

import { componentCapabilityApiClient, type ComponentCapabilityApiClient } from "./api.js";
import { componentCapabilityQueryKeys } from "./keys.js";

/** Returns reusable options for a kind-aware component capability catalog query. */
export function componentCapabilityListQueryOptions(
  request: ComponentCapabilityListRequest = {},
  client: ComponentCapabilityApiClient = componentCapabilityApiClient,
) {
  return queryOptions({
    queryFn: () => client.list(request),
    queryKey: componentCapabilityQueryKeys.list(request),
    retry: false,
  });
}

/** Reads the authenticated user's available components, optionally limited to one kind. */
export function useComponentCapabilityListQuery(
  request: ComponentCapabilityListRequest = {},
  client: ComponentCapabilityApiClient = componentCapabilityApiClient,
) {
  return useQuery(componentCapabilityListQueryOptions(request, client));
}
