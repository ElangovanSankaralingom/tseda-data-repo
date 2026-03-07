import { cn } from "@/lib/utils";

type ProgressBarProps = {
  label: string;
  value: number;
  max: number;
  color?: string;
};

export default function ProgressBar({
  label,
  value,
  max,
  color = "bg-blue-500",
}: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const isEmpty = value === 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 truncate text-sm font-medium text-slate-700">
        {label}
      </div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        {pct > 0 && (
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out", color)}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div
        className={cn(
          "w-10 text-right text-xs font-medium tabular-nums",
          isEmpty ? "text-slate-300" : "text-slate-600"
        )}
      >
        {pct}%
      </div>
    </div>
  );
}
