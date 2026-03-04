import { isFutureDatedEntry, normalizeStreakState } from "./gamification.ts";

export type EntryGroupKey = "drafts" | "activated" | "completed";
export type EntryDisplayCategory = "draft" | "streak_active" | "completed";
export type EntryCompletionState = "draft" | "completed";
export type EntryStreakState = "none" | "activated" | "completed";

export type CategorizableEntry = {
  completionState?: string | null;
  streakState?: string | null;
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

export function getEntryCompletionState(entry: CategorizableEntry): EntryCompletionState {
  const explicitState = normalizeTextValue(entry.completionState);
  if (explicitState === "completed") return "completed";
  return entry.status === "final" ? "completed" : "draft";
}

export function getEntryStreakDisplayState(entry: CategorizableEntry): EntryStreakState {
  if (!isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "")) {
    return "none";
  }

  const explicitState = normalizeTextValue(entry.streakState);
  if (explicitState === "completed") return "completed";
  if (explicitState === "activated") return "activated";
  if (explicitState === "none") return "none";

  const streak = normalizeStreakState(entry.streak);
  if (streak.completedAtISO) return "completed";
  if (streak.activatedAtISO) return "activated";
  return "none";
}

export function getEntryCategory(entry: CategorizableEntry): EntryDisplayCategory {
  if (getEntryCompletionState(entry) === "completed") return "completed";
  if (getEntryStreakDisplayState(entry) === "activated") return "streak_active";
  return "draft";
}

export function categorizeEntries<T extends CategorizableEntry>(
  entries: T[],
  opts?: { sort?: "newest" }
): { drafts: T[]; activated: T[]; completed: T[] } {
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
    drafts: sorted.filter((entry) => getEntryCategory(entry) === "draft"),
    activated: sorted.filter((entry) => getEntryCategory(entry) === "streak_active"),
    completed: sorted.filter((entry) => getEntryCategory(entry) === "completed"),
  };
}
