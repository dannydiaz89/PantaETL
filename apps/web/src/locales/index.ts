import { en, type TranslationKey } from "./en.js";

/** The application locale available in the first release. */
export const DEFAULT_LOCALE = "en-US";

/** Returns translated text from the current English namespace. */
export function t(key: TranslationKey): string {
  return en[key];
}

/** Formats dates through the active locale rather than page-local string assembly. */
export function formatDate(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(new Date(value));
}

/** Formats quantities with locale-appropriate grouping and units. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value);
}

/** Formats a relative duration using the active locale. */
export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: "auto" }).format(value, unit);
}
