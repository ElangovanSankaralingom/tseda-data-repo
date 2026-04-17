import { getConfirmationStatusLabel, normalizeEntryApprovalStatus } from "@/lib/confirmation";
import type { EntryStatus } from "@/lib/types/entry";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function EntryStatusBadge({ status, className }: { status?: EntryStatus | string | null; className?: string }) {
  if (!status) return null;

  const normalized = normalizeEntryApprovalStatus(status);
  const label = getConfirmationStatusLabel(normalized);

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        normalized === "GENERATED" && "border-[var(--color-status-info-border)] bg-[var(--color-status-info-bg)] text-[var(--color-status-info)]",
        normalized === "EDIT_REQUESTED" && "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]",
        normalized === "EDIT_GRANTED" && "border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]",
        normalized === "DRAFT" && "border-[var(--color-glass-border)] bg-[var(--color-body-bg)] text-[var(--color-text-primary)]",
        normalized === "DELETE_REQUESTED" && "border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]",
        normalized === "ARCHIVED" && "border-[var(--color-input-border)] bg-[var(--color-dropdown-hover)] text-[var(--color-text-primary)]",
        className
      )}
    >
      {label}
    </span>
  );
}
