import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiToken } from "../../auth/api-token.js";
import { controlPlaneDatabase } from "../../auth/server.js";

/** Confirms the current Bearer credential and returns its owner's live identity. */
export const Route = createFileRoute("/api/authentication")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const identity = await authenticateApiToken(controlPlaneDatabase, request.headers.get("authorization"));
        if (identity === null) {
          return new Response(null, { headers: { "www-authenticate": "Bearer" }, status: 401 });
        }

        return Response.json({
          email: identity.email,
          id: identity.id,
          isAdmin: identity.isAdmin,
          username: identity.username,
        });
      },
    },
  },
});
