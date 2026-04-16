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
        normalized === "GENERATED" && "border-blue-500/20 bg-blue-500/10 text-blue-700",
        normalized === "EDIT_REQUESTED" && "border-amber-500/20 bg-amber-500/10 text-amber-800",
        normalized === "EDIT_GRANTED" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
        normalized === "DRAFT" && "border-[var(--color-glass-border)] bg-[var(--color-body-bg)] text-[var(--color-text-primary)]",
        normalized === "DELETE_REQUESTED" && "border-red-500/20 bg-red-500/10 text-red-400",
        normalized === "ARCHIVED" && "border-[var(--color-input-border)] bg-[var(--color-dropdown-hover)] text-[var(--color-text-primary)]",
        className
      )}
    >
      {label}
    </span>
  );
}
