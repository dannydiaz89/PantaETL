import { createFileRoute } from "@tanstack/react-router";

import { createPipeline, listPipelinesByOwner } from "@pantaetl/database";

import { controlPlaneDatabase } from "../../auth/server.js";
import { getApiSession } from "../../auth/api-session.js";
import { createPipelineCollectionRouteHandlers } from "../../pipelines/collection-route.js";

/** Lists and creates pipeline graphs for the authenticated control-plane user. */
export const Route = createFileRoute("/api/pipelines")({
  server: {
    handlers: createPipelineCollectionRouteHandlers({
      createPipeline,
      database: controlPlaneDatabase,
      getSession: (request) => getApiSession(request.headers),
      listPipelinesByOwner,
    }),
  },
});
