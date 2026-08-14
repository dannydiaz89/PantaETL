import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button, Field, Input } from "@pantaetl/ui";

import { authClient } from "../auth/client.js";
import { useI18n } from "../locale-provider.js";

/** Guest route reserved for the local password sign-in form. */
export const Route = createFileRoute("/login")({
  component: Login,
  validateSearch: (search: Record<string, unknown>): { readonly returnTo?: string } => (
    typeof search.returnTo === "string" && search.returnTo.startsWith("/") && !search.returnTo.startsWith("//")
      ? { returnTo: search.returnTo }
      : {}
  ),
});

function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function signIn(formData: FormData) {
    setIsSubmitting(true);
    setHasError(false);
    const result = await authClient.signIn.email({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    setIsSubmitting(false);
    if (result.error !== null) {
      setHasError(true);
      return;
    }

    await navigate({ href: returnTo ?? "/", replace: true });
  }

  return (
    <main className="login-page">
      <form action={signIn} className="login-form">
        <p className="app-page__eyebrow">{t("app.name")}</p>
        <h1>{t("login.title")}</h1>
        <p>{t("login.description")}</p>
        <Field description={t("login.emailDescription")} label={t("login.email")} required>
          {({ describedBy, id, invalid }) => <Input aria-describedby={describedBy} aria-invalid={invalid} autoComplete="email" id={id} name="email" required type="email" />}
        </Field>
        <Field error={hasError ? t("login.error") : undefined} label={t("login.password")} required>
          {({ describedBy, id, invalid }) => <Input aria-describedby={describedBy} aria-invalid={invalid} autoComplete="current-password" id={id} name="password" required type="password" />}
        </Field>
        <Button disabled={isSubmitting} type="submit">{isSubmitting ? t("login.submitting") : t("login.submit")}</Button>
      </form>
    </main>
  );
}
