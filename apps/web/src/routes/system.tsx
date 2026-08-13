import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { useI18n } from "../locale-provider.js";

export const Route = createFileRoute("/system")({ component: System });

function System() {
  const { t } = useI18n();
  return <TopLevelPage description={t("page.system.description")} eyebrow={t("app.name")} title={t("page.system.title")} />;
}
