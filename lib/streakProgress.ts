/**
 * Canonical business-progress / streak rule layer.
 *
 * Ownership:
 * - activated / win counting lives here
 * - canonical persisted streak metadata transitions live here
 * - cache/snapshot readers may consume this output, but must not redefine it
 */
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import {
  isEntryCommitted,
  normalizeEntryStatus,
  type EntryStateLike,
} from "@/lib/entries/stateMachine";
import {
  computeDueAtISO,
  isFutureDatedEntry,
} from "@/lib/streakTiming";
import { normalizeStreakState, type StreakState } from "@/lib/streakState";
import { nowISTTimestampISO } from "@/lib/time";

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

export type CanonicalStreakSnapshot = {
  ruleVersion: number;
  streakActivatedCount: number;
  streakWinsCount: number;
  byCategory: StreakProgressAggregateByCategory;
  activeEntries: StreakActiveEntry[];
};

export type BuildCanonicalStreakMetadataArgs = {
  streak: unknown;
  startDateISO?: string | null;
  endDateISO?: string | null;
  hasPdf: boolean;
  isCommitted: boolean;
  completionSatisfied: boolean;
  nowISO?: string | null;
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

function hasCommittedMilestone(entry: StreakProgressEntryLike) {
  // Canonical streak counting must follow workflow commitment only.
  // Legacy streak timestamps are display metadata and must not activate counts.
  return isEntryCommitted(entry as EntryStateLike);
}

export function clearStreakMetadata(streakValue: unknown): StreakState {
  const streak = normalizeStreakState(streakValue);
  return {
    ...streak,
    activatedAtISO: null,
    dueAtISO: null,
    completedAtISO: null,
  };
}

export function activateStreakMetadata(
  streakValue: unknown,
  endDateISO?: string | null,
  activatedAtISO?: string | null
) {
  const streak = normalizeStreakState(streakValue);
  return {
    ...streak,
    activatedAtISO: streak.activatedAtISO ?? activatedAtISO ?? nowISTTimestampISO(),
    dueAtISO: streak.dueAtISO ?? (endDateISO ? computeDueAtISO(endDateISO) : null),
    completedAtISO: streak.completedAtISO ?? null,
  };
}

export function completeStreakMetadata(streakValue: unknown, completedAtISO?: string | null) {
  const streak = normalizeStreakState(streakValue);
  return {
    ...streak,
    completedAtISO: streak.completedAtISO ?? completedAtISO ?? nowISTTimestampISO(),
  };
}

function isOnOrBeforeDueAt(nowISO: string, dueAtISO: string | null | undefined) {
  if (!dueAtISO) return false;
  const nowTime = Date.parse(nowISO);
  const dueAtTime = Date.parse(dueAtISO);
  if (Number.isNaN(nowTime) || Number.isNaN(dueAtTime)) return false;
  return nowTime <= dueAtTime;
}

export function isStreakProgressEligible(startDateISO?: string | null, endDateISO?: string | null) {
  return isFutureDatedEntry(startDateISO ?? "", endDateISO ?? "");
}

export function buildCanonicalStreakMetadata(args: BuildCanonicalStreakMetadataArgs): StreakState {
  const nowISO = toOptionalISO(args.nowISO) ?? nowISTTimestampISO();
  const isEligible = isStreakProgressEligible(args.startDateISO, args.endDateISO);

  if (!args.hasPdf || !isEligible || !args.isCommitted) {
    return clearStreakMetadata(args.streak);
  }

  const activated = activateStreakMetadata(args.streak, args.endDateISO, nowISO);
  if (
    !args.completionSatisfied ||
    !activated.activatedAtISO ||
    !activated.dueAtISO ||
    activated.completedAtISO ||
    !isOnOrBeforeDueAt(nowISO, activated.dueAtISO)
  ) {
    return activated;
  }

  return completeStreakMetadata(activated, nowISO);
}

export function getStreakProgressSnapshot(entry: StreakProgressEntryLike): StreakProgressSnapshot {
  const id = String(entry.id ?? "").trim();
  const streak = normalizeStreakState(entry.streak);
  const workflowStatus = normalizeEntryStatus(entry as EntryStateLike);
  const committed = hasCommittedMilestone(entry);
  const endDateISO = typeof entry.endDate === "string" ? entry.endDate.trim() : "";
  // Canonical streak rule:
  // - Activated: committed draft milestone reached and not yet approved.
  // - Win: committed draft milestone that has been approved.
  const isWin = committed && workflowStatus === "APPROVED";
  const isActivated = committed && !isWin;
  const isCompleted = committed;
  const dueAtISO = committed ? streak.dueAtISO ?? (endDateISO ? computeDueAtISO(endDateISO) : null) : null;

  return {
    id,
    isActivated,
    isCompleted,
    isWin,
    hasActivatedAt: !!streak.activatedAtISO,
    hasCompletedAt: !!streak.completedAtISO,
    dueAtISO,
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

export function computeCanonicalStreakSnapshot(
  entries: ReadonlyArray<StreakProgressAggregateEntry>
): CanonicalStreakSnapshot {
  const aggregate = computeStreakProgressAggregate(entries);
  return {
    ruleVersion: STREAK_RULE_VERSION,
    streakActivatedCount: aggregate.activatedCount,
    streakWinsCount: aggregate.winsCount,
    byCategory: CATEGORY_KEYS.reduce<StreakProgressAggregateByCategory>((next, categoryKey) => {
      next[categoryKey] = {
        activated: aggregate.byCategory[categoryKey].activated,
        wins: aggregate.byCategory[categoryKey].wins,
      };
      return next;
    }, {} as StreakProgressAggregateByCategory),
    activeEntries: aggregate.activatedEntries.slice(),
  };
}
