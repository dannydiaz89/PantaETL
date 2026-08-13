import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { t } from "../locales/index.js";

export const Route = createFileRoute("/pipelines")({ component: Pipelines });

function Pipelines() {
  return <TopLevelPage description={t("page.pipelines.description")} eyebrow={t("app.name")} title={t("page.pipelines.title")} />;
}
