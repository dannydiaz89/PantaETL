import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "../auth/route-guard.js";
import { AppShell } from "../components/app-shell.js";
import { PipelineBuilderPage } from "../components/pipeline-builder-page.js";

export const Route = createFileRoute("/pipelines_/new")({
  beforeLoad: requireSession,
  component: NewPipeline,
  ssr: false,
});

function NewPipeline() {
  return <AppShell><PipelineBuilderPage /></AppShell>;
}
