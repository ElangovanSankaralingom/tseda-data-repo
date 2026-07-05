export const ACADEMIC_YEAR_OPTIONS = [
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
] as const;

export const ACADEMIC_YEAR_DROPDOWN_OPTIONS = ACADEMIC_YEAR_OPTIONS.map((option) => ({
  label: option,
  value: option,
}));

export function getAcademicYearRange(academicYear: string) {
  const match = academicYear.match(/^Academic Year (\d{4})-(\d{4})$/);
  if (!match) return null;
  return {
    start: `${match[1]}-07-01`,
    end: `${match[2]}-06-30`,
    label: `Jul 1, ${match[1]} to Jun 30, ${match[2]}`,
  };
}

/** Academic year containing an ISO date (July 1 – June 30 boundaries), e.g.
 *  "2025-10-01" → "Academic Year 2025-2026". Null for invalid dates. */
export function academicYearOfDate(isoDate: string): string | null {
  const match = String(isoDate ?? "").match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const startYear = month >= 7 ? year : year - 1;
  return `Academic Year ${startYear}-${startYear + 1}`;
}
