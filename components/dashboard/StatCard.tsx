"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatNumber } from "@/lib/i18n/locale";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  description?: string;
  gradient?: string;
  accent?: string;
  iconColor?: string;
  iconBg?: string;
  hoverRing?: string;
  hoverDescription?: string;
  staggerClass?: string;
  glowColor?: string;
};

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  gradient,
  accent,
  iconColor,
  iconBg,
  hoverDescription,
  staggerClass,
  glowColor,
}: StatCardProps) {
  const hasGradient = !!gradient;
  const displayValue = useCountUp(value);
  const { language } = useTranslation();

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl p-5 transition-all duration-500",
        "animate-metric-reveal",
        staggerClass,
        hasGradient
          ? cn("border border-transparent text-[var(--color-text-on-accent)] shadow-lg", gradient)
          : "border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl shadow-sm",
        accent,
        /* Hover — lift + glow */
        !hasGradient && "hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/20 hover:border-[var(--color-primary)]/15"
      )}
    >
      {/* Ambient glow on hover */}
      {!hasGradient && (
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
            glowColor ?? "bg-[var(--color-primary)]/10"
          )}
        />
      )}

      <div className="relative">
        {/* Icon */}
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg",
            hasGradient ? "bg-[var(--color-surface-on-accent-strong)]" : iconBg ?? "bg-[var(--color-glass-hover)]",
            !hasGradient && "group-hover:shadow-black/10"
          )}
        >
          <Icon
            className={cn("size-5 transition-colors duration-300", hasGradient ? "text-[var(--color-text-on-accent-muted)]" : iconColor ?? "text-[var(--color-primary)]")}
          />
        </div>

        {/* Metric */}
        <div className="mt-4">
          <div className={cn("text-4xl font-bold tabular-nums tracking-tight", hasGradient ? "" : "text-[var(--color-text-primary)]")}>
            {formatNumber(displayValue, language)}
          </div>
          <div
            className={cn(
              "mt-1 text-xs font-semibold uppercase tracking-wider",
              hasGradient ? "text-[var(--color-text-on-accent-muted)]" : "text-[var(--color-text-muted)]"
            )}
          >
            {label}
          </div>
        </div>

        {/* Description */}
        {description && (
          <p
            className={cn(
              "mt-3 text-xs leading-relaxed",
              hasGradient ? "text-[var(--color-text-on-accent-muted)]" : "text-[var(--color-text-secondary)]"
            )}
          >
            {description}
          </p>
        )}

        {/* Hover reveal description */}
        {hoverDescription && (
          <p
            className={cn(
              "mt-0 max-h-0 overflow-hidden text-xs italic leading-relaxed opacity-0 transition-all duration-300",
              "group-hover:mt-3 group-hover:max-h-16 group-hover:opacity-100",
              hasGradient ? "text-[var(--color-text-on-accent-muted)]" : "text-[var(--color-text-secondary)]"
            )}
          >
            {hoverDescription}
          </p>
        )}
      </div>
    </div>
  );
}

export default React.memo(StatCard);
