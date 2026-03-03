import {
  addDaysISO,
  endOfDayIST,
  getEditLockState,
  isFutureDatedEntry,
  normalizeStreakState,
} from "../gamification.ts";

export type EntryDisplayCategory = "draft" | "streak_active" | "completed" | "generic";
export type EntryTagColor = "default" | "yellow" | "red" | "expired";

type LifecycleEntry = {
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  streak?: unknown;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTime(value?: string | null) {
  if (!value) return Number.NaN;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

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

export function getEntryCategory(entry: LifecycleEntry): EntryDisplayCategory {
  const futureDated = isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "");
  const streak = normalizeStreakState(entry.streak);

  if (!futureDated) return "generic";
  if (streak.completedAtISO) return "completed";
  if (streak.activatedAtISO) return "streak_active";
  return "draft";
}

export function getEntryTag(category: EntryDisplayCategory, index: number) {
  const prefix =
    category === "draft"
      ? "D"
      : category === "streak_active"
        ? "P"
        : category === "completed"
          ? "C"
          : "G";

  return `${prefix}${index + 1}`;
}

export function isEditableNow(entry: LifecycleEntry) {
  return !getEditLockState(entry).isLocked;
}

export function groupEntriesByLifecycle<T extends LifecycleEntry>(entries: T[]) {
  const sorted = entries
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((left, right) => {
      const leftCreated = parseTime(left.entry.createdAt);
      const rightCreated = parseTime(right.entry.createdAt);

      if (!Number.isNaN(leftCreated) && !Number.isNaN(rightCreated) && leftCreated !== rightCreated) {
        return leftCreated - rightCreated;
      }

      const leftUpdated = parseTime(left.entry.updatedAt);
      const rightUpdated = parseTime(right.entry.updatedAt);

      if (!Number.isNaN(leftUpdated) && !Number.isNaN(rightUpdated) && leftUpdated !== rightUpdated) {
        return leftUpdated - rightUpdated;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ entry }) => entry);

  return {
    drafts: sorted.filter((entry) => getEntryCategory(entry) === "draft"),
    pending: sorted.filter((entry) => getEntryCategory(entry) === "streak_active"),
    completed: sorted.filter((entry) => getEntryCategory(entry) === "completed"),
    nonStreak: sorted.filter((entry) => getEntryCategory(entry) === "generic"),
  };
}
