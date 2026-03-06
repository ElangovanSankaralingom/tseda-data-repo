function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type MetricCardTone = "neutral" | "warning" | "success" | "danger";

type MetricCardProps = {
  label: string;
  value: number;
  hint?: string;
  tone?: MetricCardTone;
};

export default function MetricCard({ label, value, hint, tone = "neutral" }: MetricCardProps) {
  return (
    <div
      className={cx(
        "rounded-2xl border bg-card p-4",
        tone === "neutral" && "border-border",
        tone === "warning" && "border-amber-200 bg-amber-50/60",
        tone === "success" && "border-emerald-200 bg-emerald-50/60",
        tone === "danger" && "border-red-200 bg-red-50/60"
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{Number.isFinite(value) && value > 0 ? Math.floor(value) : 0}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
