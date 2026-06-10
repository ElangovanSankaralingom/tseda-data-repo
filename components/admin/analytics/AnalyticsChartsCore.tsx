"use client";

import { memo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { formatNumber } from "@/lib/i18n/locale";
import { compare } from "@/lib/analytics/compare";
import { CATEGORY_REGISTRY, type CategorySlug } from "@/data/categoryRegistry";
import { CHART_FALLBACK_HEX } from "@/lib/theme/themeTokens";

export function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

/** Derive chart hex color from the category registry — single source of truth. */
export function catColor(slug: string) {
  const config = CATEGORY_REGISTRY[slug as CategorySlug];
  return config?.color.chartHex ?? CHART_FALLBACK_HEX;
}

export function AnimatedCount({ value, suffix }: { value: number; suffix?: string }) {
  const count = useCountUp(value);
  return (
    <span>
      {formatNumber(count, "en")}
      {suffix}
    </span>
  );
}

export function ComparisonBadge({ current, previous }: { current: number; previous: number }) {
  const c = compare(current, previous);
  if (c.direction === "flat") {
    return (
      <span className="flex items-center gap-0.5 text-xs text-[var(--color-text-secondary)]">
        <Minus className="size-3" /> No change
      </span>
    );
  }
  const isUp = c.direction === "up";
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${
        isUp ? "text-[var(--color-status-success)]" : "text-[var(--color-status-error)]"
      }`}
    >
      {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(c.percentChange)}% vs prev
    </span>
  );
}

export type MetricCardProps = {
  icon: typeof Trophy;
  label: string;
  value: number;
  accent: string;
  iconBg: string;
  iconColor: string;
  hoverRing: string;
  current: number;
  previous: number;
  suffix?: string;
  stagger: number;
};

export const MetricCard = memo(function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
  iconBg,
  iconColor,
  hoverRing,
  current,
  previous,
  suffix,
  stagger,
}: MetricCardProps) {
  return (
    <div
      className={`group rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up ${accent} ${hoverRing} stagger-${stagger}`}
    >
      <div
        className={`flex size-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 ${iconBg}`}
      >
        <Icon className={`size-5 ${iconColor}`} />
      </div>
      <div className="mt-3">
        <div className="text-3xl font-bold tabular-nums text-[var(--color-text-primary)]">
          <AnimatedCount value={value} suffix={suffix} />
        </div>
        <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </div>
      </div>
      <div className="mt-2">
        <ComparisonBadge current={current} previous={previous} />
      </div>
    </div>
  );
});

export function SH({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
    </div>
  );
}
