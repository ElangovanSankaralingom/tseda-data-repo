import { addDaysISO, endOfDayIST, getEditLockState } from "../gamification.ts";
import {
  categorizeEntries,
  type CategorizableEntry,
  type EntryDisplayCategory,
} from "../entryCategorize.ts";

export {
  categorizeEntries,
  getEntryCategory,
  getEntryCompletionState,
  getEntryStreakDisplayState,
} from "../entryCategorize.ts";
export type {
  EntryDisplayCategory,
  EntryStreakState as EntryStreakDisplayState,
} from "../entryCategorize.ts";

export type EntryTagColor = "default" | "yellow" | "red" | "expired";

type LifecycleEntry = CategorizableEntry;
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeCutoffDate(endDateISO?: string | null, isStreak = false) {
  if (!endDateISO) return null;
  const cutoffDayISO = addDaysISO(endDateISO, isStreak ? 8 : 2);
  return endOfDayIST(cutoffDayISO);
}

export function computeDaysLeft(cutoffISO?: string | null) {
  if (!cutoffISO) return 0;
  const cutoffTime = Date.parse(cutoffISO);
  if (Number.isNaN(cutoffTime)) return 0;
  return Math.ceil((cutoffTime - Date.now()) / DAY_MS);
}

export function getTagColor(daysLeft: number): EntryTagColor {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 2) return "red";
  if (daysLeft <= 5) return "yellow";
  return "default";
}

export function getEntryTag(category: EntryDisplayCategory, index: number) {
  const prefix = category === "draft" ? "D" : category === "streak_active" ? "P" : "C";

  return `${prefix}${index + 1}`;
}

export function isEditableNow(entry: LifecycleEntry) {
  return !getEditLockState(entry).isLocked;
}

export function groupEntriesByLifecycle<T extends LifecycleEntry>(entries: T[]) {
  const grouped = categorizeEntries(entries, { sort: "newest" });
  return {
    drafts: grouped.drafts,
    pending: grouped.activated,
    completed: grouped.completed,
  };
}
