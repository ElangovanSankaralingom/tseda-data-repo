"use client";

import { useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import type { ThemeMode, ColorPalette } from "@/lib/theme/themeTokens";

const THEME_MODES: { key: ThemeMode; label: string; Icon: typeof Sun; preview: { header: string; card: string; text: string } }[] = [
  {
    key: "light",
    label: "Light",
    Icon: Sun,
    preview: { header: "#1E3A5F", card: "#FFFFFF", text: "#E2E8F0" },
  },
  {
    key: "dark",
    label: "Dark",
    Icon: Moon,
    preview: { header: "#111827", card: "#1F2937", text: "#374151" },
  },
  {
    key: "color",
    label: "Color",
    Icon: Palette,
    preview: { header: "#4A1D6A", card: "#FFFFFF", text: "#E2E8F0" },
  },
];

const PALETTES: { key: ColorPalette; label: string; swatch: string }[] = [
  { key: "ocean-blue", label: "Ocean Blue", swatch: "#1E3A5F" },
  { key: "forest-green", label: "Forest Green", swatch: "#1B4332" },
  { key: "royal-purple", label: "Royal Purple", swatch: "#4A1D6A" },
  { key: "sunset-warm", label: "Sunset Warm", swatch: "#8B3A14" },
  { key: "rose-pink", label: "Rose Pink", swatch: "#9B1B5E" },
];

type Language = "en" | "ta";

export default function AppearanceSettings({
  initialLanguage,
}: {
  initialLanguage: Language;
}) {
  const { mode, palette, setMode, setPalette } = useTheme();
  const [language, setLanguage] = useState<Language>(initialLanguage);

  function handleLanguageChange(lang: Language) {
    setLanguage(lang);
    void fetch("/api/me/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
  }

  return (
    <div className="space-y-8">
      {/* Theme Mode */}
      <section>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Theme</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Choose how TSEDA appears on your device</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {THEME_MODES.map(({ key, label, Icon, preview }) => {
            const selected = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`relative flex w-full flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02] sm:w-40 h-32 ${
                  selected
                    ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]"
                    : "border-[var(--color-card-border)] hover:border-[var(--color-text-muted)]"
                } ${key === "dark" ? "bg-gray-900" : "bg-[var(--color-card-bg)]"}`}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                    <Check className="size-3" />
                  </span>
                )}
                <Icon className={`size-6 ${key === "dark" ? "text-slate-300" : "text-[var(--color-text-secondary)]"}`} />
                <span className={`text-sm font-medium ${key === "dark" ? "text-slate-200" : "text-[var(--color-text-primary)]"}`}>{label}</span>
                {/* Mini preview strip */}
                <div className="flex w-full gap-1 rounded-md overflow-hidden h-3">
                  <div className="flex-1 rounded-sm" style={{ backgroundColor: preview.header }} />
                  <div className="flex-[2] rounded-sm" style={{ backgroundColor: preview.card }} />
                  <div className="flex-[3] space-y-0.5 rounded-sm px-0.5 py-0.5" style={{ backgroundColor: preview.card }}>
                    <div className="h-0.5 w-full rounded-full" style={{ backgroundColor: preview.text }} />
                    <div className="h-0.5 w-3/4 rounded-full" style={{ backgroundColor: preview.text }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Color Palette */}
      <section
        className={`overflow-hidden transition-all duration-300 ${
          mode === "color" ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Color Palette</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Pick an accent color for the interface</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {PALETTES.map(({ key, label, swatch }) => {
            const selected = palette === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPalette(key)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 hover:scale-[1.02] ${
                  selected
                    ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)] bg-[var(--color-primary-muted)]"
                    : "border-[var(--color-card-border)] bg-[var(--color-card-bg)] hover:border-[var(--color-text-muted)]"
                }`}
              >
                <span
                  className="size-6 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: swatch }}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
                {selected && <Check className="size-4 text-[var(--color-primary)]" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Language */}
      <section>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Language</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Select your preferred language</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {([
            { key: "en" as Language, symbol: "EN", label: "English" },
            { key: "ta" as Language, symbol: "\u0BA4", label: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" },
          ]).map(({ key, symbol, label }) => {
            const selected = language === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleLanguageChange(key)}
                className={`relative flex w-28 flex-col items-center gap-1.5 rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02] ${
                  selected
                    ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]"
                    : "border-[var(--color-card-border)] hover:border-[var(--color-text-muted)]"
                } bg-[var(--color-card-bg)]`}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                    <Check className="size-3" />
                  </span>
                )}
                <span className="text-xl font-bold text-[var(--color-text-primary)]">{symbol}</span>
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
              </button>
            );
          })}
        </div>
        {language === "ta" && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Tamil translation coming soon</p>
        )}
      </section>
    </div>
  );
}
