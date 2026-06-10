import { type MetricCardTone } from "@/lib/types/ui";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MetricCard({ label, value, hint, tone = "neutral" }: { label: string; value: number; hint?: string; tone?: MetricCardTone }) {
  return (
    <div
      className={cx(
        "rounded-2xl border bg-[var(--color-glass-bg)] backdrop-blur-sm p-4",
        tone === "neutral" && "border-[var(--color-glass-border)]",
        tone === "warning" && "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)]",
        tone === "success" && "border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)]",
        tone === "danger" && "border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)]"
      )}
    >
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{Number.isFinite(value) && value > 0 ? Math.floor(value) : 0}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</div> : null}
    </div>
  );
}
