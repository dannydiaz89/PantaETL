import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "../auth/route-guard.js";
import { AppShell } from "../components/app-shell.js";
import { SettingsWorkspace } from "../components/settings-workspace.js";
import { useI18n } from "../locale-provider.js";

export const Route = createFileRoute("/settings")({ beforeLoad: requireSession, component: Settings });

function Settings() {
  const { t } = useI18n();
  return <AppShell><main className="app-page"><p className="app-page__eyebrow">{t("app.name")}</p><h1>{t("page.settings.title")}</h1><p>{t("page.settings.description")}</p><SettingsWorkspace /></main></AppShell>;
}
