"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  resolveTokens,
  type ThemeMode,
  type ColorPalette,
  type ThemeTokens,
} from "./themeTokens";

interface ThemeContextValue {
  mode: ThemeMode;
  palette: ColorPalette;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  palette: "ocean-blue",
  setMode: () => {},
  setPalette: () => {},
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
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  initialPalette?: ColorPalette;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? "light");
  const [palette, setPaletteState] = useState<ColorPalette>(
    initialPalette ?? "ocean-blue",
  );

  useEffect(() => {
    const tokens = resolveTokens(mode, palette);
    applyTokens(tokens, mode === "dark");
  }, [mode, palette]);

  const persistPreferences = useCallback(
    (newMode: ThemeMode, newPalette: ColorPalette) => {
      void fetch("/api/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeMode: newMode,
          colorPalette: newPalette,
        }),
      });
    },
    [],
  );

  const setMode = useCallback(
    (newMode: ThemeMode) => {
      setModeState(newMode);
      persistPreferences(newMode, palette);
    },
    [palette, persistPreferences],
  );

  const setPalette = useCallback(
    (newPalette: ColorPalette) => {
      setPaletteState(newPalette);
      persistPreferences(mode, newPalette);
    },
    [mode, persistPreferences],
  );

  return (
    <ThemeContext.Provider value={{ mode, palette, setMode, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}
