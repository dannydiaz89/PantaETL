import { createFileRoute } from "@tanstack/react-router";

import { builtInComponentCapabilities } from "@pantaetl/contracts";
import { disablePipelineForOwner, enablePipelineForOwner, getActiveRunForPipeline, getPipeline } from "@pantaetl/database";

import { controlPlaneDatabase } from "../../../../auth/server.js";
import { getApiSession } from "../../../../auth/api-session.js";
import { createPipelineActionRouteHandlers } from "../../../../pipeline-api/actions.js";

const handlers = createPipelineActionRouteHandlers({
  availableComponents: builtInComponentCapabilities,
  database: controlPlaneDatabase,
  disablePipelineForOwner,
  duplicatePipeline: async () => { throw new Error("Duplicate action is not available from this route."); },
  enablePipelineForOwner,
  enqueuePipelineRun: async () => { throw new Error("Run action is not available from this route."); },
  getActiveRunForPipeline,
  getPipeline,
  getSession: (headers) => getApiSession(headers),
});

/** Enables one authenticated owner's idle pipeline after its state transition is validated. */
export const Route = createFileRoute("/api/pipelines/$pipelineId/enable")({
  server: { handlers: { POST: handlers.ENABLE } },
});
