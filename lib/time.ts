const IST_OFFSET_MINUTES = 5.5 * 60;

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toUTCDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00Z`);
}

function parseDateParts(dateISO: string) {
  const match = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
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

function toISTDateTime(dateISO: string, hours: number, minutes: number, seconds = 0, ms = 0) {
  const parts = parseDateParts(dateISO);
  if (!parts) return null;

  const utcMs =
    Date.UTC(parts.year, parts.month - 1, parts.day, hours, minutes, seconds, ms) -
    IST_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMs).toISOString();
}

export function nowISTDateISO() {
  return formatISTDate(new Date());
}

export function nowISTTimestampISO() {
  return new Date().toISOString();
}

export function addDaysISO(dateISO: string, days: number) {
  if (!isISODate(dateISO)) return dateISO;

  const date = toUTCDate(dateISO);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISTDate(date);
}

export function addDaysIST(dateISO: string, days: number) {
  return addDaysISO(dateISO, days);
}

export function endOfDayIST(dateISO: string) {
  if (!isISODate(dateISO)) return null;
  return toISTDateTime(dateISO, 23, 59, 59, 999);
}
