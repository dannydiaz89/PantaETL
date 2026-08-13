import { createFileRoute } from "@tanstack/react-router";

import { auth } from "../../auth/server.js";
import { createComponentCapabilityRouteHandlers } from "../../capabilities/collection-route.js";

/** Lists the authenticated control-plane user's available built-in components. */
export const Route = createFileRoute("/api/components")({
  server: {
    handlers: createComponentCapabilityRouteHandlers({
      getSession: (request) => auth.api.getSession({ headers: request.headers }),
    }),
  },
});
