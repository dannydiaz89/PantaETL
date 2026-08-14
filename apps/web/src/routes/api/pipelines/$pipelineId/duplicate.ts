import { createFileRoute } from "@tanstack/react-router";

import { duplicatePipeline, getPipeline } from "@pantaetl/database";

import { auth, controlPlaneDatabase } from "../../../../auth/server.js";
import { createPipelineActionRouteHandlers } from "../../../../pipeline-api/actions.js";
import { enqueuePipelineRun, loadPipelineSchedulerConfig } from "../../../../pipeline-api/scheduler.js";

const schedulerConfig = loadPipelineSchedulerConfig();
const handlers = createPipelineActionRouteHandlers({
  availableComponents: [],
  database: controlPlaneDatabase,
  disablePipelineForOwner: async () => { throw new Error("Disable action is not available from this route."); },
  duplicatePipeline,
  enablePipelineForOwner: async () => { throw new Error("Enable action is not available from this route."); },
  enqueuePipelineRun: (input) => enqueuePipelineRun(schedulerConfig, input),
  getPipeline,
  getSession: (headers) => auth.api.getSession({ headers }),
});

/** Duplicates one authenticated owner's pipeline as a fresh draft definition. */
export const Route = createFileRoute("/api/pipelines/$pipelineId/duplicate")({
  server: { handlers: { POST: handlers.DUPLICATE } },
});
