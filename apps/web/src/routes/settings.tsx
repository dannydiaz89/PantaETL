import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { t } from "../locales/index.js";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  return <TopLevelPage description={t("page.settings.description")} eyebrow={t("app.name")} title={t("page.settings.title")} />;
}
