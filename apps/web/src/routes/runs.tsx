import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { t } from "../locales/index.js";

export const Route = createFileRoute("/runs")({ component: Runs });

function Runs() {
  return <TopLevelPage description={t("page.runs.description")} eyebrow={t("app.name")} title={t("page.runs.title")} />;
}
