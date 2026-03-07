import { normalizeStreakState, type StreakState } from "@/lib/streakState";
import { addDaysISO, endOfDayIST, nowISTDateISO } from "@/lib/time";

const DAY_MS = 24 * 60 * 60 * 1000;

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isISODateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function isFutureDatedEntry(startISO: string, endISO: string) {
  if (!isISODate(startISO) || !isISODate(endISO)) return false;

  const todayIST = nowISTDateISO();
  return startISO >= todayIST && endISO >= todayIST;
}

export function computeDueAtISO(endDateISO: string) {
  if (!isISODate(endDateISO)) return null;
  const dueDayISO = addDaysISO(endDateISO, 8);
  return endOfDayIST(dueDayISO);
}

export function remainingDaysFromDueAtISO(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return 0;

  const diff = new Date(dueAtISO).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

export function isWithinDueWindow(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return false;
  return new Date(dueAtISO).getTime() >= Date.now();
}

export function isOverdue(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return false;
  return new Date(dueAtISO).getTime() < Date.now();
}

export function getStreakDisplayStatus(state: StreakState) {
  const normalized = normalizeStreakState(state);
  if (!normalized.activatedAtISO) return "inactive" as const;
  if (normalized.completedAtISO) return "completed" as const;
  if (isWithinDueWindow(normalized.dueAtISO)) return "active" as const;
  return "expired" as const;
}
