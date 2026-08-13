import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { t } from "../locales/index.js";

export const Route = createFileRoute("/users")({ component: Users });

function Users() {
  return <TopLevelPage description={t("page.users.description")} eyebrow={t("app.name")} title={t("page.users.title")} />;
}
