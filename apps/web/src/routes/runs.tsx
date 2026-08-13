import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/app-shell.js";
import { RunWorkspace } from "../components/run-workspace.js";

export const Route = createFileRoute("/runs")({ component: Runs, ssr: false });

function Runs() {
  return <AppShell><RunWorkspace /></AppShell>;
}
