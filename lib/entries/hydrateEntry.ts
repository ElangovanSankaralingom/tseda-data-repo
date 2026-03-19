/**
 * Universal entry hydration — ensures old entries with missing/removed fields
 * don't crash the app. Applied in every adapter's hydrateEntry function.
 *
 * Rules:
 * - Missing string fields → ""
 * - Missing number fields → null
 * - Missing array fields → []
 * - Single FileMeta object where array expected → [fileMeta]
 * - null where array expected → []
 * - Missing object fields (coordinator, streak) → safe defaults
 * - Old fields are preserved (won't crash, just ignored by UI)
 */

import type { FileMeta } from "@/lib/types/entry";

type FacultyRowValue = { name: string; email: string };

type StreakDefaults = { activatedAtISO: string | null; dueAtISO: string | null; completedAtISO: string | null; windowDays: number };
const EMPTY_STREAK: StreakDefaults = { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 };

/** Ensure a value is a FileMeta array */
export function ensureFileMetaArray(value: unknown): FileMeta[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && "storedPath" in (value as Record<string, unknown>)) {
    return [value as FileMeta];
  }
  return [];
}

/** Ensure a value is a FacultyRowValue array */
export function ensureFacultyArray(value: unknown): FacultyRowValue[] {
  if (Array.isArray(value)) return value;
  return [];
}

/** Ensure a value is a FacultyRowValue */
export function ensureFaculty(value: unknown): FacultyRowValue {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return {
      name: typeof v.name === "string" ? v.name : "",
      email: typeof v.email === "string" ? v.email : "",
    };
  }
  return { name: "", email: "" };
}

/** Ensure streak state */
export function ensureStreak(value: unknown): StreakDefaults {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return {
      activatedAtISO: typeof v.activatedAtISO === "string" ? v.activatedAtISO : null,
      dueAtISO: typeof v.dueAtISO === "string" ? v.dueAtISO : null,
      completedAtISO: typeof v.completedAtISO === "string" ? v.completedAtISO : null,
      windowDays: typeof v.windowDays === "number" ? v.windowDays : 5,
    };
  }
  return { ...EMPTY_STREAK };
}

/** Safe string — returns "" if not a string */
export function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Safe number — returns null if not a number */
export function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Safe boolean-like string (Yes/No) */
export function safeBoolString(value: unknown): string {
  if (value === "Yes" || value === "No") return value;
  return "";
}

/**
 * Extract uploads from nested uploads record (guest-lectures, workshops pattern)
 * Falls back to top-level fields if nested doesn't exist.
 */
export function extractNestedUpload(entry: Record<string, unknown>, slot: string): FileMeta[] {
  const uploads = entry.uploads as Record<string, unknown> | undefined;
  if (uploads && typeof uploads === "object") {
    const nested = uploads[slot];
    return ensureFileMetaArray(nested);
  }
  return ensureFileMetaArray(entry[slot]);
}
