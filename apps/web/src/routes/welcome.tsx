import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { Button, Field, Input } from "@pantaetl/ui";

import { MINIMUM_ADMIN_PASSWORD_LENGTH } from "../auth/admin-credentials.js";
import { completeAdminSetup, type AdminSetupOutcome } from "../auth/initial-setup.js";
import { requireInitialSetup } from "../auth/route-guard.js";
import { useI18n } from "../locale-provider.js";
import type { TranslationKey } from "../locales/en.js";

/** First-run screen that replaces the well-known installation credentials. */
export const Route = createFileRoute("/welcome")({
  beforeLoad: requireInitialSetup,
  component: Welcome,
});

const REJECTION_MESSAGE_KEYS: Readonly<Record<Exclude<AdminSetupOutcome & { ok: false }, never>["reason"], TranslationKey>> = {
  already_completed: "welcome.error.alreadyCompleted",
  email_in_use: "welcome.error.emailInUse",
  invalid_email: "welcome.error.invalidEmail",
  reused_default_password: "welcome.error.reusedDefault",
  unauthenticated: "welcome.error.alreadyCompleted",
  weak_password: "welcome.error.weakPassword",
};

function Welcome() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const router = useRouter();
  const { session } = Route.useRouteContext();
  // Held in state so a rejected attempt never makes the reader retype everything:
  // submitting through a form action otherwise resets the fields.
  const [email, setEmail] = useState(session.email);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | undefined>(undefined);

  async function submit(): Promise<void> {
    if (password !== confirmation) {
      setErrorKey("welcome.error.mismatch");
      return;
    }

    setErrorKey(undefined);
    setIsSubmitting(true);
    const outcome = await completeAdminSetup({ data: { email, password } });
    setIsSubmitting(false);

    if (!outcome.ok) {
      setErrorKey(REJECTION_MESSAGE_KEYS[outcome.reason]);
      return;
    }

    // The guards read the session on the server, so the stale one must be discarded
    // before navigating or this page would immediately claim the visitor again.
    await router.invalidate();
    await navigate({ replace: true, to: "/" });
  }

  return (
    <main className="login-page">
      <form action={submit} className="login-form">
        <p className="app-page__eyebrow">{t("app.name")}</p>
        <h1>{t("welcome.title")}</h1>
        <p>{t("welcome.description")}</p>
        <Field description={t("welcome.emailDescription")} label={t("welcome.email")} required>
          {({ describedBy, id, invalid }) => (
            <Input
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="email"
              id={id}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          )}
        </Field>
        <Field description={t("welcome.passwordDescription")} label={t("welcome.password")} required>
          {({ describedBy, id, invalid }) => (
            <Input
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="new-password"
              id={id}
              minLength={MINIMUM_ADMIN_PASSWORD_LENGTH}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          )}
        </Field>
        <Field error={errorKey === undefined ? undefined : t(errorKey)} label={t("welcome.confirmation")} required>
          {({ describedBy, id, invalid }) => (
            <Input
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="new-password"
              id={id}
              minLength={MINIMUM_ADMIN_PASSWORD_LENGTH}
              name="confirmation"
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          )}
        </Field>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? t("welcome.submitting") : t("welcome.submit")}
        </Button>
      </form>
    </main>
  );
}
