import { ENTRY_STATUS_LABELS, type EntryStatus } from "@/lib/types/entry";
import { cn } from "@/lib/utils";
import { statusBadgeClasses } from "@/components/ui/design-tokens";

type StatusBadgeProps = {
  status: EntryStatus | string;
  className?: string;
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const label =
    ENTRY_STATUS_LABELS[status as EntryStatus] ??
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusBadgeClasses(status),
        className
      )}
    >
      {label}
    </span>
  );
}
