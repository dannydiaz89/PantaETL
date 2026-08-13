import { createFileRoute } from "@tanstack/react-router";

import { createPipeline, listPipelinesByOwner } from "@pantaetl/database";

import { auth, controlPlaneDatabase } from "../../auth/server.js";
import { createPipelineCollectionRouteHandlers } from "../../pipelines/collection-route.js";

/** Lists and creates pipeline graphs for the authenticated control-plane user. */
export const Route = createFileRoute("/api/pipelines")({
  server: {
    handlers: createPipelineCollectionRouteHandlers({
      createPipeline,
      database: controlPlaneDatabase,
      getSession: (request) => auth.api.getSession({ headers: request.headers }),
      listPipelinesByOwner,
    }),
  },
});
