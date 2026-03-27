import { ENTRY_STATUSES, type EntryStatus } from "@/lib/types/entry";

export const STATUS_COLORS: Record<
  EntryStatus,
  { badge: string; border: string; icon: string }
> = {
  DRAFT: {
    badge: "border-[var(--color-card-border)] bg-[var(--color-body-bg)] text-[var(--color-text-primary)]",
    border: "border-l-[var(--color-text-muted)]",
    icon: "text-[var(--color-text-secondary)]",
  },
  GENERATED: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-500",
    border: "border-l-blue-500",
    icon: "text-blue-500",
  },
  EDIT_REQUESTED: {
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-500",
    border: "border-l-amber-500",
    icon: "text-amber-500",
  },
  DELETE_REQUESTED: {
    badge: "border-red-500/20 bg-red-500/10 text-red-500",
    border: "border-l-red-500",
    icon: "text-red-500",
  },
  EDIT_GRANTED: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    border: "border-l-emerald-500",
    icon: "text-emerald-500",
  },
  ARCHIVED: {
    badge: "border-[var(--color-input-border)] bg-[var(--color-dropdown-hover)] text-[var(--color-text-primary)]",
    border: "border-l-[var(--color-text-muted)]",
    icon: "text-[var(--color-text-secondary)]",
  },
};

export const GAMIFICATION_GRADIENTS = {
  "streak-active":
    "bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/20",
  "streak-record":
    "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/20",
  progress:
    "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20",
  achievement:
    "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20",
} as const;

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

export function statusBadgeClasses(status: string): string {
  return STATUS_COLORS[resolveStatus(status)].badge;
}

export function statusBorderClasses(status: string): string {
  return STATUS_COLORS[resolveStatus(status)].border;
}
