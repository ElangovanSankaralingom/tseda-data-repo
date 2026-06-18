import { ENTRY_STATUS_LABELS, type EntryStatus } from "@/lib/types/entry";
import { cn } from "@/lib/utils";
import { statusBadgeClasses, statusDotClass } from "@/components/ui/design-tokens";

export default function StatusBadge({ status, className }: { status: EntryStatus | string; className?: string }) {
  const label =
    ENTRY_STATUS_LABELS[status as EntryStatus] ??
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={cn(statusBadgeClasses(status), className)}
    >
      <span className={cn("lg-dot", statusDotClass(status))} aria-hidden="true" />
      {label}
    </span>
  );
}
