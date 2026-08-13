import { createFileRoute } from "@tanstack/react-router";

import { t } from "../locales/index.js";

/** Guest route reserved for the local password sign-in form. */
export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return <main><h1>{t("app.name")}</h1></main>;
}
