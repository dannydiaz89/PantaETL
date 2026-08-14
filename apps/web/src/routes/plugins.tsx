import { createFileRoute } from "@tanstack/react-router";

import { requireSession } from "../auth/route-guard.js";
import { TopLevelPage } from "../components/top-level-page.js";
import { useI18n } from "../locale-provider.js";

export const Route = createFileRoute("/plugins")({ beforeLoad: requireSession, component: Plugins });

function Plugins() {
  const { t } = useI18n();
  return <TopLevelPage description={t("page.plugins.description")} eyebrow={t("app.name")} title={t("page.plugins.title")} />;
}
