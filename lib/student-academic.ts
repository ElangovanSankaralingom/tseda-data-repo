export type StudentYear =
  | "1st year"
  | "2nd year"
  | "3rd year"
  | "4th year"
  | "5th year";

const YEAR_TO_SEMESTERS: Record<StudentYear, number[]> = {
  "1st year": [1, 2],
  "2nd year": [3, 4],
  "3rd year": [5, 6],
  "4th year": [7, 8],
  "5th year": [9, 10],
};

export const STUDENT_YEAR_OPTIONS: Array<{ label: string; value: StudentYear }> = [
  { label: "1st year", value: "1st year" },
  { label: "2nd year", value: "2nd year" },
  { label: "3rd year", value: "3rd year" },
  { label: "4th year", value: "4th year" },
  { label: "5th year", value: "5th year" },
];

export function allowedSemestersForYear(year: StudentYear | undefined): number[] {
  if (!year) return [];
  return YEAR_TO_SEMESTERS[year];
}

export function isSemesterAllowed(year: StudentYear | undefined, semester: number | undefined): boolean {
  if (!year || typeof semester !== "number" || !Number.isInteger(semester)) return false;
  return YEAR_TO_SEMESTERS[year].includes(semester);
}

export function normalizeStudentYear(value: string): StudentYear | undefined {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "1st":
    case "1st year":
      return "1st year";
    case "2nd":
    case "2nd year":
      return "2nd year";
    case "3rd":
    case "3rd year":
      return "3rd year";
    case "4th":
    case "4th year":
      return "4th year";
    case "5th":
    case "5th year":
      return "5th year";
    default:
      return undefined;
  }
}
