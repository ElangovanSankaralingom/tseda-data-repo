import { computeDueAtISO } from "../gamification.ts";
import { getDaysLeft, getDaysLeftColor } from "../streakDeadline.ts";
import {
  groupEntries,
  type CategorizableEntry,
  type EntryDisplayCategory,
} from "../entryCategorization.ts";

export {
  groupEntries,
  getEntryCategory,
  getEntryCompletionState,
  getEntryStreakDisplayState,
} from "../entryCategorization.ts";
export type {
  EntryDisplayCategory,
  EntryStreakState as EntryStreakDisplayState,
} from "../entryCategorization.ts";

export type EntryTagColor = "default" | "yellow" | "red" | "expired";

type LifecycleEntry = CategorizableEntry;

export function computeCutoffDate(endDateISO?: string | null, isStreak = false) {
  if (!isStreak || !endDateISO) return null;
  return computeDueAtISO(endDateISO);
}

export function computeDaysLeft(cutoffISO?: string | null) {
  return cutoffISO ? getDaysLeft(cutoffISO) : 0;
}

export function getTagColor(daysLeft: number): EntryTagColor {
  const color = getDaysLeftColor(daysLeft);
  return color === "normal" ? "default" : color;
}

export function getEntryTag(category: EntryDisplayCategory, index: number) {
  const prefix = category === "draft" ? "D" : category === "streak_active" ? "P" : "C";

  return `${prefix}${index + 1}`;
}

export function isEditableNow(entry: LifecycleEntry) {
  void entry;
  return true;
}

export function groupEntriesByLifecycle<T extends LifecycleEntry>(entries: T[]) {
  const grouped = groupEntries(entries, { sort: "newest" });
  return {
    drafts: grouped.draft,
    pending: grouped.activated,
    completed: grouped.completed,
  };
}
