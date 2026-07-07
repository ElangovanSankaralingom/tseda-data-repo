import test from "node:test";
import assert from "node:assert/strict";
import { classifySheet } from "@/lib/import/sheetMatcher";
import { readWorkbook } from "@/lib/import/xlsxReader";
import { planImport } from "@/lib/import/importEngine";
import { makeXlsx } from "../helpers/xlsxFixture.ts";
import type { CellValue } from "@/lib/import/xlsxReader";

/**
 * Regression pins from the FIRST run against the real departmental workbook
 * (Academic Data 2025-2026.xlsx, 2026-07-07). Every case here misbehaved —
 * or nearly did — before the corresponding matcher rule existed. Header rows
 * are verbatim from the real sheets. If a synonym/threshold change breaks
 * one of these, it will misfile the department's actual data.
 */

test("real dialect: FDP/Conference-attended sheet is fdp-attended, never conference-publications", () => {
  const rows: CellValue[][] = [
    [null, "FDP / CONFERENCE Attended", null, "DLC- SEN"],
    ["Sl No", "Duration", "Name of teacher", "  PAN", "Name of conference/ workshop attended for which financial support provided", "Name of the professional body for which membership fee is provided", "Amount of support", "Proofs Link", "VERIFIED Y/N", "REMARKS", "Target Date"],
    [1, "3 days", "S. Anu", null, "A Three-Day FDP on Autodesk Fusion and Revit", "Autodesk and CADSoft", "NA", "https://example.org", null, null, null],
  ];
  const c = classifySheet("57-63 - SEN - FDP Conference", rows);
  assert.equal(c.decision, "matched");
  assert.equal(c.category, "fdp-attended");
});

test("real dialect: dept event-template sheets (WDC) stay unmatched — corroboration floor", () => {
  const rows: CellValue[][] = [
    [11, "WDC - DLC -SL"],
    [null, "2025-2026", "ODD SEM"],
    ["Sl No", "Date - DD/MM/YY", "Name of the event", "Speaker /Organization Detail", "List of Participants duly signed by Staff I/C and HOD", "Proof - Link", "VERIFIED Y/N", "REMARKS", "Target Date"],
    [1, 45700, "Women's Day Session", "Guest Speaker, Some Org", null, null, null, null, null],
  ];
  const c = classifySheet("SL - WDC", rows);
  assert.equal(c.decision, "unmatched");
});

test("real dialect: banner names the subject — 'Career Guidance' tab with Placement banner", () => {
  const rows: CellValue[][] = [
    [32, "Placement"],
    ["Sl No", "Reg No", "Name of the student", "Office Details", "ANNUAL SALARY", "Proof", "VERIFIED Y/N", "REMARKS", "Target Date"],
    [1, "20AR004", "Abishek N", "eTeam InfoServices Private Limited", "3,00,000", null, "Y", null, null],
  ];
  const c = classifySheet("48 - AAAG  - Career Guidance - ", rows);
  assert.equal(c.decision, "matched");
  assert.equal(c.category, "student-placements");
});

test("real dialect: visiting-faculty roster stays unmatched — bare NAME must not pull student fields", () => {
  const rows: CellValue[][] = [
    ["THIAGARAJAR SCHOOL OF ENVIRONMENTAL DESIGN AND ARCHITECTURE"],
    ["VISITING FACULTY- ACADEMIC YEAR 2025-2026 ODD SEMESTER"],
    ["S.No", "NAME", "Designation", "Company Name", "PLACE", "DESIGNATION", "RENUMERATION", "STUDIO ASSIGNED", "REVIEW DATES (TENTATIVE)"],
    [1, "Ar. SRIDHAR K", null, null, "BANGALORE", "DESIGN CHAIR", "Rs.1350/hr", "I, II", "24th & 25th"],
  ];
  const c = classifySheet("19 - DRN - Visiting Faculty", rows);
  assert.equal(c.decision, "unmatched");
});

test("real dialect: course-changes sheet (BoS) stays unmatched despite 'Course Name' column", () => {
  const rows: CellValue[][] = [
    [null, null, null, "2025-2026"],
    ["B.Arch", null, 1, "Details of new courses/ courses with substantial changes"],
    ["S. No.", " Course Name ", "Course Code", "Type of change (New/Major revision)", "  % of change ", "New Course Name", " New Course code ", "Link to old syllabus"],
    [1, "Design Studio VII", "18AR701", "Major revision", "30%", null, null, null],
  ];
  const c = classifySheet("1, 5, 33 - STL", rows);
  assert.equal(c.decision, "unmatched");
});

test("real dialect: guest-lecture sheet with 'Organisers' faculty column matches and maps", () => {
  const rows: CellValue[][] = [
    [null, "2025-2026", "ODD SEM"],
    ["Sl No", "Date - DD/MM/YY", "Name of the event", "Speaker /Organization Detail", "Institution /Industry", "Organisers", "Proof - Link", "VERIFIED Y/N", "REMARKS", "Target Date"],
    [1, 45665, "Hands on Workshop - Structural Design", "Dr. Brindha, TCE", "Institution", "S.M. Vidhya Sankari, Divya R", null, null, null, null],
  ];
  const c = classifySheet("20 - SKR - Guest Lecture", rows);
  assert.equal(c.decision, "matched");
  assert.equal(c.category, "guest-lectures");
});

test("engine: LPA repair, payload-truth missingForCommit, and serial-leak notes", () => {
  const registry = [{ email: "aaag@tce.edu", name: "AAAG Coordinator" }];
  const wb = readWorkbook(
    makeXlsx([
      {
        name: "48 - Career Guidance",
        rows: [
          [32, "Placement", null, null, null],
          ["Sl No", "Reg No", "Name of the student", "Office Details", "ANNUAL SALARY"],
          [1, "20AR004", "Abishek N", "eTeam InfoServices", "3,00,000"],
        ],
      },
      {
        name: "R&D – Journals",
        rows: [
          ["S.No", "Title of Paper", "Authors", "Journal Name", "ISSN", "Month & Year", "Vol/Issue"],
          [1, "UHI in Coimbatore", "AAAG Coordinator", "Env. Research Comm.", "2515-7620", "Oct-2025", 45848],
        ],
      },
    ]),
  );
  const plan = planImport(wb, { registry, ledger: {}, dlcOwner: { email: "aaag@tce.edu", name: "AAAG Coordinator" } });

  const placement = plan.sheets[0].rows[0];
  assert.equal(placement.payload.packageLpa, 3); // ₹3,00,000 → 3 LPA
  assert.ok(placement.issues.some((i) => /3 LPA/.test(i.message)));
  // dlc-scoped fallback owner applies to the student sheet.
  assert.equal(placement.owner?.email, "aaag@tce.edu");
  assert.equal(placement.outcome, "ready");

  const journal = plan.sheets[1].rows[0];
  // Spine inferred from Oct-2025 → present in payload → NOT missingForCommit.
  assert.equal(journal.payload.academicYear, "Academic Year 2025-2026");
  assert.equal(journal.payload.semesterType, "ODD");
  assert.ok(!journal.missingForCommit.includes("academicYear"));
  assert.ok(!journal.missingForCommit.includes("semesterType"));
  assert.ok(journal.missingForCommit.includes("indexing")); // truly absent
  // Excel-converted Vol/Issue cell is kept but flagged.
  assert.equal(journal.payload.volumeIssue, "45848");
  assert.ok(journal.issues.some((i) => /Excel-converted date/.test(i.message)));
});
