"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  resolveTokens,
  type ThemeMode,
  type ColorPalette,
  type ThemeTokens,
} from "./themeTokens";
import { normaliseAccent, DEFAULT_ACCENT_HEX } from "./accent";
import type { Language } from "@/lib/i18n";

interface ThemeContextValue {
  mode: ThemeMode;
  /** Current accent as a clamped hex (e.g. "#2A48CE"). */
  accent: string;
  language: Language;
  /** Beta member? Gates beta-only features (dark mode, Tamil) in the UI. */
  betaTester: boolean;
  setMode: (mode: ThemeMode) => void;
  /** Apply an accent live WITHOUT persisting — for slider drags. */
  previewAccent: (accent: string) => void;
  /** Set the accent from any value (hex / "h,s,l"); it is clamped + persisted. */
  setAccent: (accent: string) => void;
  setLanguage: (language: Language) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  accent: DEFAULT_ACCENT_HEX,
  language: "en",
  betaTester: false,
  setMode: () => {},
  previewAccent: () => {},
  setAccent: () => {},
  setLanguage: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function applyTokens(tokens: ThemeTokens, isDark: boolean) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
  root.classList.toggle("dark", isDark);
  /* Native form controls, scrollbars, etc. follow the active mode. */
  root.style.colorScheme = isDark ? "dark" : "light";
}

export default function ThemeProvider({
  children,
  initialMode,
  initialAccent,
  initialPalette,
  initialLanguage,
  betaTester = false,
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  initialAccent?: string;
  /** Legacy preset name — used only to migrate users with no saved accent yet. */
  initialPalette?: ColorPalette;
  initialLanguage?: Language;
  /** When false, beta-only options (dark mode, Tamil) are clamped to light/en. */
  betaTester?: boolean;
}) {
  const [mode, setModeState] = useState<ThemeMode>(betaTester ? (initialMode ?? "dark") : "light");
  const [accent, setAccentState] = useState<string>(() =>
    normaliseAccent(initialAccent ?? initialPalette),
  );
  const [language, setLanguageState] = useState<Language>(
    betaTester ? (initialLanguage ?? "en") : "en",
  );

  useEffect(() => {
    const tokens = resolveTokens(mode, accent);
    applyTokens(tokens, mode === "dark");
    /* Mirror theme to cookies so PUBLIC pages (signin, maintenance) can
       first-paint in the user's last-known theme via the root layout. */
    const year = 60 * 60 * 24 * 365;
    document.cookie = `tseda-mode=${mode}; path=/; max-age=${year}; samesite=lax`;
    document.cookie = `tseda-accent=${encodeURIComponent(accent)}; path=/; max-age=${year}; samesite=lax`;
  }, [mode, accent]);

  const persistPreferences = useCallback(
    (update: Record<string, string>) => {
      void fetch("/api/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
    },
    [],
  );

  const setMode = useCallback(
    (newMode: ThemeMode) => {
      const m: ThemeMode = !betaTester && newMode === "dark" ? "light" : newMode;
      setModeState(m);
      persistPreferences({ themeMode: m });
    },
    [persistPreferences, betaTester],
  );

  const previewAccent = useCallback((value: string) => {
    setAccentState(normaliseAccent(value));
  }, []);

  const setAccent = useCallback(
    (value: string) => {
      const hex = normaliseAccent(value);
      setAccentState(hex);
      persistPreferences({ accentHex: hex });
    },
    [persistPreferences],
  );

  const setLanguage = useCallback(
    (newLanguage: Language) => {
      const l: Language = !betaTester && newLanguage === "ta" ? "en" : newLanguage;
      setLanguageState(l);
      persistPreferences({ language: l });
    },
    [persistPreferences, betaTester],
  );

  return (
    <ThemeContext.Provider
      value={{ mode, accent, language, betaTester, setMode, previewAccent, setAccent, setLanguage }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
