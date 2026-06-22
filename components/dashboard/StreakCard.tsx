"use client";

import React from "react";
import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatNumber } from "@/lib/i18n/locale";

const STYLE_CONFIG = {
  active: {
    icon: Flame,
    filledBorder: "border-amber-400/20",
    filledGlow: "shadow-[0_0_24px_rgba(251,191,36,0.1)]",
    hoverGlow: "hover:shadow-[0_0_32px_rgba(251,191,36,0.18)]",
    accentLine: "from-amber-400 to-orange-500",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    labelColor: "text-amber-400/80",
    ambientGlow: "bg-amber-400/10",
    metricColor: "text-amber-400",
    iconAnim: "animate-flame-pulse",
  },
  wins: {
    icon: Trophy,
    filledBorder: "border-[var(--color-primary)]/20",
    filledGlow: "shadow-[0_0_24px_var(--color-glow-primary)]",
    hoverGlow: "hover:shadow-[0_0_32px_var(--color-glow-primary)]",
    accentLine: "from-[var(--color-primary)] to-[var(--color-primary-light)]",
    iconBg: "bg-[var(--color-primary)]/15",
    iconColor: "text-[var(--color-primary)]",
    labelColor: "text-[var(--color-primary)]/80",
    ambientGlow: "bg-[var(--color-primary)]/10",
    metricColor: "text-[var(--color-primary-light)]",
    iconAnim: "",
  },
} as const;

function StreakCard({
  type,
  value,
  subtext,
  hoverDescription,
  staggerClass,
}: {
  type: "active" | "wins";
  value: number;
  subtext?: string;
  hoverDescription?: string;
  staggerClass?: string;
}) {
  const { t, language } = useTranslation();
  const config = STYLE_CONFIG[type];
  const Icon = config.icon;
  const hasValue = value > 0;
  const displayValue = useCountUp(value);

  const label = type === "active" ? t("streak.activated") : t("streak.won");
  const zeroCta = type === "active" ? t("dashboard.generateFirstEntry") : t("dashboard.completeFieldsToWin");

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-500",
        "animate-metric-reveal",
        staggerClass,
        hasValue
          ? cn(
              config.filledBorder,
              "bg-[var(--color-glass-bg)] backdrop-blur-xl",
              config.filledGlow,
              config.hoverGlow,
              "hover:-translate-y-1.5"
            )
          : "border-dashed border-[var(--color-glass-border)] bg-[var(--color-body-bg)] hover:border-[var(--color-glass-border)] hover:bg-[var(--color-glass-bg)]"
      )}
    >
      {/* Accent gradient line at top */}
      {hasValue && (
        <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", config.accentLine)} />
      )}

      {/* Ambient glow blob */}
      {hasValue && (
        <div
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 size-40 rounded-full blur-3xl animate-ambient-breathe",
            config.ambientGlow
          )}
        />
      )}

      <div className="relative flex items-start gap-4">
        {/* Icon container */}
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
            hasValue ? config.iconBg : "bg-[var(--color-skeleton-base)]",
            "group-hover:scale-110 group-hover:shadow-lg"
          )}
        >
          <Icon
            className={cn(
              "size-6",
              hasValue ? cn(config.iconColor, config.iconAnim) : "text-[var(--color-text-muted)]"
            )}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.15em]",
              hasValue ? config.labelColor : "text-[var(--color-text-muted)]"
            )}
          >
            {label}
          </div>
          <div
            className={cn(
              "mt-1 text-4xl font-bold tabular-nums tracking-tight",
              hasValue ? config.metricColor : "text-[var(--color-text-secondary)]"
            )}
          >
            {formatNumber(displayValue, language)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {hasValue ? subtext : zeroCta}
          </div>
        </div>
      </div>

      {/* Hover description */}
      {hoverDescription && (
        <p
          className={cn(
            "relative mt-0 max-h-0 overflow-hidden text-xs italic leading-relaxed opacity-0 transition-all duration-300",
            "group-hover:mt-3 group-hover:max-h-16 group-hover:opacity-100",
            "text-[var(--color-text-secondary)]"
          )}
        >
          {hoverDescription}
        </p>
      )}
    </div>
  );
}

export default React.memo(StreakCard);
