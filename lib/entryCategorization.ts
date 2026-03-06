import { normalizeStreakState } from "./gamification.ts";
import { isEntryCommitted, type EntryStateLike } from "./entries/stateMachine.ts";

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
  return !!normalizeStreakState(entry.streak).completedAtISO;
}

export function isStreakActivated(entry: CategorizableEntry): boolean {
  if (isStreakCompleted(entry)) return false;

  const explicitState = normalizeTextValue(entry.streakState);
  if (explicitState === "activated") return true;
  if (explicitState === "none") return false;

  return !!normalizeStreakState(entry.streak).activatedAtISO;
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
  if (isEntryCompleted(entry)) return "completed";
  if (isStreakActivated(entry)) return "activated";
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
