import {
  YEAR_OF_STUDY_OPTIONS,
  allowedCurrentSemestersForYear,
  isCurrentSemesterAllowed,
  normalizeYearOfStudy,
  type CurrentSemester,
  type YearOfStudy,
} from "@/lib/types/academicProgression";

export type StudentYear = YearOfStudy;

export { YEAR_OF_STUDY_OPTIONS, normalizeYearOfStudy, type CurrentSemester, type YearOfStudy };

export const STUDENT_YEAR_OPTIONS = YEAR_OF_STUDY_OPTIONS;

export function allowedSemestersForYear(year: YearOfStudy | undefined): CurrentSemester[] {
  return allowedCurrentSemestersForYear(year);
}

export function isSemesterAllowed(
  year: YearOfStudy | undefined,
  semester: number | undefined
): boolean {
  return isCurrentSemesterAllowed(year, semester);
}

export function normalizeStudentYear(value: string): StudentYear | undefined {
  return normalizeYearOfStudy(value);
}
