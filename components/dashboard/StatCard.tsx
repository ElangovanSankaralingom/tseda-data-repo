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
        "rounded-2xl border p-4",
        hasGradient
          ? cn("border-transparent text-white", gradient)
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            hasGradient ? "bg-white/20" : "bg-muted"
          )}
        >
          <Icon
            className={cn("size-4", hasGradient ? "text-white" : "text-muted-foreground")}
          />
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              hasGradient ? "text-white/80" : "text-muted-foreground"
            )}
          >
            {label}
          </div>
          <div className="text-3xl font-bold tabular-nums">{value}</div>
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
