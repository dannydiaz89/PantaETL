import { createFileRoute } from "@tanstack/react-router";

import { deletePipeline, getPipeline, updatePipeline } from "@pantaetl/database";

import { controlPlaneDatabase, auth } from "../../../auth/server.js";
import { createPipelineDetailRouteHandlers } from "../../../pipeline-api/detail.js";

const handlers = createPipelineDetailRouteHandlers({
  database: controlPlaneDatabase,
  deletePipeline,
  getSession: (headers) => auth.api.getSession({ headers }),
  getPipeline,
  updatePipeline,
});

/** Provides authenticated owner-scoped access to one pipeline definition. */
export const Route = createFileRoute("/api/pipelines/$pipelineId")({
  server: { handlers },
});
