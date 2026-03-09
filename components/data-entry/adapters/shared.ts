/**
 * Shared utility functions and constants used across category adapters.
 * Extracted to avoid duplication — each adapter was defining identical copies.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function uuid() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function getAcademicYearRange(academicYear: string) {
  const match = academicYear.match(/^Academic Year (\d{4})-(\d{4})$/);
  if (!match) return null;
  return {
    start: `${match[1]}-07-01`,
    end: `${match[2]}-06-30`,
    label: `Jul 1, ${match[1]} to Jun 30, ${match[2]}`,
  };
}

export function getInclusiveDays(startDate: string, endDate: string) {
  if (!isISODate(startDate) || !isISODate(endDate) || endDate < startDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function formatDisplayDate(value: string) {
  if (!isISODate(value)) return "-";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString();
}

export function formatFacultyDisplay(selection: { name: string; email: string }) {
  return selection.name || selection.email || "";
}

// ── Constants ───────────────────────────────────────────────────────────────

export const ACADEMIC_YEAR_OPTIONS = [
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
] as const;

export const ACADEMIC_YEAR_DROPDOWN_OPTIONS = ACADEMIC_YEAR_OPTIONS.map((option) => ({
  label: option,
  value: option,
}));
