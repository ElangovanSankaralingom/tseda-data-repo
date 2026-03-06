import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import { normalizeStreakState } from "@/lib/gamification";

export const STREAK_RULE_VERSION = 2;

export type StreakProgressEntryLike = {
  id?: unknown;
  status?: unknown;
  confirmationStatus?: unknown;
  committedAtISO?: unknown;
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

export type StreakProgressAggregateByCategory = Record<CategoryKey, { activated: number; wins: number }>;

export type StreakProgressAggregateEntry = StreakProgressEntryLike & {
  categoryKey: CategoryKey;
};

export type StreakProgressAggregate = {
  activatedCount: number;
  winsCount: number;
  byCategory: StreakProgressAggregateByCategory;
  activatedEntries: StreakActiveEntry[];
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
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "final" || normalized === "completed";
}

function hasCommittedMilestone(entry: StreakProgressEntryLike) {
  if (toOptionalISO(entry.committedAtISO)) {
    return true;
  }
  if (isFinalStatus(entry.status)) {
    return true;
  }
  const streak = normalizeStreakState(entry.streak);
  return !!streak.activatedAtISO || !!streak.completedAtISO;
}

export function getStreakProgressSnapshot(entry: StreakProgressEntryLike): StreakProgressSnapshot {
  const id = String(entry.id ?? "").trim();
  const streak = normalizeStreakState(entry.streak);
  const workflowStatus = normalizeEntryStatus(entry as EntryStateLike);
  const committed = hasCommittedMilestone(entry);
  // Canonical streak rule:
  // - Activated: committed draft milestone reached and not yet approved.
  // - Win: committed draft milestone that has been approved.
  const isWin = committed && workflowStatus === "APPROVED";
  const isActivated = committed && !isWin;
  const isCompleted = committed;

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

function emptyAggregateByCategory(): StreakProgressAggregateByCategory {
  return CATEGORY_KEYS.reduce<StreakProgressAggregateByCategory>((next, categoryKey) => {
    next[categoryKey] = { activated: 0, wins: 0 };
    return next;
  }, {} as StreakProgressAggregateByCategory);
}

export function createEmptyStreakProgressAggregate(): StreakProgressAggregate {
  return {
    activatedCount: 0,
    winsCount: 0,
    byCategory: emptyAggregateByCategory(),
    activatedEntries: [],
  };
}

export function computeStreakProgressAggregate(
  entries: ReadonlyArray<StreakProgressAggregateEntry>
): StreakProgressAggregate {
  const summary = createEmptyStreakProgressAggregate();

  for (const entry of entries) {
    const categoryKey = entry.categoryKey;
    if (!CATEGORY_KEYS.includes(categoryKey)) continue;

    const streak = getStreakProgressSnapshot(entry);
    if (streak.isWin) {
      summary.winsCount += 1;
      summary.byCategory[categoryKey].wins += 1;
    }

    if (!streak.isActivated) {
      continue;
    }

    summary.activatedCount += 1;
    summary.byCategory[categoryKey].activated += 1;
    if (!streak.id) {
      continue;
    }

    summary.activatedEntries.push({
      id: streak.id,
      categoryKey,
      dueAtISO: streak.dueAtISO,
      sortAtISO: streak.sortAtISO,
    });
  }

  summary.activatedEntries = sortActiveStreakEntries(summary.activatedEntries);
  return summary;
}
