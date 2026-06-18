import { getConfirmationStatusLabel, normalizeEntryApprovalStatus } from "@/lib/confirmation";
import type { EntryStatus } from "@/lib/types/entry";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const DOT_COLOR: Record<string, string> = {
  GENERATED: "text-[var(--color-status-info)]",
  EDIT_REQUESTED: "text-[var(--color-status-warning)]",
  EDIT_GRANTED: "text-[var(--color-status-success)]",
  DELETE_REQUESTED: "text-[var(--color-status-error)]",
  DRAFT: "text-[var(--color-text-muted)]",
  ARCHIVED: "text-[var(--color-text-muted)]",
};

export default function EntryStatusBadge({ status, className }: { status?: EntryStatus | string | null; className?: string }) {
  if (!status) return null;

  const normalized = normalizeEntryApprovalStatus(status);
  const label = getConfirmationStatusLabel(normalized);

  return (
    <span className={cx("lg-pill px-2 py-1 text-xs font-medium", className)}>
      <span className={cx("lg-dot", DOT_COLOR[normalized] ?? "text-[var(--color-text-muted)]")} aria-hidden="true" />
      {label}
    </span>
  );
}
