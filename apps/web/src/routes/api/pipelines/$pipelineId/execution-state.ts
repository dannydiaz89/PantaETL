import { createFileRoute } from "@tanstack/react-router";

import { getActiveRunForPipeline, getPipeline } from "@pantaetl/database";

import { controlPlaneDatabase } from "../../../../auth/server.js";
import { getApiSession } from "../../../../auth/api-session.js";
import { createPipelineActionRouteHandlers } from "../../../../pipeline-api/actions.js";

const handlers = createPipelineActionRouteHandlers({
  availableComponents: [],
  database: controlPlaneDatabase,
  disablePipelineForOwner: async () => { throw new Error("Disable action is not available from this route."); },
  duplicatePipeline: async () => { throw new Error("Duplicate action is not available from this route."); },
  enablePipelineForOwner: async () => { throw new Error("Enable action is not available from this route."); },
  enqueuePipelineRun: async () => { throw new Error("Run action is not available from this route."); },
  getActiveRunForPipeline,
  getPipeline,
  getSession: (headers) => getApiSession(headers),
});

/** Reports whether one authenticated owner's pipeline currently has a queued or running run. */
export const Route = createFileRoute("/api/pipelines/$pipelineId/execution-state")({
  server: { handlers: { GET: handlers.EXECUTION_STATE } },
});
