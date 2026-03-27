import { type MetricCardTone } from "@/lib/types/ui";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MetricCard({ label, value, hint, tone = "neutral" }: { label: string; value: number; hint?: string; tone?: MetricCardTone }) {
  return (
    <div
      className={cx(
        "rounded-2xl border bg-card p-4",
        tone === "neutral" && "border-border",
        tone === "warning" && "border-amber-500/20 bg-amber-500/10",
        tone === "success" && "border-emerald-500/20 bg-emerald-500/10",
        tone === "danger" && "border-red-500/20 bg-red-500/10"
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{Number.isFinite(value) && value > 0 ? Math.floor(value) : 0}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
