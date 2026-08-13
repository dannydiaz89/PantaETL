import { createFileRoute } from "@tanstack/react-router";

import { disablePipelineForOwner, enablePipelineForOwner, getPipeline } from "@pantaetl/database";

import { auth, controlPlaneDatabase } from "../../../../auth/server.js";
import { createPipelineActionRouteHandlers } from "../../../../pipeline-api/actions.js";

const handlers = createPipelineActionRouteHandlers({
  database: controlPlaneDatabase,
  disablePipelineForOwner,
  duplicatePipeline: async () => { throw new Error("Duplicate action is not available from this route."); },
  enablePipelineForOwner,
  enqueuePipelineRun: async () => { throw new Error("Run action is not available from this route."); },
  getPipeline,
  getSession: (headers) => auth.api.getSession({ headers }),
});

/** Enables one authenticated owner's idle pipeline after its state transition is validated. */
export const Route = createFileRoute("/api/pipelines/$pipelineId/enable")({
  server: { handlers: { POST: handlers.ENABLE } },
});
