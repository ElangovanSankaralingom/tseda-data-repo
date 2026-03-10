import { getCategorySchema } from "@/data/categoryRegistry";
import type { SchemaFieldDefinition } from "@/data/schemas/types";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeYearOfStudy, isSemesterAllowed } from "@/lib/student-academic";
import { ACADEMIC_YEAR_OPTIONS, getAcademicYearRange } from "@/lib/utils/academicYear";
import { isISODate } from "@/lib/utils/dateHelpers";

type ValidationErrors = Record<string, string>;

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim().length === 0) return true;
  return false;
}

function getFieldLabel(field: SchemaFieldDefinition): string {
  return field.label || field.key;
}

/**
 * Validate an entry against its category schema.
 *
 * Checks `requiredForCommit` fields are present and valid, runs kind-based
 * validation (date format, number range, enum), and common cross-field rules
 * (endDate >= startDate, academic year range, semester-year compatibility).
 *
 * Returns an error map keyed by field key. Empty map = valid.
 */
export function validateEntryFields(
  category: CategoryKey,
  data: Record<string, unknown>,
): ValidationErrors {
  const schema = getCategorySchema(category);
  if (!schema) return {};

  const errors: ValidationErrors = {};
  const requiredKeys = new Set(schema.requiredForCommit ?? []);
  const fieldsByKey = new Map<string, SchemaFieldDefinition>();
  for (const field of schema.fields) {
    fieldsByKey.set(field.key, field);
  }

  // ── Required field presence ─────────────────────────────────────────────
  for (const key of requiredKeys) {
    const field = fieldsByKey.get(key);
    if (!field) continue;
    // Skip upload/stage-2 fields — they're optional for commit
    if (field.upload || field.stage === 2) continue;

    const value = data[key];

    if (key === "academicYear") {
      if (!ACADEMIC_YEAR_OPTIONS.includes(value as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
        errors[key] = "Academic year is required.";
      }
      continue;
    }

    if (key === "yearOfStudy") {
      if (!normalizeYearOfStudy(value as string | undefined)) {
        errors[key] = "Year of study is required.";
      }
      continue;
    }

    if (key === "currentSemester") {
      const normalizedYear = normalizeYearOfStudy(data.yearOfStudy as string | undefined);
      if (normalizedYear && !isSemesterAllowed(normalizedYear, (value as number) ?? undefined)) {
        errors[key] = "Current semester is required.";
      }
      continue;
    }

    if (field.kind === "date") {
      if (!isISODate(value as string)) {
        errors[key] = `${getFieldLabel(field)} is required.`;
      }
      continue;
    }

    if (field.kind === "array") {
      if (!Array.isArray(value) || value.length === 0) {
        errors[key] = `${getFieldLabel(field)} is required.`;
      }
      continue;
    }

    if (isMissing(value)) {
      errors[key] = `${getFieldLabel(field)} is required.`;
    }
  }

  // ── Kind-based validation (on non-missing values) ───────────────────────
  for (const field of schema.fields) {
    if (errors[field.key]) continue; // already has an error
    const value = data[field.key];
    if (isMissing(value)) continue;

    if (field.kind === "number" && typeof value === "number") {
      if (!Number.isFinite(value)) {
        errors[field.key] = `${getFieldLabel(field)} must be a valid number.`;
      } else if (typeof field.min === "number" && value < field.min) {
        errors[field.key] = `${getFieldLabel(field)} must be at least ${field.min}.`;
      } else if (typeof field.max === "number" && value > field.max) {
        errors[field.key] = `${getFieldLabel(field)} must be at most ${field.max}.`;
      }
    }

    if (field.kind === "date" && typeof value === "string" && isISODate(value)) {
      if (field.key === "startDate" && data.academicYear) {
        const range = getAcademicYearRange(data.academicYear as string);
        if (range && (value < range.start || value > range.end)) {
          errors[field.key] = `Starting date must fall within ${data.academicYear} (${range.label}).`;
        }
      }
    }

    if (Array.isArray(field.enumValues) && field.enumValues.length > 0) {
      if (!field.enumValues.includes(value as string | number | boolean)) {
        errors[field.key] = `${getFieldLabel(field)} has an invalid value.`;
      }
    }
  }

  // ── Cross-field: endDate >= startDate ───────────────────────────────────
  if (
    !errors.endDate &&
    !errors.startDate &&
    isISODate(data.startDate as string) &&
    isISODate(data.endDate as string) &&
    String(data.endDate) < String(data.startDate)
  ) {
    errors.endDate = "Ending date must be on or after starting date.";
  }

  // ── Cross-field: supportAmount / amountSupport (optional, but must be valid if present)
  for (const amountKey of ["supportAmount", "amountSupport"]) {
    if (data[amountKey] !== null && data[amountKey] !== undefined && typeof data[amountKey] === "number") {
      if (!Number.isFinite(data[amountKey] as number) || (data[amountKey] as number) < 0) {
        errors[amountKey] = "Invalid amount.";
      }
    }
  }

  return errors;
}

/**
 * Check if all requiredForCommit fields are complete (for the Generate button gate).
 * This replaces the per-category hardcoded checks in categoryRequirements.ts.
 */
export function areRequiredForCommitComplete(
  category: CategoryKey,
  data: Record<string, unknown>,
): boolean {
  const schema = getCategorySchema(category);
  if (!schema?.requiredForCommit) return true;

  for (const key of schema.requiredForCommit) {
    const value = data[key];

    if (key === "academicYear") {
      if (!ACADEMIC_YEAR_OPTIONS.includes(value as (typeof ACADEMIC_YEAR_OPTIONS)[number])) return false;
      continue;
    }
    if (key === "yearOfStudy") {
      if (!normalizeYearOfStudy(value as string | undefined)) return false;
      continue;
    }
    if (key === "currentSemester") {
      const normalizedYear = normalizeYearOfStudy(data.yearOfStudy as string | undefined);
      if (normalizedYear && !isSemesterAllowed(normalizedYear, (value as number) ?? undefined)) return false;
      continue;
    }

    const field = schema.fields.find((f) => f.key === key);
    if (field?.kind === "date") {
      if (!isISODate(value as string)) return false;
      continue;
    }
    if (field?.kind === "array") {
      if (!Array.isArray(value) || value.length === 0) return false;
      continue;
    }
    if (isMissing(value)) return false;
  }

  // Cross-field: valid date range
  if (data.startDate && data.endDate) {
    if (!isISODate(data.startDate as string) || !isISODate(data.endDate as string)) return false;
    if (String(data.endDate) < String(data.startDate)) return false;
  }

  return true;
}
