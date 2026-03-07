import type { CategoryKey } from "@/lib/entries/types";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";

function isNonEmptyString(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function isIsoDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim());
}

function isValidDateRange(startDate: unknown, endDate: unknown) {
  const start = String(startDate ?? "").trim();
  const end = String(endDate ?? "").trim();
  return isIsoDate(start) && isIsoDate(end) && end >= start;
}

function hasSemesterNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
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

function getWorkshopOrganization(entry: Record<string, unknown>) {
  return entry.organizationName ?? entry.organisationName;
}

export const CATEGORY_REQUIREMENTS: Record<
  CategoryKey,
  {
    validatePreUploadRequired: (entry: Record<string, unknown>) => boolean;
  }
> = {
  "fdp-attended": {
    validatePreUploadRequired: (entry) =>
      isNonEmptyString(entry.academicYear) &&
      isNonEmptyString(entry.yearOfStudy) &&
      hasSemesterNumber(entry.currentSemester) &&
      isValidDateRange(entry.startDate, entry.endDate) &&
      isNonEmptyString(entry.programName) &&
      isNonEmptyString(entry.organisingBody),
  },
  "fdp-conducted": {
    validatePreUploadRequired: (entry) =>
      isNonEmptyString(entry.academicYear) &&
      isNonEmptyString(entry.yearOfStudy) &&
      hasSemesterNumber(entry.currentSemester) &&
      isValidDateRange(entry.startDate, entry.endDate) &&
      isNonEmptyString(entry.eventName) &&
      hasOptionalFacultyRows(entry.coCoordinators, { requireLocked: true }),
  },
  "case-studies": {
    validatePreUploadRequired: (entry) =>
      isNonEmptyString(entry.academicYear) &&
      isValidDateRange(entry.startDate, entry.endDate) &&
      isNonEmptyString(entry.placeOfVisit) &&
      isNonEmptyString(entry.purposeOfVisit) &&
      hasFacultyRows(entry.staffAccompanying, { requireAtLeastOne: true, requireLocked: true }) &&
      isNonEmptyString(entry.yearOfStudy) &&
      hasSemesterNumber(entry.currentSemester),
  },
  "guest-lectures": {
    validatePreUploadRequired: (entry) =>
      isNonEmptyString(entry.academicYear) &&
      isValidDateRange(entry.startDate, entry.endDate) &&
      isNonEmptyString(entry.eventName) &&
      isNonEmptyString(entry.speakerName) &&
      isNonEmptyString(entry.organizationName) &&
      isNonEmptyString(entry.yearOfStudy) &&
      hasSemesterNumber(entry.currentSemester),
  },
  workshops: {
    validatePreUploadRequired: (entry) =>
      isNonEmptyString(entry.academicYear) &&
      isNonEmptyString(entry.yearOfStudy) &&
      hasSemesterNumber(entry.currentSemester) &&
      isValidDateRange(entry.startDate, entry.endDate) &&
      isNonEmptyString(entry.eventName) &&
      isNonEmptyString(entry.speakerName) &&
      isNonEmptyString(getWorkshopOrganization(entry)) &&
      hasFacultyRows(entry.coCoordinators),
  },
};

export function validatePreUploadFields(category: CategoryKey, entry: Record<string, unknown>) {
  return CATEGORY_REQUIREMENTS[category].validatePreUploadRequired(
    withAcademicProgressionCompatibility(entry)
  );
}
