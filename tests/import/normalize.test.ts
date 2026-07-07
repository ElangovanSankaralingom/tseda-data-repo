import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDate, normalizeAcademicYear, academicYearFromISO, semesterFromISO,
  normalizeSemesterType, normalizeEnum, normalizeAmount, normalizeBoolean, cleanText, foldKey,
} from "@/lib/import/normalize";

test("dates: Excel serials, day-first numerics, month-year dialects", () => {
  assert.equal(normalizeDate(45870)?.value, "2025-08-01"); // serial
  assert.equal(normalizeDate("2026-01-15")?.value, "2026-01-15");
  assert.equal(normalizeDate("15/01/2026")?.value, "2026-01-15"); // day-first
  const monthFirst = normalizeDate("01/15/2026"); // only valid month-first
  assert.equal(monthFirst?.value, "2026-01-15");
  assert.match(monthFirst?.inferred ?? "", /month-first/);
  const my = normalizeDate("Jan-2026");
  assert.equal(my?.value, "2026-01-01");
  assert.match(my?.inferred ?? "", /1st of month/);
  assert.equal(normalizeDate("12 March 2025")?.value, "2025-03-12");
  assert.equal(normalizeDate("03/2026")?.value, "2026-03-01");
  assert.equal(normalizeDate("garbage"), null);
  assert.equal(normalizeDate(12), null); // serial out of plausible range
  assert.equal(normalizeDate("31/02/2026"), null); // impossible date
});

test("academic year: app format + derivation from date", () => {
  assert.equal(normalizeAcademicYear("2025-26")?.value, "Academic Year 2025-2026");
  assert.equal(normalizeAcademicYear("AY 2025-2026")?.value, "Academic Year 2025-2026");
  assert.equal(normalizeAcademicYear("2025-2027"), null); // not consecutive
  assert.equal(academicYearFromISO("2025-08-15")?.value, "Academic Year 2025-2026");
  assert.equal(academicYearFromISO("2026-02-10")?.value, "Academic Year 2025-2026");
  assert.equal(semesterFromISO("2025-08-15")?.value, "ODD");
  assert.equal(semesterFromISO("2026-02-10")?.value, "EVEN");
  assert.equal(normalizeSemesterType("odd semester")?.value, "ODD");
  assert.equal(normalizeSemesterType("EVEN")?.value, "EVEN");
});

test("enums: exact, containment, and domain synonyms", () => {
  const idx = ["Scopus", "Web of Science", "UGC-CARE", "Other/None"] as const;
  assert.equal(normalizeEnum("SCOPUS", idx)?.value, "Scopus");
  assert.equal(normalizeEnum("WoS", idx)?.value, "Web of Science");
  assert.equal(normalizeEnum("ugc care listed", idx)?.value, "UGC-CARE");
  assert.equal(normalizeEnum("not indexed", idx)?.value, "Other/None");
  const lvl = ["National", "International"] as const;
  assert.equal(normalizeEnum("Intl.", lvl)?.value, "International");
  assert.equal(normalizeEnum("national conference", lvl)?.value, "National");
  assert.equal(normalizeEnum("???", lvl), null);
});

test("amounts: Indian grouping, lakhs, crores", () => {
  assert.equal(normalizeAmount("₹2,50,000")?.value, 250000);
  assert.equal(normalizeAmount("2.5 lakhs")?.value, 250000);
  assert.equal(normalizeAmount("1.2 Cr")?.value, 12000000);
  assert.equal(normalizeAmount(50000)?.value, 50000);
  assert.equal(normalizeAmount("Rs. 75,000")?.value, 75000);
  assert.equal(normalizeAmount("free"), null);
});

test("booleans and text hygiene", () => {
  assert.equal(normalizeBoolean("Yes")?.value, true);
  assert.equal(normalizeBoolean("N")?.value, false);
  assert.equal(normalizeBoolean(true)?.value, true);
  assert.equal(cleanText("  Dr. E.  Sankar  "), "Dr. E. Sankar");
  assert.equal(foldKey("Title of the Paper (as published)"), "title of the paper as published");
});
