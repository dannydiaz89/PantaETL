import { createFileRoute } from "@tanstack/react-router";

import { api } from "@pantaetl/contracts";

/** Serves the generated control-plane OpenAPI document. */
export const Route = createFileRoute("/api/openapi.json")({
  server: {
    handlers: {
      GET: () => new Response(JSON.stringify(api.createOpenApiDocument()), {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
        },
      }),
    },
  },
});
