import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  gradient?: string;
};

export default function StatCard({
  icon: Icon,
  label,
  value,
  description,
  gradient,
}: StatCardProps) {
  const hasGradient = !!gradient;

  return (
    <div
      className={cn(
        "rounded-xl p-5",
        hasGradient
          ? cn("border border-transparent text-white shadow-lg", gradient)
          : "border border-slate-200 bg-white shadow-sm"
      )}
    >
      <Icon
        className={cn("size-5", hasGradient ? "text-white/80" : "text-muted-foreground")}
      />
      <div className="mt-3">
        <div className="text-3xl font-bold tabular-nums">{value}</div>
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
