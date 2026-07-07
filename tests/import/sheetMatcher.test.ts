import test from "node:test";
import assert from "node:assert/strict";
import { classifySheet, mapColumns, findHeaderRow, headerSimilarity } from "@/lib/import/sheetMatcher";
import type { CellValue } from "@/lib/import/xlsxReader";

// Header sets below are the REAL departmental columns per docs/DATA-INVENTORY.md §B.

const JOURNAL_ROWS: CellValue[][] = [
  ["Department of Architecture — R&D Journals 2025-2026", null, null, null, null, null, null, null],
  ["S.No", "Title of Paper", "Authors", "Journal Name", "ISSN", "Vol/Issue", "Page Numbers", "Month & Year"],
  [1, "Adaptive Reuse of Chettinad Mansions", "Dr. E. Sankaralingom, Priya R", "Journal of Vernacular Studies", "1234-5678", "12/3", "45-58", "Jan-2026"],
  [2, "Thermal Comfort in Courtyard Houses", "Karthik S & Rahul Mehrotra", "Building & Environment", "8765-4321", "8/1", "112-129", 45870],
];

const CONFERENCE_ROWS: CellValue[][] = [
  ["S.No", "Paper Title", "Authors", "Conference Name", "ISSN", "International/National", "Month & Year"],
  [1, "Placemaking Through Game Theory", "Dr. E. Sankaralingom", "TACAS 2025", "1111-2222", "International", "Dec-2025"],
];

test("journals sheet classifies as journal-publications, not conference", () => {
  const c = classifySheet("R&D – Journals (Qn 19)", JOURNAL_ROWS);
  assert.equal(c.decision, "matched");
  assert.equal(c.category, "journal-publications");
  assert.equal(c.headerRow, 1); // banner row skipped
});

test("conference sheet classifies as conference-publications, not journals", () => {
  const c = classifySheet("Conference papers", CONFERENCE_ROWS);
  assert.equal(c.decision, "matched");
  assert.equal(c.category, "conference-publications");
});

test("column mapping: real journal headers map to schema keys with S.No ignored", () => {
  const headers = JOURNAL_ROWS[1].map((h) => (h === null ? null : String(h)));
  const m = mapColumns("journal-publications", headers, JOURNAL_ROWS.slice(2));
  const byHeader = new Map<string, string>();
  headers.forEach((h, i) => {
    const key = m.columns.get(i);
    if (h && key) byHeader.set(h, key);
  });
  assert.equal(byHeader.get("S.No"), "__ignore__");
  assert.equal(byHeader.get("Title of Paper"), "paperTitle");
  assert.equal(byHeader.get("Journal Name"), "journalName");
  assert.equal(byHeader.get("ISSN"), "issn");
  assert.equal(byHeader.get("Vol/Issue"), "volumeIssue");
  assert.equal(byHeader.get("Page Numbers"), "pageNumbers");
  assert.equal(byHeader.get("Month & Year"), "publicationDate");
  assert.equal(byHeader.get("Authors"), "coAuthors");
});

test("required-for-commit gaps are reported, not fatal", () => {
  // Headers missing ISSN and any date column.
  const headers = ["Title of Paper", "Journal Name"];
  const m = mapColumns("journal-publications", headers, []);
  assert.ok(m.missingForCommit.includes("issn"));
  assert.ok(m.missingForCommit.includes("publicationDate"));
});

test("alien sheets stay unmatched; near-ties are ambiguous, never guessed", () => {
  const infra: CellValue[][] = [
    ["Lab Name", "Computer Count", "Stock Number", "Upgrade Cost"],
    ["Design Studio 3", 40, "STK-2201", 250000],
  ];
  const c = classifySheet("Infrastructure & Equipment", infra);
  assert.equal(c.decision, "unmatched");
});

test("findHeaderRow skips multi-row banners", () => {
  const rows: CellValue[][] = [
    ["Thiagarajar School of Environmental Design and Architecture", null, null],
    ["NAAC Question 19 — consolidated", null, null],
    ["S.No", "Title of Paper", "Journal Name"],
    [1, "Some Paper", "Some Journal"],
  ];
  assert.equal(findHeaderRow(rows), 2);
});

test("headerSimilarity behaves: exact > containment > token overlap", () => {
  assert.equal(headerSimilarity("ISSN", "issn"), 1);
  assert.ok(headerSimilarity("Name of the Journal", "journal name") > 0.5);
  assert.ok(headerSimilarity("Title of Paper", "title of the paper") > 0.6);
  assert.ok(headerSimilarity("Lab Name", "journal name") < 0.5);
});
