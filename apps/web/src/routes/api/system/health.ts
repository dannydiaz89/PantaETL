import { createFileRoute } from "@tanstack/react-router";

import { auth } from "../../../auth/server.js";
import { loadSystemHealth } from "../../../system/server.js";

/** Provides authenticated, safe application status for the system control-plane view. */
export const Route = createFileRoute("/api/system/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session === null) {
          return new Response(null, { status: 401 });
        }

        return Response.json(await loadSystemHealth(), {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
