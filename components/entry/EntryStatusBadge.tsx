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
        normalized === "GENERATED" && "border-blue-200 bg-blue-50 text-blue-700",
        normalized === "EDIT_REQUESTED" && "border-amber-200 bg-amber-50 text-amber-800",
        normalized === "EDIT_GRANTED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        normalized === "DRAFT" && "border-slate-200 bg-slate-50 text-slate-700",
        normalized === "DELETE_REQUESTED" && "border-red-200 bg-red-50 text-red-700",
        normalized === "ARCHIVED" && "border-slate-300 bg-slate-100 text-slate-700",
        className
      )}
    >
      {label}
    </span>
  );
}
