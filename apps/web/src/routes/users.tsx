import { createFileRoute } from "@tanstack/react-router";

import { TopLevelPage } from "../components/top-level-page.js";
import { useI18n } from "../locale-provider.js";

export const Route = createFileRoute("/users")({ component: Users });

function Users() {
  const { t } = useI18n();
  return <TopLevelPage description={t("page.users.description")} eyebrow={t("app.name")} title={t("page.users.title")} />;
}
