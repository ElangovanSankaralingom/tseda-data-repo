"use client";

import React from "react";
import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

const CONFIG = {
  active: {
    icon: Flame,
    label: "Streak Activated",
    gradient:
      "border-orange-400/50 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/20",
    zeroGradient: "border-dashed border-slate-300 bg-slate-50",
    zeroCta: "Generate your first entry!",
    hoverRing: "hover:ring-2 hover:ring-amber-300/50",
  },
  wins: {
    icon: Trophy,
    label: "Streak Wins",
    gradient:
      "border-yellow-400/50 bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/20",
    zeroGradient: "border-dashed border-slate-300 bg-slate-50",
    zeroCta: "Complete all fields to earn wins",
    hoverRing: "hover:ring-2 hover:ring-yellow-300/50",
  },
} as const;

function StreakCard({ type, value, subtext, hoverDescription, staggerClass }: { type: "active" | "wins"; value: number; subtext?: string; hoverDescription?: string; staggerClass?: string }) {
  const { icon: Icon, label, gradient, zeroGradient, zeroCta, hoverRing } = CONFIG[type];
  const hasValue = value > 0;
  const displayValue = useCountUp(value);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
        "animate-fade-in-up",
        staggerClass,
        hasValue ? cn(gradient, hoverRing) : zeroGradient
      )}
    >
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110",
            hasValue ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
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
              hasValue ? "text-white/80" : "text-slate-500"
            )}
          >
            {label}
          </div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              hasValue ? "text-white" : "text-slate-500"
            )}
          >
            {displayValue.toLocaleString("en-IN")}
          </div>
          <div
            className={cn(
              "text-xs",
              hasValue ? "text-white/90" : "text-slate-500"
            )}
          >
            {hasValue ? subtext : zeroCta}
          </div>
        </div>
      </div>
      {hoverDescription && (
        <p
          className={cn(
            "mt-0 max-h-0 overflow-hidden text-xs italic opacity-0 transition-all duration-200",
            "group-hover:mt-2 group-hover:max-h-12 group-hover:opacity-100",
            hasValue ? "text-white/80" : "text-slate-500"
          )}
        >
          {hoverDescription}
        </p>
      )}
    </div>
  );
}

export default React.memo(StreakCard);
