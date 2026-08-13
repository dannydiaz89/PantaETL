import { createFileRoute } from "@tanstack/react-router";

import { createApiToken, listApiTokens, parseApiTokenName } from "../../auth/api-token.js";
import { auth, controlPlaneDatabase } from "../../auth/server.js";

/** Lists and creates credentials for the currently signed-in control-plane user. */
export const Route = createFileRoute("/api/tokens")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session === null) {
          return new Response(null, { status: 401 });
        }

        return Response.json({ tokens: await listApiTokens(controlPlaneDatabase, session.user.id) });
      },
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session === null) {
          return new Response(null, { status: 401 });
        }

        const body = await readJsonObject(request);
        let name: string;
        try {
          name = parseApiTokenName(body?.name);
        } catch {
          return Response.json({ code: "invalid_api_token_name" }, { status: 400 });
        }

        const created = await createApiToken(controlPlaneDatabase, { name, ownerUserId: session.user.id });
        return Response.json({ token: created }, { status: 201 });
      },
    },
  },
});

/** Reads a JSON object while treating malformed and non-object payloads as invalid input. */
async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }

    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
