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
  iconBg?: string;
  hoverRing?: string;
  hoverDescription?: string;
  staggerClass?: string;
};

export default function StatCard({
  icon: Icon,
  label,
  value,
  description,
  gradient,
  accent,
  iconColor,
  iconBg,
  hoverRing,
  hoverDescription,
  staggerClass,
}: StatCardProps) {
  const hasGradient = !!gradient;
  const displayValue = useCountUp(value);

  return (
    <div
      className={cn(
        "group rounded-xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        "animate-fade-in-up",
        staggerClass,
        hasGradient
          ? cn("border border-transparent text-white shadow-lg", gradient)
          : "border border-slate-200 bg-white shadow-sm",
        accent,
        hoverRing
      )}
    >
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110",
          hasGradient ? "bg-white/20" : iconBg ?? "bg-slate-100"
        )}
      >
        <Icon
          className={cn("size-5", hasGradient ? "text-white/80" : iconColor ?? "text-slate-500")}
        />
      </div>
      <div className="mt-3">
        <div className="text-3xl font-bold tabular-nums">
          {displayValue.toLocaleString("en-IN")}
        </div>
        <div
          className={cn(
            "mt-0.5 text-xs font-medium uppercase tracking-wide",
            hasGradient ? "text-white/80" : "text-slate-500"
          )}
        >
          {label}
        </div>
      </div>
      {description && (
        <p
          className={cn(
            "mt-2 text-xs",
            hasGradient ? "text-white/70" : "text-slate-400"
          )}
        >
          {description}
        </p>
      )}
      {hoverDescription && (
        <p
          className={cn(
            "mt-1 max-h-0 overflow-hidden text-xs italic opacity-0 transition-all duration-200",
            "group-hover:mt-2 group-hover:max-h-12 group-hover:opacity-100",
            hasGradient ? "text-white/60" : "text-slate-500"
          )}
        >
          {hoverDescription}
        </p>
      )}
    </div>
  );
}
