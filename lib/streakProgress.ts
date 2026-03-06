import type { CategoryKey } from "@/lib/entries/types";
import { isFutureDatedEntry, normalizeStreakState, status as getStreakStatus } from "@/lib/gamification";

export type StreakProgressEntryLike = {
  id?: unknown;
  status?: unknown;
  streak?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type StreakProgressSnapshot = {
  id: string;
  isActivated: boolean;
  isCompleted: boolean;
  isWin: boolean;
  hasActivatedAt: boolean;
  hasCompletedAt: boolean;
  dueAtISO: string | null;
  sortAtISO: string | null;
};

export type StreakActiveEntry = {
  id: string;
  categoryKey: CategoryKey;
  dueAtISO: string | null;
  sortAtISO: string | null;
};

function toOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

export function toStreakSortAtISO(entry: StreakProgressEntryLike): string | null {
  return toOptionalISO(entry.updatedAt) ?? toOptionalISO(entry.createdAt);
}

function toSortTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

export function compareStreakSortAtISO(left: string | null | undefined, right: string | null | undefined) {
  return toSortTime(left) - toSortTime(right);
}

function isFinalStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "final";
}

function isEntryFutureDated(entry: StreakProgressEntryLike) {
  const startDate = String(entry.startDate ?? "").trim();
  const endDate = String(entry.endDate ?? "").trim();
  return isFutureDatedEntry(startDate, endDate);
}

export function getStreakProgressSnapshot(entry: StreakProgressEntryLike): StreakProgressSnapshot {
  const id = String(entry.id ?? "").trim();
  const streak = normalizeStreakState(entry.streak);
  const isFutureDated = isEntryFutureDated(entry);
  const isActivated = isFutureDated && getStreakStatus(streak) === "active";
  const isCompleted = !!streak.completedAtISO;
  const isWin =
    isFinalStatus(entry.status) &&
    isFutureDated &&
    !!streak.activatedAtISO &&
    !!streak.completedAtISO &&
    !!streak.dueAtISO &&
    Date.parse(streak.completedAtISO) <= Date.parse(streak.dueAtISO);

  return {
    id,
    isActivated,
    isCompleted,
    isWin,
    hasActivatedAt: !!streak.activatedAtISO,
    hasCompletedAt: !!streak.completedAtISO,
    dueAtISO: streak.dueAtISO ?? null,
    sortAtISO: toStreakSortAtISO(entry),
  };
}

export function sortActiveStreakEntries(entries: StreakActiveEntry[]): StreakActiveEntry[] {
  return entries
    .slice()
    .sort((left, right) => compareStreakSortAtISO(left.sortAtISO, right.sortAtISO));
}
