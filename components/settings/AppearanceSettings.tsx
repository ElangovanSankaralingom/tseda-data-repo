"use client";

import { useCallback, useRef, useState } from "react";
import { Moon, Sun, RotateCcw } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  hexToHsl,
  hslToHex,
  clampAccentHsl,
  ACCENT_SAT_MIN,
  ACCENT_LIGHT_MIN,
  ACCENT_LIGHT_MAX,
  DEFAULT_ACCENT_HEX,
  type Hsl,
} from "@/lib/theme/accent";
import type { Language } from "@/lib/i18n";

const SAT_MIN_PCT = Math.round(ACCENT_SAT_MIN * 100);
const LIGHT_MIN_PCT = Math.round(ACCENT_LIGHT_MIN * 100);
const LIGHT_MAX_PCT = Math.round(ACCENT_LIGHT_MAX * 100);

function AccentSlider({
  label, value, min, max, track, onChange, onCommit,
}: {
  label: string; value: number; min: number; max: number; track: string;
  onChange: (v: number) => void; onCommit: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="accent-slider w-full"
        style={{ background: track }}
      />
    </div>
  );
}

export default function AppearanceSettings() {
  const { mode, accent, previewAccent, setAccent, language, setMode, setLanguage } = useTheme();
  const { t } = useTranslation();

  const isDark = mode === "dark";

  const [hsl, setHsl] = useState<Hsl>(() => clampAccentHsl(hexToHsl(accent)));
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestHex = useRef<string>(accent);

  const apply = useCallback(
    (next: Hsl) => {
      const clamped = clampAccentHsl(next);
      const hex = hslToHex(clamped);
      latestHex.current = hex;
      setHsl(clamped);
      previewAccent(hex); // instant, no network
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => setAccent(hex), 400);
    },
    [previewAccent, setAccent],
  );

  const commit = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    setAccent(latestHex.current);
  }, [setAccent]);

  const resetAccent = useCallback(() => {
    setHsl(clampAccentHsl(hexToHsl(DEFAULT_ACCENT_HEX)));
    latestHex.current = DEFAULT_ACCENT_HEX;
    setAccent(DEFAULT_ACCENT_HEX);
  }, [setAccent]);

  const currentHex = hslToHex(clampAccentHsl(hsl));
  const sPct = Math.round(hsl.s * 100);
  const lPct = Math.round(hsl.l * 100);
  const hueTrack = "linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))";
  const satTrack = `linear-gradient(to right, hsl(${hsl.h}, ${SAT_MIN_PCT}%, ${lPct}%), hsl(${hsl.h}, 100%, ${lPct}%))`;
  const lightTrack = `linear-gradient(to right, hsl(${hsl.h}, ${sPct}%, ${LIGHT_MIN_PCT}%), hsl(${hsl.h}, ${sPct}%, ${LIGHT_MAX_PCT}%))`;

  function handleTheme(target: "light" | "dark") {
    setMode(target === "light" ? "light" : "dark");
  }

  const cardStyle = {
    background: "var(--color-card-bg)",
    border: "1px solid var(--color-border-default)",
  } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t("nav.appearance")}
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
          {t("appearance.title")}
        </h1>
      </div>

      {/* Outer card — opaque recessed panel; each setting is its own opaque card within */}
      <div
        className="space-y-4 rounded-3xl p-4 sm:p-5"
        style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}
      >
      {/* Theme */}
      <section className="rounded-2xl p-5" style={cardStyle}>
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
                : "border border-[var(--color-glass-border)] bg-[var(--color-surface-inset)] hover:border-[var(--color-text-muted)]"
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
                : "border border-[var(--color-glass-border)] bg-[var(--color-surface-inset)] hover:border-[var(--color-text-muted)]"
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

      {/* Accent color — custom HSL picker */}
      <section className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("appearance.colorPalette")}
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {t("appearance.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAccent}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:bg-[var(--color-badge-bg)]"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {/* Live swatch */}
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl shadow-sm"
            style={{ background: currentHex, border: "1px solid var(--color-surface-on-accent)" }}
          >
            <span className="font-mono text-[10px] font-bold tracking-wide text-[var(--color-text-on-accent)]">
              {currentHex}
            </span>
          </div>
          {/* Sliders */}
          <div className="flex-1 space-y-3">
            <AccentSlider label="Hue" value={hsl.h} min={0} max={360} track={hueTrack}
              onChange={(v) => apply({ ...hsl, h: v })} onCommit={commit} />
            <AccentSlider label="Saturation" value={sPct} min={SAT_MIN_PCT} max={100} track={satTrack}
              onChange={(v) => apply({ ...hsl, s: v / 100 })} onCommit={commit} />
            <AccentSlider label="Brightness" value={lPct} min={LIGHT_MIN_PCT} max={LIGHT_MAX_PCT} track={lightTrack}
              onChange={(v) => apply({ ...hsl, l: v / 100 })} onCommit={commit} />
          </div>
        </div>
      </section>

      {/* Language */}
      <section className="rounded-2xl p-5" style={cardStyle}>
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
                    : "border border-[var(--color-glass-border)] bg-[var(--color-surface-inset)] hover:border-[var(--color-text-muted)]"
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
    </div>
  );
}
