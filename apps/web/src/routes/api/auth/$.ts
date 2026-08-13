import { createFileRoute } from "@tanstack/react-router";

import { auth } from "../../../auth/server.js";

/** Mounts Better Auth's local password and session endpoints. */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
