import { createFileRoute } from "@tanstack/react-router";

import { getActiveRunForPipeline, getPipeline } from "@pantaetl/database";

import { auth, controlPlaneDatabase } from "../../../../auth/server.js";
import { createPipelineActionRouteHandlers } from "../../../../pipeline-api/actions.js";
import { enqueuePipelineRun, loadPipelineSchedulerConfig } from "../../../../pipeline-api/scheduler.js";

const schedulerConfig = loadPipelineSchedulerConfig();
const handlers = createPipelineActionRouteHandlers({
  availableComponents: [],
  database: controlPlaneDatabase,
  disablePipelineForOwner: async () => { throw new Error("Disable action is not available from this route."); },
  duplicatePipeline: async () => { throw new Error("Duplicate action is not available from this route."); },
  enablePipelineForOwner: async () => { throw new Error("Enable action is not available from this route."); },
  enqueuePipelineRun: (input) => enqueuePipelineRun(schedulerConfig, input),
  getActiveRunForPipeline,
  getPipeline,
  getSession: (headers) => auth.api.getSession({ headers }),
});

/** Enqueues one authenticated owner's enabled pipeline through the scheduler service. */
export const Route = createFileRoute("/api/pipelines/$pipelineId/run")({
  server: { handlers: { POST: handlers.RUN } },
});
