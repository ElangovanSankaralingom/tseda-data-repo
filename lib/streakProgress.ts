/**
 * Canonical business-progress / streak rule layer.
 *
 * Ownership:
 * - activated / win counting lives here
 * - streak eligibility checking lives here
 * - cache/snapshot readers may consume this output, but must not redefine it
 *
 * Rules:
 * - streakActivated: eligible generated entries that are NOT yet fully complete (in-progress)
 * - streakWins: eligible generated entries that ARE fully complete (all fields filled)
 * - activated and wins are mutually exclusive — an entry is either one or the other
 * - streakActivated + streakWins = total eligible generated entries
 * - An entry is streak-eligible ONLY if its endDate was in the future at Generate time
 * - Eligibility is checked once at Generate time and stored as streakEligible: true
 * - Both are lifetime counters computed from actual entry data
 * - No daily streaks, no time windows, no consecutive days
 */
import { ENTRY_SCHEMAS } from "@/data/schemas";
import type { SchemaFieldDefinition } from "@/data/schemas/types";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeStreakState, type StreakState } from "@/lib/streakState";
import { nowISTDateISO } from "@/lib/time";

export const STREAK_RULE_VERSION = 4;

/** All categories use "endDate" as the end date field. */
const END_DATE_FIELD = "endDate";

export type StreakProgressEntryLike = {
  id?: unknown;
  status?: unknown;
  confirmationStatus?: unknown;
  committedAtISO?: unknown;
  streakEligible?: unknown;
  streak?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
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

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

// --- Streak eligibility ---

/**
 * Returns the end date field name for a given category.
 * All categories currently use "endDate".
 */
export function getEndDateField(_category?: CategoryKey): string {
  return END_DATE_FIELD;
}

/**
 * Check if an entry's end date is in the future (after today in IST).
 * Called at Generate time to determine the streakEligible flag value.
 */
export function checkStreakEligibility(entry: StreakProgressEntryLike): boolean {
  const endDate = entry[END_DATE_FIELD];
  if (typeof endDate !== "string") return false;
  const trimmed = endDate.trim();
  if (!isISODate(trimmed)) return false;

  const todayIST = nowISTDateISO();
  return trimmed > todayIST;
}

/**
 * Returns true if the entry has been marked as streak-eligible.
 * Entries without the flag (e.g., pre-migration entries) are treated as not eligible.
 */
export function isEntryStreakEligible(entry: StreakProgressEntryLike): boolean {
  return entry.streakEligible === true;
}

// --- Core streak rules ---

/**
 * An entry is "activated" if it is streak-eligible AND has been generated (committedAtISO set).
 */
export function isEntryActivated(entry: StreakProgressEntryLike): boolean {
  return isEntryStreakEligible(entry) && !!toOptionalISO(entry.committedAtISO);
}

/**
 * Check if a single schema field has a non-empty value in the entry.
 */
function isFieldFilled(entry: StreakProgressEntryLike, field: SchemaFieldDefinition): boolean {
  const key = field.key;

  // Support dotted keys like "uploads.permissionLetter"
  const parts = key.split(".");
  let value: unknown = entry;
  for (const part of parts) {
    if (!value || typeof value !== "object") return false;
    value = (value as Record<string, unknown>)[part];
  }

  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * An entry is "won" if it is activated AND every user-facing schema field
 * (exportable !== false) has a non-empty value.
 */
export function isEntryWon(
  entry: StreakProgressEntryLike,
  fields: readonly SchemaFieldDefinition[]
): boolean {
  if (!isEntryActivated(entry)) return false;

  const userFields = fields.filter((f) => f.exportable !== false);
  return userFields.every((field) => isFieldFilled(entry, field));
}

// --- Backward-compat per-entry snapshot (without schema) ---

/**
 * Per-entry snapshot without schema context.
 * isWin is always false here — use isEntryWon() with schema for accurate win detection.
 * isActivated checks streakEligible AND committedAtISO.
 */
export function getStreakProgressSnapshot(entry: StreakProgressEntryLike): StreakProgressSnapshot {
  const id = String(entry.id ?? "").trim();
  const streak = normalizeStreakState(entry.streak);
  const activated = isEntryActivated(entry);

  return {
    id,
    isActivated: activated,
    isCompleted: activated,
    isWin: false,
    hasActivatedAt: !!streak.activatedAtISO,
    hasCompletedAt: !!streak.completedAtISO,
    dueAtISO: null,
    sortAtISO: toStreakSortAtISO(entry),
  };
}

// --- Deprecated streak metadata (kept for API route compat) ---

export function clearStreakMetadata(streakValue: unknown): StreakState {
  const streak = normalizeStreakState(streakValue);
  return {
    ...streak,
    activatedAtISO: null,
    dueAtISO: null,
    completedAtISO: null,
  };
}

/**
 * @deprecated Streak metadata is no longer used for counting.
 * Kept for backward compatibility with API routes that store streak on entries.
 */
export function buildCanonicalStreakMetadata(_args: BuildCanonicalStreakMetadataArgs): StreakState {
  return {
    activatedAtISO: null,
    dueAtISO: null,
    completedAtISO: null,
    windowDays: 0,
  };
}

// --- Aggregation ---

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

function getSchemaFields(categoryKey: CategoryKey): readonly SchemaFieldDefinition[] {
  const schema = ENTRY_SCHEMAS[categoryKey];
  return schema?.fields ?? [];
}

export function computeStreakProgressAggregate(
  entries: ReadonlyArray<StreakProgressAggregateEntry>
): StreakProgressAggregate {
  const summary = createEmptyStreakProgressAggregate();

  for (const entry of entries) {
    const categoryKey = entry.categoryKey;
    if (!CATEGORY_KEYS.includes(categoryKey)) continue;

    if (!isEntryActivated(entry)) continue;

    const fields = getSchemaFields(categoryKey);
    const won = isEntryWon(entry, fields);

    if (won) {
      // Won entries count as wins only — not activated
      summary.winsCount += 1;
      summary.byCategory[categoryKey].wins += 1;
    } else {
      // Activated but not yet won — in-progress eligible entries
      summary.activatedCount += 1;
      summary.byCategory[categoryKey].activated += 1;
    }

    const id = String(entry.id ?? "").trim();
    if (id) {
      summary.activatedEntries.push({
        id,
        categoryKey,
        dueAtISO: null,
        sortAtISO: toStreakSortAtISO(entry),
      });
    }
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
