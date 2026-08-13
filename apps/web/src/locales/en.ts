/** English copy for the initial control-plane experience. */
export const en = {
  "app.name": "PantaETL",
  "overview.description": "A self-hosted workspace for reliable data pipelines.",
  "overview.title": "Overview",
  "theme.dark": "Use dark theme",
  "theme.light": "Use light theme",
} as const;

/** Translation keys currently supported by the English namespace. */
export type TranslationKey = keyof typeof en;
