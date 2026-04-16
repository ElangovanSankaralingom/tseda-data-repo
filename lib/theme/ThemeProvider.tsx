"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  resolveTokens,
  type ThemeMode,
  type ColorPalette,
  type ThemeTokens,
} from "./themeTokens";
import type { Language } from "@/lib/i18n";

interface ThemeContextValue {
  mode: ThemeMode;
  palette: ColorPalette;
  language: Language;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
  setLanguage: (language: Language) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  palette: "midnight-lime",
  language: "en",
  setMode: () => {},
  setPalette: () => {},
  setLanguage: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function applyTokens(tokens: ThemeTokens, isDark: boolean) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
  root.classList.toggle("dark", isDark);
}

export default function ThemeProvider({
  children,
  initialMode,
  initialPalette,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  initialPalette?: ColorPalette;
  initialLanguage?: Language;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? "dark");
  const [palette, setPaletteState] = useState<ColorPalette>(
    initialPalette ?? "midnight-lime",
  );
  const [language, setLanguageState] = useState<Language>(
    initialLanguage ?? "en",
  );

  useEffect(() => {
    const tokens = resolveTokens(mode, palette);
    applyTokens(tokens, mode === "dark");
  }, [mode, palette]);

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
      setModeState(newMode);
      persistPreferences({ themeMode: newMode });
    },
    [persistPreferences],
  );

  const setPalette = useCallback(
    (newPalette: ColorPalette) => {
      setPaletteState(newPalette);
      persistPreferences({ colorPalette: newPalette });
    },
    [persistPreferences],
  );

  const setLanguage = useCallback(
    (newLanguage: Language) => {
      setLanguageState(newLanguage);
      persistPreferences({ language: newLanguage });
    },
    [persistPreferences],
  );

  return (
    <ThemeContext.Provider
      value={{ mode, palette, language, setMode, setPalette, setLanguage }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
