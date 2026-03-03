// lib/experience.ts
export type ISODate = string; // "YYYY-MM-DD"

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";
export type Designation = "Assistant" | "Senior Assistant" | "Associate" | "Professor";
export type PhdStatus = "Not Enrolled" | "Pursuing" | "Completed";

export type FileMeta = {
  path?: string;
  storedPath?: string;
  url: string;
  fileName: string;
  size: number;
  contentType?: string;
  mimeType?: string;
  uploadedAt: string;
};

export type LOPPeriod = { id: string; startDate: ISODate; endDate: ISODate };

export type OutsideAcademicExp = {
  id: string;
  institution: string;
  startDate: ISODate;
  endDate: ISODate;
  certificate: FileMeta | null; // mandatory before final save
};

export type IndustryExp = {
  id: string;
  organization: string;
  role: string; // mandatory
  startDate: ISODate;
  endDate: ISODate;
  certificate: FileMeta | null; // mandatory before final save
};

export type Experience = {
  lopPeriods: LOPPeriod[];
  academicOutsideTCE: OutsideAcademicExp[];
  industry: IndustryExp[];
};

export type ExperienceTotals = {
  tce: DurationYMD;
  academicOutside: DurationYMD;
  academicTotal: DurationYMD;
  industryTotal: DurationYMD;
  overallTotal: DurationYMD;
};

export type DurationYMD = { years: number; months: number; days: number; totalDays: number };

export function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

function toUTCDate(d: ISODate): Date {
  return new Date(d + "T00:00:00Z");
}

function clampDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function todayISO(): ISODate {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

export function cmpISO(a: ISODate, b: ISODate) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function rangeValid(start: ISODate, end: ISODate) {
  return isISODate(start) && isISODate(end) && cmpISO(start, end) <= 0;
}

export function rangesOverlap(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  return start <= end;
}

export function ensureNoOverlap<T extends { id: string; startDate: ISODate; endDate: ISODate }>(
  items: T[],
  candidate: T
): string | null {
  for (const it of items) {
    if (it.id === candidate.id) continue;
    if (rangesOverlap(it.startDate, it.endDate, candidate.startDate, candidate.endDate)) {
      return "Date range overlaps with an existing entry.";
    }
  }
  return null;
}

export function durationInclusive(start: ISODate, end: ISODate): DurationYMD {
  const s = clampDate(toUTCDate(start));
  const e = clampDate(toUTCDate(end));
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / 86400000) + 1;
  return normalizeDaysToYMD(s, days);
}

function normalizeDaysToYMD(base: Date, totalDays: number): DurationYMD {
  let remaining = totalDays;
  let cursor = new Date(base.getTime());

  let years = 0;
  while (true) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear() + 1, cursor.getUTCMonth(), cursor.getUTCDate()));
    const span = Math.floor((next.getTime() - cursor.getTime()) / 86400000);
    if (span <= remaining) {
      years += 1;
      remaining -= span;
      cursor = next;
    } else {
      break;
    }
  }

  let months = 0;
  while (true) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
    if (next.getUTCMonth() === (cursor.getUTCMonth() + 1) % 12 && next.getUTCDate() !== cursor.getUTCDate()) {
      const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 2, 0));
      const nextAdjusted = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
      const spanAdjusted = Math.floor((nextAdjusted.getTime() - cursor.getTime()) / 86400000);
      if (spanAdjusted <= remaining) {
        months += 1;
        remaining -= spanAdjusted;
        cursor = nextAdjusted;
        continue;
      }
      break;
    }

    const span = Math.floor((next.getTime() - cursor.getTime()) / 86400000);
    if (span <= remaining) {
      months += 1;
      remaining -= span;
      cursor = next;
    } else {
      break;
    }
  }

  const days = remaining;

  return { years, months, days, totalDays };
}

export function addDurations(a: DurationYMD, b: DurationYMD): DurationYMD {
  const base = clampDate(new Date(Date.UTC(2000, 0, 1)));
  const total = a.totalDays + b.totalDays;
  return normalizeDaysToYMD(base, total);
}

export function subtractDays(baseDate: ISODate, totalDays: number, subtractDaysCount: number): DurationYMD {
  const base = clampDate(toUTCDate(baseDate));
  const remain = Math.max(0, totalDays - subtractDaysCount);
  return normalizeDaysToYMD(base, remain);
}

export function sumInclusiveDurations(
  items: Array<{ startDate: ISODate; endDate: ISODate }>
): { totalDays: number } {
  let totalDays = 0;
  for (const it of items) {
    const d = durationInclusive(it.startDate, it.endDate);
    totalDays += d.totalDays;
  }
  return { totalDays };
}

export function computeExperienceTotals(args: {
  dateOfJoiningTCE?: ISODate;
  lopPeriods: LOPPeriod[];
  academicOutsideTCE: OutsideAcademicExp[];
  industry: IndustryExp[];
  today?: ISODate;
}): ExperienceTotals {
  const today = args.today ?? todayISO();

  const baseForTCE = args.dateOfJoiningTCE && isISODate(args.dateOfJoiningTCE) ? args.dateOfJoiningTCE : today;
  const tceRaw = rangeValid(baseForTCE, today) ? durationInclusive(baseForTCE, today) : durationInclusive(today, today);

  const lopSum = sumInclusiveDurations(args.lopPeriods);
  const tceAfterLOP = subtractDays(baseForTCE, tceRaw.totalDays, lopSum.totalDays);

  const outSumDays = sumInclusiveDurations(args.academicOutsideTCE).totalDays;
  const academicOutside = normalizeDaysToYMD(clampDate(new Date(Date.UTC(2000, 0, 1))), outSumDays);

  const indSumDays = sumInclusiveDurations(args.industry).totalDays;
  const industryTotal = normalizeDaysToYMD(clampDate(new Date(Date.UTC(2000, 0, 1))), indSumDays);

  const academicTotal = addDurations(tceAfterLOP, academicOutside);
  const overallTotal = addDurations(academicTotal, industryTotal);

  return {
    tce: tceAfterLOP,
    academicOutside,
    academicTotal,
    industryTotal,
    overallTotal,
  };
}

export function formatYMD(d: DurationYMD) {
  return `${d.years}y ${d.months}m ${d.days}d`;
}

export function uuid() {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
