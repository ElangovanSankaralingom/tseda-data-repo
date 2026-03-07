import { addDaysISO, endOfDayIST } from "@/lib/time";

function isISODateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function formatISTDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

export function isWithinRequestEditWindow(
  requestedAtISO: string | null | undefined,
  windowMinutes = 5
) {
  if (!requestedAtISO || !isISODateTime(requestedAtISO)) return false;

  const diffMs = Date.now() - new Date(requestedAtISO).getTime();
  return diffMs >= 0 && diffMs <= windowMinutes * 60 * 1000;
}

export function computeEditableUntilISO(createdAtISO: string) {
  if (!createdAtISO || !isISODateTime(createdAtISO)) return null;

  const createdDateISO = formatISTDate(new Date(createdAtISO));
  const editableDayISO = addDaysISO(createdDateISO, 2);
  return endOfDayIST(editableDayISO);
}
