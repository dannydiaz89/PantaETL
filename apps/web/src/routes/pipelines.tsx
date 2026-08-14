import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "../auth/route-guard.js";
import { AppShell } from "../components/app-shell.js";
import { PipelineWorkspace } from "../components/pipeline-workspace.js";

export const Route = createFileRoute("/pipelines")({
  beforeLoad: requireSession,
  component: Pipelines,
  ssr: false,
});

function Pipelines() {
  return <AppShell><PipelineWorkspace /></AppShell>;
}
