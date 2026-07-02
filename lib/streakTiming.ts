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

/**
 * Streak grace deadline: endDate + buffer, end-of-day IST. The default buffer
 * matches DEFAULT_WORKFLOW_CONFIG / the `entries.streakEditBuffer` setting's
 * default; callers that know the live setting should pass it explicitly.
 * NOTE: committed entries carry the authoritative server-computed deadline in
 * `editWindowExpiresAt` — prefer the stored value for display when present.
 */
export function computeDueAtISO(endDateISO: string, bufferDays = 8) {
  if (!isISODate(endDateISO)) return null;
  const dueDayISO = addDaysISO(endDateISO, bufferDays);
  return endOfDayIST(dueDayISO);
}

export function isOverdue(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return false;
  return new Date(dueAtISO).getTime() < Date.now();
}
