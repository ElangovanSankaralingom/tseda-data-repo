"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { ColorPalette } from "@/lib/theme/themeTokens";
import type { Language } from "@/lib/i18n";

const PALETTE_OPTIONS: readonly {
  id: ColorPalette;
  color: string;
  labelKey: string;
}[] = [
  { id: "midnight-lime", color: "#84CC16", labelKey: "appearance.paletteMidnightLime" as const },
  { id: "deep-ocean", color: "#06B6D4", labelKey: "appearance.paletteDeepOcean" as const },
  { id: "carbon-violet", color: "#8B5CF6", labelKey: "appearance.paletteCarbonViolet" as const },
  { id: "obsidian-amber", color: "#F59E0B", labelKey: "appearance.paletteObsidianAmber" as const },
];

function ThemePreview() {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--color-glass-border)]">
      <div
        className="h-10 flex items-center px-4 border-b border-[var(--color-glass-border)]"
        style={{ backgroundColor: `color-mix(in srgb, var(--color-header-tint) 40%, var(--color-glass-bg) 60%)` }}
      >
        <div className="flex gap-1.5">
          <div className="size-2 rounded-full bg-[var(--color-text-muted)]/30" />
          <div className="size-2 rounded-full bg-[var(--color-text-muted)]/30" />
          <div className="size-2 rounded-full bg-[var(--color-text-muted)]/30" />
        </div>
        <span className="text-xs text-[var(--color-text-primary)] ml-3 font-medium opacity-70">T&apos;SEDA</span>
      </div>
      <div className="p-4 flex gap-2.5 bg-[var(--color-body-bg)]">
        <div className="flex-1 rounded-lg p-3 border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)]">
          <div className="w-3/5 h-2 rounded bg-[var(--color-text-primary)] opacity-15 mb-2" />
          <div className="w-2/5 h-1.5 rounded bg-[var(--color-text-primary)] opacity-[0.08]" />
        </div>
        <div className="flex-1 rounded-lg p-3 border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)]">
          <div className="w-1/2 h-2 rounded bg-[var(--color-text-primary)] opacity-15 mb-2" />
          <div className="w-3/4 h-1.5 rounded bg-[var(--color-text-primary)] opacity-[0.08]" />
        </div>
      </div>
    </div>
  );
}

export default function AppearanceSettings() {
  const { mode, palette, language, setMode, setPalette, setLanguage } = useTheme();
  const { t } = useTranslation();

  const isDark = mode === "dark";

  function handlePalette(id: ColorPalette) {
    setPalette(id);
    if (mode === "light") {
      setMode("color");
    }
  }

  function handleTheme(target: "light" | "dark") {
    if (target === "light") {
      setMode(palette === "midnight-lime" ? "light" : "color");
    } else {
      setMode("dark");
    }
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t("nav.appearance")}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
          {t("appearance.title")}
        </h1>
      </div>

      {/* Theme */}
      <section>
        <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
          {t("appearance.theme")}
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => handleTheme("light")}
            className={`flex flex-1 items-center gap-2.5 rounded-xl p-3.5 transition-all duration-200 cursor-pointer ${
              !isDark
                ? "border-2 border-[var(--color-primary)] bg-[var(--color-primary-muted)]"
                : "border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] hover:border-[var(--color-text-muted)]"
            }`}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-hover)]">
              <Sun className="size-4 text-[var(--color-text-muted)]" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("appearance.light")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleTheme("dark")}
            className={`flex flex-1 items-center gap-2.5 rounded-xl p-3.5 transition-all duration-200 cursor-pointer ${
              isDark
                ? "border-2 border-[var(--color-primary)] bg-[var(--color-primary-muted)]"
                : "border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] hover:border-[var(--color-text-muted)]"
            }`}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-hover)]">
              <Moon className="size-4 text-[var(--color-text-muted)]" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("appearance.dark")}
            </span>
          </button>
        </div>
      </section>

      {/* Accent color */}
      <section>
        <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
          {t("appearance.colorPalette")}
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("appearance.subtitle")}
        </p>
        <div className="flex flex-wrap gap-2">
          {PALETTE_OPTIONS.map((p) => {
            const selected = palette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePalette(p.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-200 cursor-pointer ${
                  selected
                    ? "border-2 bg-[var(--color-primary-muted)]"
                    : "border border-[var(--color-glass-border)] hover:border-[var(--color-text-muted)]"
                }`}
                style={selected ? { borderColor: p.color } : undefined}
              >
                <span
                  className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t(p.labelKey as "appearance.paletteMidnightLime")}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live preview */}
      <section>
        <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
          Preview
        </div>
        <ThemePreview />
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-glass-border)] to-transparent" />

      {/* Language */}
      <section>
        <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
          {t("appearance.language")}
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("appearance.subtitle")}
        </p>
        <div className="flex gap-2.5">
          {([
            { key: "en" as Language, char: "EN", nameKey: "appearance.english" as const, subKey: "appearance.default" as const },
            { key: "ta" as Language, char: "\u0BA4", nameKey: "appearance.tamil" as const, subKey: null },
          ]).map(({ key, char, nameKey, subKey }) => {
            const selected = language === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setLanguage(key)}
                className={`flex flex-1 items-center gap-3 rounded-xl p-3.5 transition-all duration-200 cursor-pointer ${
                  selected
                    ? "border-2 border-[var(--color-primary)] bg-[var(--color-primary-muted)]"
                    : "border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] hover:border-[var(--color-text-muted)]"
                }`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center text-lg font-medium text-[var(--color-text-primary)]">
                  {char}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{t(nameKey)}</div>
                  {subKey && <div className="text-xs text-[var(--color-text-secondary)]">{t(subKey)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
