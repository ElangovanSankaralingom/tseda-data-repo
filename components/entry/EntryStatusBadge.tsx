import { getConfirmationStatusLabel, normalizeEntryApprovalStatus } from "@/lib/confirmation";
import type { EntryStatus } from "@/lib/types/entry";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type EntryStatusBadgeProps = {
  status?: EntryStatus | string | null;
  className?: string;
};

export default function EntryStatusBadge({ status, className }: EntryStatusBadgeProps) {
  if (!status) return null;

  const normalized = normalizeEntryApprovalStatus(status);
  const label = getConfirmationStatusLabel(normalized);

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        normalized === "APPROVED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        normalized === "PENDING_CONFIRMATION" && "border-amber-200 bg-amber-50 text-amber-800",
        normalized === "REJECTED" && "border-rose-200 bg-rose-50 text-rose-700",
        normalized === "DRAFT" && "border-border bg-muted/40 text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}
