import { applyTheme, resolveTheme, type Theme } from "@pantaetl/ui";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** Browser storage key for a user-selected display theme. */
export const THEME_STORAGE_KEY = "pantaetl.theme";

/** Theme controls made available to application screens. */
export interface ThemeContextValue {
  readonly setTheme: (theme: Theme) => void;
  readonly theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Applies and persists a semantic theme after hydration. */
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    setThemeState(storedTheme);
  }, []);

  useEffect(() => {
    applyTheme(document.documentElement, theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({ setTheme: setThemeState, theme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Reads the current theme and its persistence-aware setter. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("Theme controls require ThemeProvider.");
  }
  return context;
}
