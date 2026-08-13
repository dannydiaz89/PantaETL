import { en, type TranslationKey } from "./en.js";

/** Shape required of every locale catalog. */
export type TranslationCatalog = Record<TranslationKey, string>;

/** Locale catalogs available to the control plane. Add future locales here. */
export const localeCatalogs = {
  "en-US": en,
  "en-GB": { ...en },
} as const satisfies Record<string, TranslationCatalog>;

/** Locale identifiers currently supported by the control plane. */
export type Locale = keyof typeof localeCatalogs;

/** Default locale used for server rendering and unsupported browser preferences. */
export const DEFAULT_LOCALE: Locale = "en-US";

/** Enumerates supported locales for user preferences and future locale controls. */
export const supportedLocales = Object.keys(localeCatalogs) as Locale[];

/** Plural message forms accepted by the locale-aware formatter. */
export interface PluralForms {
  readonly few?: string;
  readonly many?: string;
  readonly one?: string;
  readonly other: string;
  readonly two?: string;
  readonly zero?: string;
}

/** Translation and locale-formatting operations for one active locale. */
export interface I18n {
  readonly formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  readonly formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  readonly formatPlural: (value: number, forms: PluralForms) => string;
  readonly formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
  readonly locale: Locale;
  readonly t: (key: TranslationKey) => string;
}

/** Resolves exact and language-only browser preferences to a supported locale. */
export function resolveLocale(requestedLocale: string | null | undefined): Locale {
  if (requestedLocale !== null && requestedLocale !== undefined && requestedLocale in localeCatalogs) {
    return requestedLocale as Locale;
  }

  const language = requestedLocale?.split("-")[0]?.toLowerCase();
  return supportedLocales.find((locale) => locale.split("-")[0]?.toLowerCase() === language) ?? DEFAULT_LOCALE;
}

/** Creates stable translations and formatters for the supplied supported locale. */
export function createI18n(locale: Locale): I18n {
  const catalog = localeCatalogs[locale];

  return {
    formatDate: (value, options) => new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
    formatPlural: (value, forms) => {
      const category = new Intl.PluralRules(locale).select(value);
      return (forms[category] ?? forms.other).replaceAll("#", new Intl.NumberFormat(locale).format(value));
    },
    formatRelativeTime: (value, unit) => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit),
    locale,
    t: (key) => catalog[key],
  };
}

/** Default translations used by server-rendered metadata before browser hydration. */
export const defaultI18n = createI18n(DEFAULT_LOCALE);
