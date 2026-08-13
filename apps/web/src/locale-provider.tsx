import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { createI18n, DEFAULT_LOCALE, resolveLocale, type I18n, type Locale } from "./locales/index.js";

/** Browser storage key for a user-selected control-plane locale. */
export const LOCALE_STORAGE_KEY = "pantaetl.locale";

/** Locale operations exposed to every localized application screen. */
export interface LocaleContextValue extends I18n {
  readonly setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/** Provides a persisted locale and synchronizes the document language after hydration. */
export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const browserLocale = window.navigator.languages.find((candidate) => candidate.length > 0) ?? window.navigator.language;
    setLocaleState(resolveLocale(storedLocale ?? browserLocale));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => setLocaleState(nextLocale), []);
  const value = useMemo<LocaleContextValue>(() => ({ ...createI18n(locale), setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Reads active translations, plural formatting, and locale-aware formatters. */
export function useI18n(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("Localized screens require LocaleProvider.");
  }
  return context;
}
