"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { ColorPalette } from "@/lib/theme/themeTokens";
import type { Language } from "@/lib/i18n";

const PALETTE_OPTIONS: readonly {
  id: ColorPalette;
  color: string;
  short: string;
}[] = [
  { id: "ocean-blue", color: "#1E3A5F", short: "Ocean" },
  { id: "forest-green", color: "#1B4332", short: "Forest" },
  { id: "royal-purple", color: "#4A1D6A", short: "Royal" },
  { id: "sunset-warm", color: "#8B3A14", short: "Sunset" },
  { id: "rose-pink", color: "#9B1B5E", short: "Rose" },
];

function ThemePreview() {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--color-card-border)]">
      <div
        className="h-10 flex items-center px-4 border-b border-[var(--color-card-border)]/50"
        style={{ backgroundColor: `color-mix(in srgb, var(--color-header-tint) 40%, var(--color-card-bg) 60%)` }}
      >
        <div className="flex gap-1.5">
          <div className="size-2 rounded-full bg-[var(--color-text-muted)]/30" />
          <div className="size-2 rounded-full bg-[var(--color-text-muted)]/30" />
          <div className="size-2 rounded-full bg-[var(--color-text-muted)]/30" />
        </div>
        <span className="text-xs text-[var(--color-text-primary)] ml-3 font-medium opacity-70">T&apos;SEDA</span>
      </div>
      <div className="p-4 flex gap-2.5 bg-[var(--color-body-bg)]">
        <div className="flex-1 rounded-lg p-3 border border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
          <div className="w-3/5 h-2 rounded bg-[var(--color-text-primary)] opacity-15 mb-2" />
          <div className="w-2/5 h-1.5 rounded bg-[var(--color-text-primary)] opacity-[0.08]" />
        </div>
        <div className="flex-1 rounded-lg p-3 border border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
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
      setMode(palette === "ocean-blue" ? "light" : "color");
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
                : "border border-[var(--color-card-border)] bg-[var(--color-card-bg)] hover:border-[var(--color-input-border)]"
            }`}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-[#f8fafc]">
              <Sun className="size-4 text-[#64748b]" />
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
                : "border border-[var(--color-card-border)] bg-[var(--color-card-bg)] hover:border-[var(--color-input-border)]"
            }`}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#334155] bg-[#1e293b]">
              <Moon className="size-4 text-[#94a3b8]" />
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
                    : "border border-[var(--color-card-border)] hover:border-[var(--color-input-border)]"
                }`}
                style={selected ? { borderColor: p.color } : undefined}
              >
                <span
                  className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {p.short}
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
      <div className="border-t border-[var(--color-divider)]" />

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
            { key: "en" as Language, char: "EN", name: "English", sub: "Default" },
            { key: "ta" as Language, char: "\u0BA4", name: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD", sub: "Tamil" },
          ]).map(({ key, char, name, sub }) => {
            const selected = language === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setLanguage(key)}
                className={`flex flex-1 items-center gap-3 rounded-xl p-3.5 transition-all duration-200 cursor-pointer ${
                  selected
                    ? "border-2 border-[var(--color-primary)] bg-[var(--color-primary-muted)]"
                    : "border border-[var(--color-card-border)] bg-[var(--color-card-bg)] hover:border-[var(--color-input-border)]"
                }`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center text-lg font-medium text-[var(--color-text-primary)]">
                  {char}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
