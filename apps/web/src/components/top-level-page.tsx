import { AppShell } from "./app-shell.js";

/** Renders the shared shell around a concise top-level product destination. */
export function TopLevelPage({ description, eyebrow, title }: { readonly description: string; readonly eyebrow: string; readonly title: string }) {
  return (
    <AppShell>
      <section className="app-page">
        <p className="app-page__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </AppShell>
  );
}
