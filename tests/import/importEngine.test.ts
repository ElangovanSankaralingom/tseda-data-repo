import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { readWorkbook } from "@/lib/import/xlsxReader";
import { planImport, applyImport, type ImportLedger } from "@/lib/import/importEngine";
import { renderMarkdownReport, renderJsonReport } from "@/lib/import/report";
import { makeXlsx } from "../helpers/xlsxFixture.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const REGISTRY = [
  { email: "elan@tce.edu", name: "Elangovan Sankaralingom" },
  { email: "priya@tce.edu", name: "Priya Ramachandran" },
  { email: "karthik@tce.edu", name: "Karthik Subramanian" },
];

/** The realistic fixture: banner rows, dialect headers, messy values. */
function fixtureWorkbook(): Buffer {
  return makeXlsx([
    {
      name: "R&D – Journals (Qn 19)",
      rows: [
        ["Department of Architecture — Journals 2025-26", null, null, null, null, null, null],
        ["S.No", "Title of Paper", "Authors", "Journal Name", "ISSN", "Month & Year", "DOI"],
        [1, "Adaptive Reuse of Chettinad Mansions", "Dr. E. Sankaralingom, Rahul Mehrotra", "Journal of Vernacular Studies", "1234-5678", "Jan-2026", "10.1000/jvs.2026.01"],
        [2, "Thermal Comfort in Courtyard Houses", "Priya Ramachandran & Karthik Subramanian", "Building & Environment", "8765-4321", 45870, null],
        [3, "A Paper By Outsiders Only", "Rahul Mehrotra, Bijoy Jain", "Some Journal", "0000-1111", "Feb-2026", null],
        [4, "Adaptive Reuse of Chettinad Mansions", "Dr. E. Sankaralingom, Rahul Mehrotra", "Journal of Vernacular Studies", "1234-5678", "Jan-2026", "10.1000/jvs.2026.01"],
      ],
    },
    {
      name: "Conference papers",
      rows: [
        ["S.No", "Paper Title", "Authors", "Conference Name", "ISSN", "International/National", "Month & Year"],
        [1, "Placemaking Through Game Theory", "Elangovan S", "TACAS 2025", "1111-2222", "Intl.", "Dec-2025"],
      ],
    },
    {
      name: "Infrastructure & Equipment",
      rows: [
        ["Lab Name", "Computer Count", "Stock Number", "Upgrade Cost"],
        ["Design Studio 3", 40, "STK-2201", 250000],
      ],
    },
  ]);
}

test("plan: classification, ownership, spine inference, duplicates, externals", () => {
  const workbook = readWorkbook(fixtureWorkbook());
  const plan = planImport(workbook, { registry: REGISTRY, ledger: {} });

  assert.equal(plan.summary.sheetsMatched, 2);
  assert.equal(plan.summary.sheetsUnmatched, 1);

  const journals = plan.sheets.find((s) => s.sheetName.startsWith("R&D"))!;
  assert.equal(journals.classification.category, "journal-publications");
  assert.equal(journals.rows.length, 4);

  const [row1, row2, row3, row4] = journals.rows;
  // Row 1: owner = Elan (first resolved author), external kept, NOT a co-author of himself.
  assert.equal(row1.outcome, "ready");
  assert.equal(row1.owner?.email, "elan@tce.edu");
  assert.equal(row1.payload.coAuthors, undefined);
  assert.match(String(row1.payload.externalAuthors), /Rahul Mehrotra/);
  assert.equal(row1.payload.paperTitle, "Adaptive Reuse of Chettinad Mansions");
  assert.equal(row1.payload.publicationDate, "2026-01-01");
  // Spine inferred from the date: Jan → EVEN, AY 2025-2026.
  assert.equal(row1.payload.academicYear, "Academic Year 2025-2026");
  assert.equal(row1.payload.semesterType, "EVEN");

  // Row 2: owner = Priya; Karthik becomes the TCE co-author; serial date read.
  assert.equal(row2.outcome, "ready");
  assert.equal(row2.owner?.email, "priya@tce.edu");
  const coAuthors = row2.payload.coAuthors as { email: string }[];
  assert.equal(coAuthors.length, 1);
  assert.equal(coAuthors[0].email, "karthik@tce.edu");
  assert.equal(typeof row2.payload.publicationDate, "string");

  // Row 3: no TCE owner resolvable → attention, never imported silently.
  assert.equal(row3.outcome, "attention");
  assert.ok(row3.issues.some((i) => i.severity === "attention"));

  // Row 4: exact duplicate of row 1 within the batch.
  assert.equal(row4.outcome, "duplicate");

  // Unresolved externals are tallied for the report.
  assert.ok(plan.summary.unresolvedNames.has("Rahul Mehrotra"));

  const conf = plan.sheets.find((s) => s.sheetName === "Conference papers")!;
  assert.equal(conf.classification.category, "conference-publications");
  assert.equal(conf.rows[0].outcome, "ready");
  assert.equal(conf.rows[0].owner?.email, "elan@tce.edu");

  // Reports render without throwing and carry the essentials.
  const md = renderMarkdownReport(plan);
  assert.match(md, /DRY RUN/);
  assert.match(md, /journal-publications/);
  assert.match(md, /Rahul Mehrotra/);
  JSON.parse(renderJsonReport(plan));
});

test("apply: drafts land through the engine, feed stays silent, re-run is a no-op", async () => {
  const ctx = await createTestDataRoot("workbook-import");
  try {
    const { createEntry } = await import("../../lib/entries/lifecycle.ts");
    const { readCategoryEntries } = await import("../../lib/dataStore.ts");
    const { listFeedEvents } = await import("../../lib/feed/feedStore.ts");

    const workbook = readWorkbook(fixtureWorkbook());
    const plan = planImport(workbook, { registry: REGISTRY, ledger: {} });
    const result = await applyImport(plan, {
      registry: REGISTRY,
      ledger: {},
      createEntry: (owner, category, payload) => createEntry(owner, category, payload as never),
    });

    // 2 ready journal rows + 1 conference row; attention + duplicate skipped.
    assert.equal(result.created.length, 3);
    assert.equal(result.failed.length, 0);

    const elanJournal = await readCategoryEntries("elan@tce.edu", "journal-publications");
    assert.equal(elanJournal.length, 1);
    const entry = elanJournal[0] as Record<string, unknown>;
    assert.equal(entry.confirmationStatus, "DRAFT");
    assert.equal(entry.paperTitle, "Adaptive Reuse of Chettinad Mansions");
    assert.equal(entry.academicYear, "Academic Year 2025-2026");

    const priyaJournal = await readCategoryEntries("priya@tce.edu", "journal-publications");
    assert.equal(priyaJournal.length, 1);

    const outsiders = await readCategoryEntries("elan@tce.edu", "conference-publications");
    assert.equal(outsiders.length, 1);

    // Drafts have earned nothing: the feed must be EMPTY (I-F2 by construction).
    const events = await listFeedEvents(50);
    assert.equal(events.length, 0);

    // Idempotency: a fresh plan against the persisted ledger marks every
    // previously-created row duplicate, and apply creates nothing.
    const plan2 = planImport(workbook, { registry: REGISTRY, ledger: result.ledger as ImportLedger });
    const readyAgain = plan2.sheets.flatMap((s) => s.rows).filter((r) => r.outcome === "ready");
    assert.equal(readyAgain.length, 0);
    const result2 = await applyImport(plan2, {
      registry: REGISTRY,
      ledger: result.ledger,
      createEntry: (owner, category, payload) => createEntry(owner, category, payload as never),
    });
    assert.equal(result2.created.length, 0);

    // And the store agrees: still exactly one entry per owner.
    assert.equal((await readCategoryEntries("elan@tce.edu", "journal-publications")).length, 1);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("dry run writes nothing", async () => {
  const ctx = await createTestDataRoot("workbook-import-dry");
  try {
    const workbook = readWorkbook(fixtureWorkbook());
    planImport(workbook, { registry: REGISTRY, ledger: {} });
    const entries = await fs.readdir(ctx.root).catch(() => []);
    // The data root stays empty apart from what createTestDataRoot itself made.
    const meaningful = entries.filter((e) => e !== "private");
    assert.equal(meaningful.length, 0);
    // No users tree, no feed config.
    await assert.rejects(fs.access(path.join(ctx.root, "users")));
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
