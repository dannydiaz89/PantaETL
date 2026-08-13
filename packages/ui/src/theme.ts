/** Supported application color themes. */
export type Theme = "light" | "dark";

/** The HTML data attribute used by semantic token styles. */
export const THEME_ATTRIBUTE = "data-theme";

/** Returns a supported theme, using the restrained light theme for invalid input. */
export function resolveTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

/** Applies a semantic color theme to a document root without coupling consumers to token names. */
export function applyTheme(element: Pick<HTMLElement, "dataset">, theme: Theme): void {
  element.dataset.theme = theme;
}
