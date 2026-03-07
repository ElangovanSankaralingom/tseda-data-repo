import {
  getEditTimeRemaining,
  isEntryCommitted,
  isEntryEditable,
  isEntryFinalized,
  normalizeEntryStatus,
  type EditTimeRemaining,
  type EntryStateLike,
} from "./entries/stateMachine.ts";

export type EntryCategoryBucket = "draft" | "activated" | "completed";
export type EntryDisplayCategory = "draft" | "streak_active" | "completed";
export type EntryCompletionState = "draft" | "completed";
export type EntryStreakState = "none" | "activated" | "completed";
export type StreakIconVariant = "none" | "activated" | "completed" | "genericPast";

export type CategorizableEntry = {
  completionState?: string | null;
  streakState?: string | null;
  confirmationStatus?: string | null;
  committedAtISO?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  streak?: unknown;
};

function parseTimestamp(value?: string | null) {
  if (!value) return Number.NaN;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

function normalizeTextValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function isEntryCompleted(entry: CategorizableEntry): boolean {
  const explicitState = normalizeTextValue(entry.completionState);
  if (explicitState === "completed") return true;
  return isEntryCommitted(entry as EntryStateLike);
}

export function isStreakCompleted(entry: CategorizableEntry): boolean {
  const explicitState = normalizeTextValue(entry.streakState);
  if (explicitState === "completed") return true;
  const explicitCompletion = normalizeTextValue(entry.completionState);
  if (explicitCompletion === "completed") return true;
  return false;
}

export function isStreakActivated(entry: CategorizableEntry): boolean {
  if (isStreakCompleted(entry)) return false;

  const explicitState = normalizeTextValue(entry.streakState);
  if (explicitState === "activated") return true;
  if (explicitState === "none") return false;

  return isEntryCommitted(entry as EntryStateLike);
}

export function getEntryCompletionState(entry: CategorizableEntry): EntryCompletionState {
  return isEntryCompleted(entry) ? "completed" : "draft";
}

export function getEntryStreakDisplayState(entry: CategorizableEntry): EntryStreakState {
  if (isStreakCompleted(entry)) return "completed";
  if (isStreakActivated(entry)) return "activated";
  return "none";
}

export function getStreakIconVariant(entry: CategorizableEntry): StreakIconVariant {
  const streakState = getEntryStreakDisplayState(entry);
  if (streakState === "completed") return "completed";
  if (streakState === "activated") return "activated";
  return "none";
}

export function getEntryBucket(entry: CategorizableEntry): EntryCategoryBucket {
  if (isStreakCompleted(entry)) return "completed";
  if (isStreakActivated(entry)) return "activated";
  if (isEntryCompleted(entry)) return "completed";
  return "draft";
}

export function getEntryCategory(entry: CategorizableEntry): EntryDisplayCategory {
  const bucket = getEntryBucket(entry);
  if (bucket === "activated") return "streak_active";
  return bucket;
}

export function groupEntries<T extends CategorizableEntry>(
  entries: T[],
  opts?: { sort?: "newest" }
): { draft: T[]; activated: T[]; completed: T[] } {
  const sortMode = opts?.sort ?? "newest";

  const sorted = entries
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((left, right) => {
      if (sortMode === "newest") {
        const leftUpdated = parseTimestamp(left.entry.updatedAt);
        const rightUpdated = parseTimestamp(right.entry.updatedAt);

        if (!Number.isNaN(leftUpdated) && !Number.isNaN(rightUpdated) && leftUpdated !== rightUpdated) {
          return rightUpdated - leftUpdated;
        }

        const leftCreated = parseTimestamp(left.entry.createdAt);
        const rightCreated = parseTimestamp(right.entry.createdAt);

        if (!Number.isNaN(leftCreated) && !Number.isNaN(rightCreated) && leftCreated !== rightCreated) {
          return rightCreated - leftCreated;
        }
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ entry }) => entry);

  return {
    draft: sorted.filter((entry) => getEntryBucket(entry) === "draft"),
    activated: sorted.filter((entry) => getEntryBucket(entry) === "activated"),
    completed: sorted.filter((entry) => getEntryBucket(entry) === "completed"),
  };
}

// --- Smart 6-group list system ---

export type EntryListGroup =
  | "streak_runners"
  | "on_the_clock"
  | "unlocked"
  | "in_the_works"
  | "under_review"
  | "locked_in";

export const ENTRY_LIST_GROUP_ORDER: EntryListGroup[] = [
  "streak_runners",
  "on_the_clock",
  "unlocked",
  "in_the_works",
  "under_review",
  "locked_in",
];

export type ListGroupedEntries<T> = Record<EntryListGroup, T[]>;

export function getEntryListGroup(entry: CategorizableEntry): EntryListGroup {
  const stateLike = entry as EntryStateLike;
  const status = normalizeEntryStatus(stateLike);

  if (status === "DRAFT") return "in_the_works";
  if (status === "EDIT_REQUESTED") return "under_review";
  if (status === "EDIT_GRANTED") return "unlocked";

  // GENERATED — finalized or editable?
  if (isEntryFinalized(stateLike)) return "locked_in";

  // Editable GENERATED — check streak eligibility
  if (isStreakActivated(entry)) return "streak_runners";
  return "on_the_clock";
}

/** Get edit time info for entries with edit windows. */
export function getEntryEditTime(entry: CategorizableEntry): EditTimeRemaining {
  return getEditTimeRemaining(entry as EntryStateLike);
}

/** Sort entries by urgency: entries expiring soonest first. */
function sortByUrgency<T extends CategorizableEntry>(entries: T[]): T[] {
  return entries.sort((a, b) => {
    const aTime = getEditTimeRemaining(a as EntryStateLike);
    const bTime = getEditTimeRemaining(b as EntryStateLike);
    // Entries with edit windows first, expiring soonest at top
    if (aTime.hasEditWindow && bTime.hasEditWindow) {
      return aTime.remainingMs - bTime.remainingMs;
    }
    if (aTime.hasEditWindow) return -1;
    if (bTime.hasEditWindow) return 1;
    // Fall back to newest first
    const aUpdated = parseTimestamp(a.updatedAt);
    const bUpdated = parseTimestamp(b.updatedAt);
    if (!Number.isNaN(aUpdated) && !Number.isNaN(bUpdated)) {
      return bUpdated - aUpdated;
    }
    return 0;
  });
}

export function groupEntriesForList<T extends CategorizableEntry>(
  entries: T[]
): ListGroupedEntries<T> {
  const groups: ListGroupedEntries<T> = {
    streak_runners: [],
    on_the_clock: [],
    unlocked: [],
    in_the_works: [],
    under_review: [],
    locked_in: [],
  };

  for (const entry of entries) {
    groups[getEntryListGroup(entry)].push(entry);
  }

  // Sort each group by urgency
  for (const key of ENTRY_LIST_GROUP_ORDER) {
    groups[key] = sortByUrgency(groups[key]);
  }

  return groups;
}

/** Check if an entry is editable (for action button decisions). */
export function isEntryCurrentlyEditable(entry: CategorizableEntry): boolean {
  return isEntryEditable(entry as EntryStateLike);
}
