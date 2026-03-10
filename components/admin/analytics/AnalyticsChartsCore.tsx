"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { compare } from "@/lib/analytics/compare";

export function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

const CATEGORY_COLORS: Record<string, string> = {
  "fdp-attended": "#3B82F6",
  "fdp-conducted": "#8B5CF6",
  "case-studies": "#F59E0B",
  "guest-lectures": "#10B981",
  workshops: "#EF4444",
};

export function catColor(slug: string) {
  return CATEGORY_COLORS[slug] ?? "#64748B";
}

export function AnimatedCount({ value, suffix }: { value: number; suffix?: string }) {
  const count = useCountUp(value);
  return (
    <span>
      {count.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

export function ComparisonBadge({ current, previous }: { current: number; previous: number }) {
  const c = compare(current, previous);
  if (c.direction === "flat") {
    return (
      <span className="flex items-center gap-0.5 text-xs text-slate-500">
        <Minus className="size-3" /> No change
      </span>
    );
  }
  const isUp = c.direction === "up";
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${
        isUp ? "text-emerald-600" : "text-red-500"
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

export function MetricCard({
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
      className={`group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up ${accent} ${hoverRing} stagger-${stagger}`}
    >
      <div
        className={`flex size-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 ${iconBg}`}
      >
        <Icon className={`size-5 ${iconColor}`} />
      </div>
      <div className="mt-3">
        <div className="text-3xl font-bold tabular-nums text-slate-900">
          <AnimatedCount value={value} suffix={suffix} />
        </div>
        <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </div>
      </div>
      <div className="mt-2">
        <ComparisonBadge current={current} previous={previous} />
      </div>
    </div>
  );
}

export function SH({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}
