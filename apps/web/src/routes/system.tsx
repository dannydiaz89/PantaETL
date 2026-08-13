import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { t } from "../locales/index.js";

export const Route = createFileRoute("/system")({ component: System });

function System() {
  return <TopLevelPage description={t("page.system.description")} eyebrow={t("app.name")} title={t("page.system.title")} />;
}
