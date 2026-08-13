import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/app-shell.js";
import { PipelineWorkspace } from "../components/pipeline-workspace.js";

export const Route = createFileRoute("/pipelines")({
  component: Pipelines,
  ssr: false,
});

function Pipelines() {
  return <AppShell><PipelineWorkspace /></AppShell>;
}
