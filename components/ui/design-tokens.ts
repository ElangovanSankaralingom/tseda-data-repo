import { ENTRY_STATUSES, type EntryStatus } from "@/lib/types/entry";

export const STATUS_COLORS: Record<
  EntryStatus,
  { badge: string; border: string; icon: string }
> = {
  DRAFT: {
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    border: "border-l-slate-300",
    icon: "text-slate-600",
  },
  GENERATED: {
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    border: "border-l-blue-500",
    icon: "text-blue-500",
  },
  EDIT_REQUESTED: {
    badge: "border-amber-200 bg-amber-100 text-amber-700",
    border: "border-l-amber-500",
    icon: "text-amber-500",
  },
  DELETE_REQUESTED: {
    badge: "border-red-200 bg-red-100 text-red-700",
    border: "border-l-red-500",
    icon: "text-red-500",
  },
  EDIT_GRANTED: {
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
    border: "border-l-emerald-500",
    icon: "text-emerald-500",
  },
  ARCHIVED: {
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    border: "border-l-slate-400",
    icon: "text-slate-600",
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
