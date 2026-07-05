import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { createEntry, commitDraft } from "../../lib/entries/lifecycle.ts";
import { writeResearchProfile } from "../../lib/research/researchProfile.ts";
import { buildAppraisalModel, buildAppraisalDocx } from "../../lib/awards/report.ts";

/**
 * APPRAISAL REPORT — the one-click .docx must carry exactly what the score
 * sees: per-metric detail rows from committed entries + the research
 * profile, section points, and the total.
 */

const OWNER = "report.owner@tce.edu";
const YEAR = "Academic Year 2025-2026";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("appraisal model: rows mirror committed data; points match the score", async () => {
  await withSandbox("appraisal-model", async () => {
    // One committed journal paper (5 points).
    const journal = await createEntry(OWNER, "journal-publications", {
      academicYear: YEAR,
      semesterType: "ODD",
      paperTitle: "LST and urban form",
      journalName: "Env. Research Communications",
      issn: "2515-7620",
      publicationDate: "2025-10-01",
      indexing: "Scopus",
      firstPage: [{ storedPath: "uploads/x/f.pdf", url: "/api/entry-file?p=9", fileName: "f.pdf" }],
    } as never);
    await commitDraft(OWNER, "journal-publications", String(journal.id));

    // A DRAFT paper must NOT appear in the report.
    await createEntry(OWNER, "journal-publications", {
      academicYear: YEAR,
      semesterType: "ODD",
      paperTitle: "Unsubmitted draft",
      journalName: "Nowhere",
      issn: "0000-0000",
      publicationDate: "2025-11-01",
      indexing: "Scopus",
    } as never);

    // Guided scholar viva in-year (12 points).
    await writeResearchProfile(OWNER, {
      ownPhd: { status: "Pursuing", university: "AU", thesisTitle: "T", supervisorType: "External", supervisorName: "X", vivaDate: "" },
      guidedScholars: [
        { id: "s1", scholarType: "External", scholarName: "Scholar One", thesisTitle: "T1", university: "AU", vivaDate: "2026-01-20" },
      ],
    });

    const model = await buildAppraisalModel(OWNER, YEAR);
    assert.equal(model.academicYear, YEAR);
    assert.equal(model.totalPoints, 17, "5 (journal) + 12 (guided viva)");

    const allMetrics = model.sections.flatMap((section) => section.metrics);
    const journalBlock = allMetrics.find((m) => m.id === "journal_publication");
    assert.equal(journalBlock?.rows.length, 1, "committed paper only — drafts excluded");
    assert.equal(journalBlock?.rows[0][0], "LST and urban form");
    assert.equal(journalBlock?.points, 5);

    const guidedBlock = allMetrics.find((m) => m.id === "phd_guided");
    assert.equal(guidedBlock?.rows.length, 1);
    assert.equal(guidedBlock?.rows[0][0], "Scholar One");

    // Empty entry metric → Nil row semantics (rows empty, points 0).
    const patents = allMetrics.find((m) => m.id === "utility_patent");
    assert.equal(patents?.rows.length, 0);
    assert.equal(patents?.points, 0);

    // Interview metrics carry their assessment note.
    const studio = allMetrics.find((m) => m.id === "studio_focus_achievement");
    assert.ok(studio?.assessmentNote?.includes("committee"));
  });
});

test("appraisal docx: renders a real Word file with a sane name", async () => {
  await withSandbox("appraisal-docx", async () => {
    const { buffer, fileName } = await buildAppraisalDocx(OWNER, YEAR);
    // ZIP magic — a .docx is a zip archive.
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
    assert.ok(buffer.length > 5_000, "document has substance");
    assert.match(fileName, /^Award-Appraisal-2025-2026-.+\.docx$/);
  });
});
