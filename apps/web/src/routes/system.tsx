import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/app-shell.js";
import { SystemWorkspace } from "../components/system-workspace.js";
import { useI18n } from "../locale-provider.js";

export const Route = createFileRoute("/system")({ component: System });

function System() {
  const { t } = useI18n();
  return <AppShell><main className="app-page"><p className="app-page__eyebrow">{t("app.name")}</p><h1>{t("page.system.title")}</h1><p>{t("page.system.description")}</p><SystemWorkspace /></main></AppShell>;
}
