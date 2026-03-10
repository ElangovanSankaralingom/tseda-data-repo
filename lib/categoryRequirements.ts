import type { CategoryKey } from "@/lib/entries/types";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import { areRequiredForCommitComplete } from "@/lib/validation/schemaValidator";

function isNonEmptyString(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function hasFacultyRows(value: unknown, { requireAtLeastOne = false, requireLocked = false } = {}) {
  if (!Array.isArray(value)) {
    return false;
  }

  if (requireAtLeastOne && value.length === 0) {
    return false;
  }

  return value.every((row) => {
    const item = (row ?? {}) as { email?: unknown; isLocked?: unknown };
    return isNonEmptyString(item.email) && (!requireLocked || item.isLocked === true);
  });
}

function hasOptionalFacultyRows(value: unknown, { requireLocked = false } = {}) {
  if (!Array.isArray(value)) {
    return true;
  }

  const populatedRows = value.filter((row) => {
    const item = (row ?? {}) as { email?: unknown; name?: unknown };
    return isNonEmptyString(item.email) || isNonEmptyString(item.name);
  });

  if (populatedRows.length === 0) {
    return true;
  }

  return hasFacultyRows(populatedRows, { requireLocked });
}

/**
 * Category-specific additional checks beyond schema-driven validation.
 * These handle relational constraints (faculty rows, locked status) that
 * the schema can't express.
 */
const CATEGORY_EXTRA_CHECKS: Partial<
  Record<CategoryKey, (entry: Record<string, unknown>) => boolean>
> = {
  "fdp-conducted": (entry) =>
    hasOptionalFacultyRows(entry.coCoordinators, { requireLocked: true }),
  "case-studies": (entry) =>
    hasFacultyRows(entry.staffAccompanying, { requireAtLeastOne: true, requireLocked: true }),
  workshops: (entry) =>
    hasFacultyRows(entry.coCoordinators),
};

export function validatePreUploadFields(category: CategoryKey, entry: Record<string, unknown>) {
  const normalized = withAcademicProgressionCompatibility(entry);

  // Schema-driven base check
  if (!areRequiredForCommitComplete(category, normalized)) {
    return false;
  }

  // Category-specific relational checks
  const extraCheck = CATEGORY_EXTRA_CHECKS[category];
  if (extraCheck && !extraCheck(normalized)) {
    return false;
  }

  return true;
}
