/**
 * Canonical business-progress / streak rule layer.
 *
 * Ownership:
 * - activated / win counting lives here
 * - streak eligibility checking lives here
 * - cache/snapshot readers may consume this output, but must not redefine it
 *
 * Two counters (mutually exclusive):
 * - **Activated** = streak-eligible + GENERATED + pdfGenerated + not finalized + not permanently removed
 * - **Wins** = streak-eligible + all mandatory fields + valid PDF + finalized + not permanently removed
 * An entry is in ONE counter or NEITHER, never both.
 *
 * Two primary checkpoints:
 * 1. Generate PDF — the gate to Activated (checks end date, sets pdfGenerated)
 * 2. Finalise — the gate to Wins (checks mandatory fields + valid PDF + finalized)
 *
 * Exception: end date → past on save = immediate removal from Activated (recoverable).
 * Permanent removal: edit/delete request on a Win, or archive/restore.
 */
import { ENTRY_SCHEMAS } from "@/data/schemas";
import type { SchemaFieldDefinition } from "@/data/schemas/types";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { isEntryFinalized, normalizeEntryStatus } from "@/lib/entries/workflow";
import { normalizeStreakState, type StreakState } from "@/lib/streakState";
import { nowISTDateISO } from "@/lib/time";

export const STREAK_RULE_VERSION = 5;

/** All categories use "endDate" as the end date field. */
const END_DATE_FIELD = "endDate";

export type StreakProgressEntryLike = {
  id?: unknown;
  status?: unknown;
  confirmationStatus?: unknown;
  generatedAt?: unknown;
  committedAtISO?: unknown;
  streakEligible?: unknown;
  streakPermanentlyRemoved?: unknown;
  pdfGenerated?: unknown;
  pdfGeneratedAt?: unknown;
  pdfStale?: unknown;
  streak?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  editWindowExpiresAt?: unknown;
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
  eligibleCount: number;
  byCategory: StreakProgressAggregateByCategory;
  activatedEntries: StreakActiveEntry[];
};

export type CanonicalStreakSnapshot = {
  ruleVersion: number;
  streakActivatedCount: number;
  streakWinsCount: number;
  streakEligibleCount: number;
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

/**
 * Derives a sort-order ISO timestamp for a streak entry.
 * Prefers `updatedAt`; falls back to `createdAt`.
 *
 * @param entry - The entry to extract a sort timestamp from.
 * @returns The ISO timestamp string used for ordering, or `null` if neither field is a valid date string.
 */
export function toStreakSortAtISO(entry: StreakProgressEntryLike): string | null {
  return toOptionalISO(entry.updatedAt) ?? toOptionalISO(entry.createdAt);
}

function toSortTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

/**
 * Comparator for sorting streak entries by their sort-at ISO timestamps (ascending).
 * Entries with missing or invalid timestamps are pushed to the end.
 *
 * @param left - The first ISO timestamp (or null/undefined).
 * @param right - The second ISO timestamp (or null/undefined).
 * @returns A negative number if `left` is earlier, positive if later, or 0 if equal.
 */
export function compareStreakSortAtISO(left: string | null | undefined, right: string | null | undefined) {
  return toSortTime(left) - toSortTime(right);
}

// --- Streak eligibility ---

/**
 * Returns the end date field name for a given category.
 * All categories currently use "endDate".
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getEndDateField(_category?: CategoryKey): string {
  return END_DATE_FIELD;
}

/**
 * Check if an entry's end date is in the future (after today in IST).
 * Called at Generate PDF time and on end date save to determine streak eligibility.
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
 */
export function isEntryStreakEligible(entry: StreakProgressEntryLike): boolean {
  return entry.streakEligible === true;
}

/**
 * Returns true if the entry has been permanently removed from streaks.
 * This happens when: a Win entry gets an edit/delete request, or an entry is archived/restored.
 */
export function isStreakPermanentlyRemoved(entry: StreakProgressEntryLike): boolean {
  return entry.streakPermanentlyRemoved === true;
}

/**
 * Check if an entry has a generated PDF.
 * Accepts both the canonical `pdfGenerated` flag and the legacy `pdfGeneratedAt` timestamp
 * for backward compatibility with entries created before `pdfGenerated` was introduced.
 */
function hasPdfGenerated(entry: StreakProgressEntryLike): boolean {
  if (entry.pdfGenerated === true) return true;
  // Fallback: if pdfGeneratedAt is a non-empty string, treat as generated
  if (typeof entry.pdfGeneratedAt === "string" && entry.pdfGeneratedAt.trim()) return true;
  return false;
}

// --- Core streak rules ---

/**
 * An entry is "activated" when:
 * - streak-eligible (streakEligible === true)
 * - NOT disqualified (streakPermanentlyRemoved !== true)
 * - Status is GENERATED (not DRAFT, not ARCHIVED)
 * - PDF has been generated (pdfGenerated === true)
 * - Entry is NOT finalized (timer still running)
 */
export function isEntryActivated(entry: StreakProgressEntryLike): boolean {
  if (!isEntryStreakEligible(entry)) return false;
  if (isStreakPermanentlyRemoved(entry)) return false;

  const status = normalizeEntryStatus(entry);
  if (status === "DRAFT" || status === "ARCHIVED") return false;

  // Must have generated a PDF
  if (!hasPdfGenerated(entry)) return false;

  // Must NOT be finalized
  if (isEntryFinalized(entry)) return false;

  return true;
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
 * An entry is a "win" when:
 * - streak-eligible (streakEligible === true)
 * - NOT disqualified
 * - All mandatory fields complete
 * - Valid (non-stale) PDF exists
 * - Entry is finalized (timer expired OR manually finalised)
 */
export function isEntryWon(
  entry: StreakProgressEntryLike,
  fields: readonly SchemaFieldDefinition[]
): boolean {
  if (!isEntryStreakEligible(entry)) return false;
  if (isStreakPermanentlyRemoved(entry)) return false;

  // Must be finalized
  if (!isEntryFinalized(entry)) return false;

  // Must have a valid (non-stale) PDF
  if (!hasPdfGenerated(entry)) return false;
  if (entry.pdfStale === true) return false;

  // All user-facing (exportable) DATA fields must be filled — NOT file uploads
  const userDataFields = fields.filter((f) => f.exportable !== false && f.upload !== true);
  return userDataFields.every((field) => isFieldFilled(entry, field));
}

// --- Backward-compat per-entry snapshot (without schema) ---

/**
 * Per-entry snapshot without schema context.
 * isWin is always false here — use isEntryWon() with schema for accurate win detection.
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

/**
 * Resets the timing-related streak metadata fields to `null`, preserving other streak state.
 * Used when an entry loses streak eligibility or is permanently removed.
 *
 * @param streakValue - The raw streak state value from the entry (normalized internally).
 * @returns A new `StreakState` with `activatedAtISO`, `dueAtISO`, and `completedAtISO` cleared.
 */
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildCanonicalStreakMetadata(_args: BuildCanonicalStreakMetadataArgs): StreakState {
  return {
    activatedAtISO: null,
    dueAtISO: null,
    completedAtISO: null,
    windowDays: 0,
  };
}

// --- Aggregation ---

/**
 * Returns a new array of active streak entries sorted in ascending order by their sort-at timestamps.
 * Does not mutate the input array.
 *
 * @param entries - The active streak entries to sort.
 * @returns A sorted copy of the entries array.
 */
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

/**
 * Creates a zeroed-out streak progress aggregate with empty counters for every category.
 * Used as the initial accumulator before iterating over entries.
 *
 * @returns A `StreakProgressAggregate` with all counts at zero and an empty active entries list.
 */
export function createEmptyStreakProgressAggregate(): StreakProgressAggregate {
  return {
    activatedCount: 0,
    winsCount: 0,
    eligibleCount: 0,
    byCategory: emptyAggregateByCategory(),
    activatedEntries: [],
  };
}

function getSchemaFields(categoryKey: CategoryKey): readonly SchemaFieldDefinition[] {
  const schema = ENTRY_SCHEMAS[categoryKey];
  return schema?.fields ?? [];
}

/**
 * Compute streak counters from a flat list of entries.
 *
 * Rules (per spec):
 * - Skip ARCHIVED, DRAFT, and disqualified entries
 * - Eligible = streakEligible === true
 * - Activated = eligible + pdfGenerated + not finalized
 * - Won = eligible + pdfGenerated + not stale + all fields complete + finalized
 */
export function computeStreakProgressAggregate(
  entries: ReadonlyArray<StreakProgressAggregateEntry>
): StreakProgressAggregate {
  const summary = createEmptyStreakProgressAggregate();

  for (const entry of entries) {
    const categoryKey = entry.categoryKey;
    if (!CATEGORY_KEYS.includes(categoryKey)) continue;

    const status = normalizeEntryStatus(entry);
    if (status === "ARCHIVED" || status === "DRAFT") continue;
    if (isStreakPermanentlyRemoved(entry)) continue;
    if (!isEntryStreakEligible(entry)) continue;

    summary.eligibleCount += 1;

    // Must have generated a PDF to be in either counter
    if (!hasPdfGenerated(entry)) continue;

    const finalized = isEntryFinalized(entry);
    const fields = getSchemaFields(categoryKey);

    if (finalized) {
      // Win check: complete mandatory DATA fields (NOT file uploads) + valid (non-stale) PDF
      const userDataFields = fields.filter((f) => f.exportable !== false && f.upload !== true);
      const complete = userDataFields.every((field) => isFieldFilled(entry, field));
      const validPdf = entry.pdfStale !== true;

      if (complete && validPdf) {
        summary.winsCount += 1;
        summary.byCategory[categoryKey].wins += 1;
      }
      // If finalized but not complete or stale PDF: not in either counter
    } else {
      // Not finalized + has PDF = Activated
      summary.activatedCount += 1;
      summary.byCategory[categoryKey].activated += 1;
    }

    const id = String(entry.id ?? "").trim();
    if (id && !finalized) {
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

/**
 * Computes the canonical streak snapshot from a flat list of entries.
 * Wraps {@link computeStreakProgressAggregate} and stamps the result with the current rule version.
 * This is the top-level function consumed by cache writers and API responses.
 *
 * @param entries - All entries (across categories) to evaluate.
 * @returns A versioned `CanonicalStreakSnapshot` with activated, wins, and eligible counts plus per-category breakdowns.
 */
export function computeCanonicalStreakSnapshot(
  entries: ReadonlyArray<StreakProgressAggregateEntry>
): CanonicalStreakSnapshot {
  const aggregate = computeStreakProgressAggregate(entries);
  return {
    ruleVersion: STREAK_RULE_VERSION,
    streakActivatedCount: aggregate.activatedCount,
    streakWinsCount: aggregate.winsCount,
    streakEligibleCount: aggregate.eligibleCount,
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
