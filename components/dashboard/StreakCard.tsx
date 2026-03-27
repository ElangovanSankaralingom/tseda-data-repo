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
    filled: "border-amber-500/20 bg-amber-500/[0.08] shadow-sm backdrop-blur-sm",
    zeroFilled: "border-dashed border-[var(--color-input-border)] bg-[var(--color-body-bg)]",
    hoverRing: "hover:ring-2 hover:ring-amber-300/30",
    iconBg: "bg-amber-500/[0.12]",
    iconColor: "text-amber-600 opacity-60",
    labelColor: "text-amber-600/80",
  },
  wins: {
    icon: Trophy,
    filled: "border-emerald-500/20 bg-emerald-500/[0.08] shadow-sm backdrop-blur-sm",
    zeroFilled: "border-dashed border-[var(--color-input-border)] bg-[var(--color-body-bg)]",
    hoverRing: "hover:ring-2 hover:ring-emerald-300/30",
    iconBg: "bg-emerald-500/[0.12]",
    iconColor: "text-emerald-600 opacity-60",
    labelColor: "text-emerald-600/80",
  },
} as const;

function StreakCard({ type, value, subtext, hoverDescription, staggerClass }: { type: "active" | "wins"; value: number; subtext?: string; hoverDescription?: string; staggerClass?: string }) {
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
        "group relative overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        "animate-fade-in-up",
        staggerClass,
        hasValue ? cn(config.filled, config.hoverRing) : config.zeroFilled
      )}
    >
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110",
            hasValue ? config.iconBg : "bg-[var(--color-skeleton-base)]"
          )}
        >
          {type === "active" ? (
            <Icon className={cn("size-5", hasValue ? config.iconColor : "text-[var(--color-text-secondary)]")} />
          ) : (
            <span className="inline-block transition-transform duration-300 group-hover:rotate-[-5deg]">
              <Icon className={cn("size-5", hasValue ? config.iconColor : "text-[var(--color-text-secondary)]")} />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              hasValue ? config.labelColor : "text-[var(--color-text-secondary)]"
            )}
          >
            {label}
          </div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              hasValue ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
            )}
          >
            {formatNumber(displayValue, language)}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {hasValue ? subtext : zeroCta}
          </div>
        </div>
      </div>
      {hoverDescription && (
        <p
          className={cn(
            "mt-0 max-h-0 overflow-hidden text-xs italic opacity-0 transition-all duration-200",
            "group-hover:mt-2 group-hover:max-h-12 group-hover:opacity-100",
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
