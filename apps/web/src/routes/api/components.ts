import { createFileRoute } from "@tanstack/react-router";

import { getApiSession } from "../../auth/api-session.js";

import { createComponentCapabilityRouteHandlers } from "../../capabilities/collection-route.js";

/** Lists the authenticated control-plane user's available built-in components. */
export const Route = createFileRoute("/api/components")({
  server: {
    handlers: createComponentCapabilityRouteHandlers({
      getSession: (request) => getApiSession(request.headers),
    }),
  },
});
