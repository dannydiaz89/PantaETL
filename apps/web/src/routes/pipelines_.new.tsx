import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/app-shell.js";
import { PipelineBuilderWizard } from "../components/pipeline/pipeline-builder-wizard.js";

export const Route = createFileRoute("/pipelines_/new")({
  component: NewPipeline,
  ssr: false,
});

function NewPipeline() {
  return <AppShell><PipelineBuilderWizard /></AppShell>;
}
