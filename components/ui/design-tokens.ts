import { ENTRY_STATUSES, type EntryStatus } from "@/lib/types/entry";

export const STATUS_COLORS: Record<
  EntryStatus,
  { dot: string; border: string; icon: string }
> = {
  DRAFT: {
    dot: "text-[var(--color-text-muted)]",
    border: "border-l-[var(--color-text-muted)]",
    icon: "text-[var(--color-text-secondary)]",
  },
  GENERATED: {
    dot: "text-[var(--color-status-info)]",
    border: "border-l-[var(--color-status-info)]",
    icon: "text-[var(--color-status-info)]",
  },
  EDIT_REQUESTED: {
    dot: "text-[var(--color-status-warning)]",
    border: "border-l-[var(--color-status-warning)]",
    icon: "text-[var(--color-status-warning)]",
  },
  DELETE_REQUESTED: {
    dot: "text-[var(--color-status-error)]",
    border: "border-l-[var(--color-status-error)]",
    icon: "text-[var(--color-status-error)]",
  },
  EDIT_GRANTED: {
    dot: "text-[var(--color-status-success)]",
    border: "border-l-[var(--color-status-success)]",
    icon: "text-[var(--color-status-success)]",
  },
  ARCHIVED: {
    dot: "text-[var(--color-text-muted)]",
    border: "border-l-[var(--color-text-muted)]",
    icon: "text-[var(--color-text-secondary)]",
  },
};

const FALLBACK_STATUS: EntryStatus = "DRAFT";

function resolveStatus(status: string): EntryStatus {
  const upper = status.toUpperCase();
  if ((ENTRY_STATUSES as readonly string[]).includes(upper)) {
    return upper as EntryStatus;
  }
  // Legacy mapping
  if (upper === "PENDING_CONFIRMATION") return "GENERATED";
  if (upper === "APPROVED") return "GENERATED";
  if (upper === "REJECTED") return "GENERATED";
  return FALLBACK_STATUS;
}

/** Neutral frosted-pill classes shared by every status badge. The semantic
 *  colour is carried by the leading dot (see statusDotClass), not the pill. */
export function statusBadgeClasses(_status?: string): string {
  return "lg-pill px-2.5 py-1 text-xs font-medium";
}

/** Tailwind text-colour class for the badge's leading .lg-dot (drives currentColor). */
export function statusDotClass(status: string): string {
  return STATUS_COLORS[resolveStatus(status)].dot;
}

export function statusBorderClasses(status: string): string {
  return STATUS_COLORS[resolveStatus(status)].border;
}
