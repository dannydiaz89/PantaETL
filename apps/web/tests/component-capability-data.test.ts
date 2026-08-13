import type { ComponentCapabilityListResponse } from "@pantaetl/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  ComponentCapabilityApiError,
  componentCapabilityListQueryOptions,
  componentCapabilityQueryKeys,
  createComponentCapabilityApiClient,
} from "../src/data/components/index.js";

const catalog: ComponentCapabilityListResponse = {
  components: [
    {
      configFields: [],
      descriptionKey: "components.sources.csv.description",
      displayNameKey: "components.sources.csv.name",
      inputFamilies: [],
      kind: "source",
      outputFamilies: ["tabular"],
      type: "source.csv",
      version: "v1",
    },
  ],
};

describe("component capability data layer", () => {
  it("uses centralized kind-aware cache keys", () => {
    const client = createClient();

    expect(componentCapabilityQueryKeys.list()).toEqual(["component-capabilities", "list", "all"]);
    expect(componentCapabilityListQueryOptions({ kind: "export" }, client).queryKey).toEqual([
      "component-capabilities",
      "list",
      "export",
    ]);
  });

  it("validates canonical capability responses before returning them to feature code", async () => {
    const fetch = vi.fn(async () => jsonResponse(catalog));
    const client = createComponentCapabilityApiClient(fetch as typeof globalThis.fetch);

    await expect(client.list({ kind: "source" })).resolves.toEqual(catalog);
    expect(fetch).toHaveBeenCalledWith("/api/components?kind=source", {
      credentials: "same-origin",
      method: "GET",
    });
  });

  it("rejects malformed responses and invalid filters without exposing diagnostics", async () => {
    const malformed = createComponentCapabilityApiClient(
      (async () => jsonResponse({ components: [{ kind: "unsupported" }] })) as typeof globalThis.fetch,
    );
    const fetch = vi.fn();
    const invalid = createComponentCapabilityApiClient(fetch as typeof globalThis.fetch);

    await expect(malformed.list()).rejects.toEqual(new ComponentCapabilityApiError("invalid_response", 200));
    await expect(invalid.list({ kind: "connector" } as never)).rejects.toEqual(
      new ComponentCapabilityApiError("invalid_component_capability_request", undefined),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps authentication and network errors to stable UI-safe states", async () => {
    const unauthenticated = createComponentCapabilityApiClient(
      (async () => new Response(null, { status: 401 })) as typeof globalThis.fetch,
    );
    const unavailable = createComponentCapabilityApiClient(
      (async () => { throw new Error("network unavailable"); }) as typeof globalThis.fetch,
    );

    await expect(unauthenticated.list()).rejects.toEqual(new ComponentCapabilityApiError("unauthenticated", 401));
    await expect(unavailable.list()).rejects.toEqual(new ComponentCapabilityApiError("network_error", undefined));
  });
});

/** Creates an in-memory client for query option tests without a browser request. */
function createClient() {
  return {
    list: async () => catalog,
  };
}

/** Builds a JSON response with the status codes used by the control-plane boundary. */
function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
