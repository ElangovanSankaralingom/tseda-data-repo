"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  description?: string;
  gradient?: string;
  accent?: string;
  iconColor?: string;
  hoverRing?: string;
};

export default function StatCard({
  icon: Icon,
  label,
  value,
  description,
  gradient,
  accent,
  iconColor,
  hoverRing,
}: StatCardProps) {
  const hasGradient = !!gradient;
  const displayValue = useCountUp(value);

  return (
    <div
      className={cn(
        "group rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        hasGradient
          ? cn("border border-transparent text-white shadow-lg", gradient)
          : "border border-slate-200 bg-white shadow-sm",
        accent,
        hoverRing
      )}
    >
      <span className="inline-block transition-transform duration-200 group-hover:-translate-y-0.5">
        <Icon
          className={cn("size-5", hasGradient ? "text-white/80" : iconColor ?? "text-muted-foreground")}
        />
      </span>
      <div className="mt-3">
        <div className="text-3xl font-bold tabular-nums">
          {displayValue.toLocaleString("en-IN")}
        </div>
        <div
          className={cn(
            "mt-0.5 text-xs font-medium uppercase tracking-wide",
            hasGradient ? "text-white/80" : "text-muted-foreground"
          )}
        >
          {label}
        </div>
      </div>
      {description && (
        <p
          className={cn(
            "mt-2 text-xs",
            hasGradient ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
