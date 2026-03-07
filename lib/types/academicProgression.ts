export const YEAR_OF_STUDY_VALUES = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year",
  "5th year",
] as const;

export type YearOfStudy = (typeof YEAR_OF_STUDY_VALUES)[number];

export const CURRENT_SEMESTER_VALUES = [
  1, 2, 3, 4, 5,
  6, 7, 8, 9, 10,
] as const;

export type CurrentSemester = (typeof CURRENT_SEMESTER_VALUES)[number];

export type SemesterType = "ODD" | "EVEN";

export type AcademicProgressionFields = {
  yearOfStudy: YearOfStudy | "";
  currentSemester: CurrentSemester | null;
};

export type AcademicProgressionCompatibilityFields = {
  studentYear?: YearOfStudy | "";
  semesterNumber?: CurrentSemester | null;
  semesterType?: SemesterType;
};

const YEAR_OF_STUDY_TO_SEMESTERS: Record<YearOfStudy, CurrentSemester[]> = {
  "1st year": [1, 2],
  "2nd year": [3, 4],
  "3rd year": [5, 6],
  "4th year": [7, 8],
  "5th year": [9, 10],
};

const NUMERIC_YEAR_TO_LABEL: Record<string, YearOfStudy> = {
  "1": "1st year",
  "2": "2nd year",
  "3": "3rd year",
  "4": "4th year",
  "5": "5th year",
};

const CURRENT_SEMESTER_SET = new Set<number>(CURRENT_SEMESTER_VALUES);

export const YEAR_OF_STUDY_OPTIONS: Array<{ label: string; value: YearOfStudy }> =
  YEAR_OF_STUDY_VALUES.map((value) => ({
    label: value,
    value,
  }));

export function normalizeYearOfStudy(value: unknown): YearOfStudy | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return NUMERIC_YEAR_TO_LABEL[String(value)];
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "1":
    case "1st":
    case "1st year":
      return "1st year";
    case "2":
    case "2nd":
    case "2nd year":
      return "2nd year";
    case "3":
    case "3rd":
    case "3rd year":
      return "3rd year";
    case "4":
    case "4th":
    case "4th year":
      return "4th year";
    case "5":
    case "5th":
    case "5th year":
      return "5th year";
    default:
      return undefined;
  }
}

export function normalizeCurrentSemester(value: unknown): CurrentSemester | undefined {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(numericValue) || !CURRENT_SEMESTER_SET.has(numericValue)) {
    return undefined;
  }

  return numericValue as CurrentSemester;
}

export function allowedCurrentSemestersForYear(
  yearOfStudy: YearOfStudy | undefined
): CurrentSemester[] {
  if (!yearOfStudy) return [];
  return YEAR_OF_STUDY_TO_SEMESTERS[yearOfStudy];
}

export function isCurrentSemesterAllowed(
  yearOfStudy: YearOfStudy | undefined,
  currentSemester: unknown
): boolean {
  const normalizedSemester = normalizeCurrentSemester(currentSemester);
  if (!yearOfStudy || normalizedSemester === undefined) return false;
  return YEAR_OF_STUDY_TO_SEMESTERS[yearOfStudy].includes(normalizedSemester);
}

export function deriveSemesterType(currentSemester: unknown): SemesterType | undefined {
  const normalizedSemester = normalizeCurrentSemester(currentSemester);
  if (normalizedSemester === undefined) return undefined;
  return normalizedSemester % 2 === 1 ? "ODD" : "EVEN";
}

export function withAcademicProgressionCompatibility<
  TRecord extends Record<string, unknown>,
>(record: TRecord): TRecord & AcademicProgressionFields & AcademicProgressionCompatibilityFields {
  const next = { ...record } as TRecord &
    AcademicProgressionFields &
    AcademicProgressionCompatibilityFields;
  const rawRecord = record as {
    yearOfStudy?: unknown;
    currentSemester?: unknown;
    studentYear?: unknown;
    semesterNumber?: unknown;
  };

  const normalizedYear =
    normalizeYearOfStudy(next.yearOfStudy) ?? normalizeYearOfStudy(next.studentYear);
  const yearCleared =
    rawRecord.yearOfStudy === "" ||
    rawRecord.studentYear === "" ||
    rawRecord.yearOfStudy === null ||
    rawRecord.studentYear === null;

  if (normalizedYear) {
    next.yearOfStudy = normalizedYear;
    next.studentYear = normalizedYear;
  } else if (yearCleared) {
    next.yearOfStudy = "";
    next.studentYear = "";
  }

  const normalizedSemester =
    normalizeCurrentSemester(next.currentSemester) ?? normalizeCurrentSemester(next.semesterNumber);
  const semesterCleared =
    rawRecord.currentSemester === null ||
    rawRecord.semesterNumber === null ||
    rawRecord.currentSemester === "" ||
    rawRecord.semesterNumber === "";

  if (normalizedSemester !== undefined) {
    next.currentSemester = normalizedSemester;
    next.semesterNumber = normalizedSemester;
    next.semesterType = deriveSemesterType(normalizedSemester);
  } else if (semesterCleared) {
    next.currentSemester = null;
    next.semesterNumber = null;
    delete next.semesterType;
  }

  return next;
}
