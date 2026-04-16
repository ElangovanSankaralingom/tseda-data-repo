export default function WorkflowHelpStrip({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={["rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-3 py-2", className ?? ""].join(" ")}>
      <div className="text-xs text-[var(--color-text-muted)]">
        <span className="font-medium text-[var(--color-text-primary)]">Save Draft</span> saves and stays.{" "}
        <span className="font-medium text-[var(--color-text-primary)]">Save &amp; Close</span> saves and exits.{" "}
        <span className="font-medium text-[var(--color-text-primary)]">Send for Confirmation</span> is a separate admin-review action.{" "}
        <span className="font-medium text-[var(--color-text-primary)]">Approved</span> entries are final.
      </div>
    </div>
  );
}
