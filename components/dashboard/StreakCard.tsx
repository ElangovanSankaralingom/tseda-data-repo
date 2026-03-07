import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type StreakCardProps = {
  type: "active" | "wins" | "current";
  value: number;
  isActive: boolean;
  subtext?: string;
};

const CONFIG = {
  active: {
    icon: Flame,
    label: "Streak Activated",
    gradient:
      "border-orange-400/50 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/20",
  },
  wins: {
    icon: Trophy,
    label: "Streak Wins",
    gradient:
      "border-yellow-400/50 bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/20",
  },
  current: {
    icon: Flame,
    label: "Current Streak",
    gradient:
      "border-orange-400/50 bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-red-500/20",
  },
} as const;

export default function StreakCard({ type, value, isActive, subtext }: StreakCardProps) {
  const { icon: Icon, label, gradient } = CONFIG[type];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 transition-shadow duration-200",
        isActive
          ? cn(gradient, "ring-2 ring-amber-400/30")
          : "border-dashed border-slate-300 bg-slate-50"
      )}
    >
      {isActive && (
        <div className="absolute inset-0 animate-pulse bg-white/10 pointer-events-none" />
      )}
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            isActive ? "bg-white/20 text-white" : "bg-muted text-slate-400"
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              isActive ? "text-white/80" : "text-muted-foreground"
            )}
          >
            {label}
          </div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              isActive ? "text-white" : "text-muted-foreground"
            )}
          >
            {value}
          </div>
          {subtext && (
            <div
              className={cn(
                "text-xs",
                isActive ? "text-white/70" : "text-muted-foreground"
              )}
            >
              {subtext}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
