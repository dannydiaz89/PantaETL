import { builtInComponentCapabilities } from "@pantaetl/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createComponentCapabilityRouteHandlers,
  type ComponentCapabilityRouteDependencies,
} from "../src/capabilities/collection-route.js";

describe("component capability API route", () => {
  it("requires a signed-in user before reading the static capability catalog", async () => {
    const dependencies = createDependencies(null);

    const response = await createComponentCapabilityRouteHandlers(dependencies).GET({
      request: new Request("https://pantaetl.test/api/components"),
    });

    expect(response.status).toBe(401);
    expect(dependencies.getSession).toHaveBeenCalledOnce();
  });

  it("returns the canonically validated generated catalog without request-time Python discovery", async () => {
    const response = await createComponentCapabilityRouteHandlers(createDependencies()).GET({
      request: new Request("https://pantaetl.test/api/components"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ components: builtInComponentCapabilities });
  });

  it("filters source, transform, and export components by the strict kind query", async () => {
    const handlers = createComponentCapabilityRouteHandlers(createDependencies());

    for (const kind of ["source", "transform", "export"] as const) {
      const response = await handlers.GET({
        request: new Request(`https://pantaetl.test/api/components?kind=${kind}`),
      });
      const body = await response.json() as { components: { kind: string }[] };

      expect(response.status).toBe(200);
      expect(body.components.length).toBeGreaterThan(0);
      expect(body.components.every((component) => component.kind === kind)).toBe(true);
    }
  });

  it("returns a safe bad request for unsupported, repeated, or unknown query fields", async () => {
    const handlers = createComponentCapabilityRouteHandlers(createDependencies());

    for (const query of ["?kind=connector", "?kind=source&kind=export", "?page=1"]) {
      const response = await handlers.GET({
        request: new Request(`https://pantaetl.test/api/components${query}`),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ code: "invalid_component_capability_request" });
    }
  });
});

/** Create an isolated authenticated dependency set without a live session service. */
function createDependencies(
  session: { readonly user: { readonly id: string } } | null = { user: { id: "user-1" } },
): ComponentCapabilityRouteDependencies & { readonly getSession: ReturnType<typeof vi.fn> } {
  return {
    getSession: vi.fn(async () => session),
  };
}
