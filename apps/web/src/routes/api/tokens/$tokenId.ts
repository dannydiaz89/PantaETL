import { createFileRoute } from "@tanstack/react-router";

import { revokeApiToken } from "../../../auth/api-token.js";
import { auth, controlPlaneDatabase } from "../../../auth/server.js";

/** Revokes one credential owned by the currently signed-in control-plane user. */
export const Route = createFileRoute("/api/tokens/$tokenId")({
  server: {
    handlers: {
      DELETE: async ({ params, request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session === null) {
          return new Response(null, { status: 401 });
        }

        await revokeApiToken(controlPlaneDatabase, { ownerUserId: session.user.id, tokenId: params.tokenId });
        return new Response(null, { status: 204 });
      },
    },
  },
});
