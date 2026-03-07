"use client";

import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

type StreakCardProps = {
  type: "active" | "wins";
  value: number;
  subtext?: string;
};

const CONFIG = {
  active: {
    icon: Flame,
    label: "Streak Activated",
    gradient:
      "border-orange-400/50 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/20",
    zeroGradient: "border-dashed border-slate-300 bg-slate-50",
    zeroCta: "Generate your first entry!",
  },
  wins: {
    icon: Trophy,
    label: "Streak Wins",
    gradient:
      "border-yellow-400/50 bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/20",
    zeroGradient: "border-dashed border-slate-300 bg-slate-50",
    zeroCta: "Complete all fields to earn wins",
  },
} as const;

export default function StreakCard({ type, value, subtext }: StreakCardProps) {
  const { icon: Icon, label, gradient, zeroGradient, zeroCta } = CONFIG[type];
  const hasValue = value > 0;
  const displayValue = useCountUp(value);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5",
        hasValue ? cn(gradient, "hover:shadow-xl") : zeroGradient
      )}
    >
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            hasValue ? "bg-white/20 text-white" : "bg-slate-200 text-slate-400"
          )}
        >
          {type === "active" ? (
            <Icon className={cn("size-5", hasValue && "animate-flame")} />
          ) : (
            <span className="inline-block transition-transform duration-300 group-hover:rotate-[-5deg]">
              <Icon className="size-5" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              hasValue ? "text-white/80" : "text-slate-400"
            )}
          >
            {label}
          </div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              hasValue ? "text-white" : "text-slate-400"
            )}
          >
            {displayValue.toLocaleString("en-IN")}
          </div>
          <div
            className={cn(
              "text-xs",
              hasValue ? "text-white/70" : "text-slate-400"
            )}
          >
            {hasValue ? subtext : zeroCta}
          </div>
        </div>
      </div>
    </div>
  );
}
