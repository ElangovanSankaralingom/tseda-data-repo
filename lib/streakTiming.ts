import { addDaysISO, endOfDayIST, nowISTDateISO } from "@/lib/time";

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

export function isOverdue(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return false;
  return new Date(dueAtISO).getTime() < Date.now();
}
