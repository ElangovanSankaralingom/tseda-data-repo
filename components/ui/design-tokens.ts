import { ENTRY_STATUSES, type EntryStatus } from "@/lib/types/entry";

export const STATUS_COLORS: Record<
  EntryStatus,
  { badge: string; border: string; icon: string }
> = {
  DRAFT: {
    badge: "border-slate-200 bg-slate-50 text-slate-500",
    border: "border-l-slate-300",
    icon: "text-slate-400",
  },
  PENDING_CONFIRMATION: {
    badge: "border-amber-200 bg-amber-100 text-amber-700",
    border: "border-l-amber-500",
    icon: "text-amber-500",
  },
  APPROVED: {
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
    border: "border-l-emerald-500",
    icon: "text-emerald-500",
  },
  REJECTED: {
    badge: "border-rose-200 bg-rose-100 text-rose-700",
    border: "border-l-red-500",
    icon: "text-red-500",
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
  return FALLBACK_STATUS;
}

export function statusBadgeClasses(status: string): string {
  return STATUS_COLORS[resolveStatus(status)].badge;
}

export function statusBorderClasses(status: string): string {
  return STATUS_COLORS[resolveStatus(status)].border;
}
