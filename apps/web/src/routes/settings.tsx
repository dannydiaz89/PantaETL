import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { useI18n } from "../locale-provider.js";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const { t } = useI18n();
  return <TopLevelPage description={t("page.settings.description")} eyebrow={t("app.name")} title={t("page.settings.title")} />;
}
