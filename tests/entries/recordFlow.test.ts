import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  createEntry,
  commitDraft,
  updateEntry,
  listEntriesForCategory,
  requestEdit,
  cancelEditRequest,
  rejectEditRequest,
  grantEditAccess,
} from "../../lib/entries/lifecycle.ts";
import { addFaculty } from "../../lib/admin/facultyRegistry.ts";
import { MASTER_ADMIN_EMAILS } from "../../lib/admin.ts";
import { computeWorkflowState } from "../../lib/workflow/workflowEngine.ts";
import { DEFAULT_WORKFLOW_CONFIG } from "../../lib/workflow/workflowConfig.ts";
import { isEntryActivated, isEntryWon } from "../../lib/streakProgress.ts";
import { getCategorySchema, getCategoryFlow, CATEGORY_LIST } from "../../data/categoryRegistry.ts";
import { computeFacultyAwardScore } from "../../lib/awards/scoring.ts";
import { addDaysISO, nowISTDateISO } from "../../lib/time.ts";

/**
 * RECORD FLOW — the second lifecycle archetype: post-facto achievements.
 * No permission PDF, no timer. Submit requires EVERYTHING, locks the entry,
 * and the streak counts immediately. Corrections only via DLC/admin request,
 * re-requestable after resolution. The nightly job never touches records.
 */

const OWNER = "owner.record@tce.edu";
const COAUTHOR = "partner.record@tce.edu";
const ADMIN = MASTER_ADMIN_EMAILS[0];
const YEAR = "Academic Year 2025-2026";

function baseJournal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    academicYear: YEAR,
    semesterType: "ODD",
    paperTitle: "Correlation between land surface temperature and urban form",
    journalName: "Environmental Research Communications",
    issn: "2515-7620",
    publicationDate: "2025-10-01", // PAST date — the norm for records
    indexing: "Scopus",
    firstPage: [{ storedPath: "uploads/x/first.pdf", url: "/api/entry-file?p=1", fileName: "first.pdf" }],
    ...overrides,
  };
}

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("export-filter spine: EVERY category collects academicYear + semesterType", () => {
  // Elan's rule (2026-07): academic year and ODD/EVEN semester are mandatory
  // on all categories — they drive every departmental export filter.
  for (const slug of CATEGORY_LIST) {
    const fields = getCategorySchema(slug).fields as readonly { key: string; required?: boolean }[];
    const keys = new Set(fields.map((f) => f.key));
    assert.ok(keys.has("academicYear"), `${slug}: missing academicYear`);
    assert.ok(keys.has("semesterType"), `${slug}: missing semesterType`);
    for (const key of ["academicYear", "semesterType"]) {
      const field = fields.find((f) => f.key === key);
      assert.notEqual(field?.required, false, `${slug}: ${key} must be required`);
    }
  }
});

test("registry: publications are record-flow categories; originals stay permission", () => {
  assert.equal(getCategoryFlow("journal-publications"), "record");
  assert.equal(getCategoryFlow("conference-publications"), "record");
  assert.equal(getCategoryFlow("books-and-chapters"), "record");
  assert.equal(getCategoryFlow("patents"), "record");
  assert.equal(getCategoryFlow("research-funding"), "record");
  assert.equal(getCategoryFlow("editorial-roles"), "record");
  for (const slug of ["workshops", "guest-lectures", "fdp-attended", "fdp-conducted", "case-studies", "conferences-organized"]) {
    assert.equal(getCategoryFlow(slug), "permission", `${slug} must remain permission-flow`);
  }
});

test("conferences-organized: permission flow + 50/30/20 role share on the award", async () => {
  await withSandbox("perm-conferences", async () => {
    const today = nowISTDateISO();
    const base = {
      academicYear: YEAR,
      semesterType: "EVEN",
      startDate: addDaysISO(today, 10),
      endDate: addDaysISO(today, 12),
    };
    // International Coordinator → 20 × 50% = 10
    const intl = await createEntry(OWNER, "conferences-organized", {
      ...base, conferenceTitle: "Intl Symposium on Climate Design", level: "International", role: "Coordinator",
    } as never);
    const committedIntl = await commitDraft(OWNER, "conferences-organized", String(intl.id)) as Record<string, unknown>;

    // PERMISSION flow: timer exists, no record stamp — the original machine.
    assert.notEqual(committedIntl.editWindowExpiresAt, null, "permission flow keeps its edit window");
    assert.notEqual(committedIntl.entryFlow, "record");

    // National Co-Coordinator → 12 × 30% = 3.6
    const natl = await createEntry(OWNER, "conferences-organized", {
      ...base, conferenceTitle: "National Seminar on Vernacular Housing", level: "National", role: "Co-Coordinator",
    } as never);
    await commitDraft(OWNER, "conferences-organized", String(natl.id));

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const byId = new Map(score.metrics.map((m) => [m.id, m]));
    assert.equal(byId.get("intl_conference_organized")?.points, 10, "20 × 50% coordinator share");
    assert.equal(byId.get("natl_conference_organized")?.points, 3.6, "12 × 30% co-coordinator share");
  });
});

test("conference-publications: submit locks, wins instantly, scores 5/unit", async () => {
  await withSandbox("record-conference", async () => {
    const draft = await createEntry(OWNER, "conference-publications", {
      academicYear: YEAR,
      semesterType: "EVEN",
      paperTitle: "CPTED in informal settlements",
      conferenceName: "CPTED Conference 2026",
      level: "International",
      organizedBy: "SPA Bhopal",
      publicationDate: "2026-01-16",
      indexing: "Scopus",
      firstPage: [{ storedPath: "uploads/x/cp.pdf", url: "/api/entry-file?p=2", fileName: "cp.pdf" }],
    } as never);
    const submitted = await commitDraft(OWNER, "conference-publications", String(draft.id)) as Record<string, unknown>;

    assert.equal(submitted.confirmationStatus, "GENERATED");
    assert.equal(submitted.entryFlow, "record");
    assert.equal(submitted.editWindowExpiresAt, null);
    const fields = getCategorySchema("conference-publications").fields;
    assert.equal(isEntryWon(submitted as never, fields as never), true);

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "conference_publication");
    assert.equal(metric?.points, 5);
    assert.equal(metric?.count, 1);
  });
});

test("books-and-chapters: kind splits the two metrics (Book 10 / Chapter 5)", async () => {
  await withSandbox("record-books", async () => {
    const base = {
      academicYear: YEAR,
      semesterType: "ODD",
      publisher: "Springer",
      isbn: "978-3-16-148410-0",
      publicationDate: "2025-11-10",
      coverIsbnProof: [{ storedPath: "uploads/x/cover.pdf", url: "/api/entry-file?p=3", fileName: "cover.pdf" }],
    };
    const book = await createEntry(OWNER, "books-and-chapters", {
      ...base, kind: "Book", bookTitle: "Sustainable Urbanism in South India",
    } as never);
    await commitDraft(OWNER, "books-and-chapters", String(book.id));

    const chapter = await createEntry(OWNER, "books-and-chapters", {
      ...base, kind: "Chapter", bookTitle: "Handbook of Tropical Housing",
      chapterTitle: "Climate-responsive courtyard housing",
    } as never);
    await commitDraft(OWNER, "books-and-chapters", String(chapter.id));

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const byId = new Map(score.metrics.map((m) => [m.id, m]));
    assert.equal(byId.get("book_publication")?.points, 10);
    assert.equal(byId.get("book_publication")?.count, 1);
    assert.equal(byId.get("book_chapter")?.points, 5);
    assert.equal(byId.get("book_chapter")?.count, 1);
  });
});

test("patents: status picks the tier (Granted 10 / Published 5)", async () => {
  await withSandbox("record-patents", async () => {
    const base = {
      academicYear: YEAR,
      semesterType: "EVEN",
      level: "National",
      applicationNumber: "202641012345",
      statusDate: "2025-12-05",
      patentDocument: [{ storedPath: "uploads/x/patent.pdf", url: "/api/entry-file?p=4", fileName: "patent.pdf" }],
    };
    const granted = await createEntry(OWNER, "patents", {
      ...base, patentTitle: "Modular bamboo joinery system", status: "Granted",
    } as never);
    await commitDraft(OWNER, "patents", String(granted.id));

    const published = await createEntry(OWNER, "patents", {
      ...base, patentTitle: "Passive cooling wall assembly", status: "Published",
    } as never);
    await commitDraft(OWNER, "patents", String(published.id));

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "utility_patent");
    assert.equal(metric?.points, 15, "10 (granted) + 5 (published)");
    assert.equal(metric?.count, 2);
  });
});

test("research-funding: kind routes the metric, amount picks the tier", async () => {
  await withSandbox("record-funding", async () => {
    const base = {
      academicYear: YEAR,
      semesterType: "ODD",
      agencyOrClient: "DST",
      sanctionDate: "2025-09-15",
      sanctionOrder: [{ storedPath: "uploads/x/order.pdf", url: "/api/entry-file?p=5", fileName: "order.pdf" }],
    };
    // R&D, ₹12,00,000 → 12 lakhs → "10to20" tier → 15 points
    const rd = await createEntry(OWNER, "research-funding", {
      ...base, kind: "R&D", projectTitle: "Heat-resilient housing study", amountInr: 1_200_000,
    } as never);
    await commitDraft(OWNER, "research-funding", String(rd.id));

    // Consultancy, ₹3,00,000 → 3 lakhs → "gte2_5" → 5 points
    const consult = await createEntry(OWNER, "research-funding", {
      ...base, kind: "Consultancy", projectTitle: "Ecopark Children's Library", amountInr: 300_000,
    } as never);
    await commitDraft(OWNER, "research-funding", String(consult.id));

    // Other, ₹1,50,000 → 1.5 lakhs → "lt2_5" → 3 points
    const other = await createEntry(OWNER, "research-funding", {
      ...base, kind: "Other", projectTitle: "Exhibition support grant", amountInr: 150_000,
    } as never);
    await commitDraft(OWNER, "research-funding", String(other.id));

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const byId = new Map(score.metrics.map((m) => [m.id, m]));
    assert.equal(byId.get("rd_funding")?.points, 15, "12L R&D lands in the 10–20L tier");
    assert.equal(byId.get("rd_funding")?.count, 1);
    assert.equal(byId.get("non_rd_funding")?.points, 8, "5 (3L consultancy) + 3 (1.5L other)");
    assert.equal(byId.get("non_rd_funding")?.count, 2);
  });
});

test("editorial-roles: fixed 6 once for Editor/Assoc; reviewer roles noted, not scored", async () => {
  await withSandbox("record-editorial", async () => {
    const base = {
      academicYear: YEAR,
      semesterType: "ODD",
      appointmentDate: "2025-08-20",
      appointmentProof: [{ storedPath: "uploads/x/appt.pdf", url: "/api/entry-file?p=6", fileName: "appt.pdf" }],
    };
    const editor = await createEntry(OWNER, "editorial-roles", {
      ...base, journalName: "Journal of Tropical Architecture", role: "Associate Editor",
    } as never);
    await commitDraft(OWNER, "editorial-roles", String(editor.id));

    const reviewer = await createEntry(OWNER, "editorial-roles", {
      ...base, journalName: "Built Environment Review", role: "Reviewer",
    } as never);
    await commitDraft(OWNER, "editorial-roles", String(reviewer.id));

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "editorial_role");
    assert.equal(metric?.points, 6, "fixed 6 awarded once");
    assert.equal(metric?.count, 1, "only the Associate Editor role qualifies");
    assert.ok(metric?.notes.some((n) => n.includes("not points-eligible")), "reviewer role explained");
  });
});

test("studio-contributions: reviews/exhibitions score 1/unit capped at 3; other kinds are evidence", async () => {
  await withSandbox("record-studio", async () => {
    const base = {
      academicYear: YEAR,
      semesterType: "EVEN",
      descriptionText: "Open review with practicing architects; 34 students presented.",
      eventDate: "2026-03-14",
      proofs: [{ storedPath: "uploads/x/jury.pdf", url: "/api/entry-file?p=7", fileName: "jury.pdf" }],
    };
    // Four scoring events (1 each, model caps at 3) + one evidence-only entry.
    const kinds = [
      "Open Review / Jury",
      "Open Review / Jury",
      "Exhibition of Student Work",
      "Exhibition of Student Work",
      "Studio Documentation",
    ];
    for (const [index, contributionKind] of kinds.entries()) {
      const entry = await createEntry(OWNER, "studio-contributions", {
        ...base, contributionKind, activityTitle: `Studio event ${index + 1}`,
      } as never);
      await commitDraft(OWNER, "studio-contributions", String(entry.id));
    }

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "open_reviews_exhibitions");
    assert.equal(metric?.count, 4, "four qualifying events");
    assert.equal(metric?.points, 3, "capped at the model max");
    assert.ok(metric?.notes.some((n) => n.includes("Capped")), "cap explained");
    assert.ok(
      metric?.notes.some((n) => n.includes("committee evidence")),
      "documentation entry surfaced as committee evidence",
    );
  });
});

test("submit: rejects incomplete records; completed submit locks with no timer and wins instantly", async () => {
  await withSandbox("record-submit", async () => {
    // Missing the required firstPage upload → submit must refuse.
    const incomplete = await createEntry(OWNER, "journal-publications", baseJournal({ firstPage: [] }) as never);
    await assert.rejects(
      () => commitDraft(OWNER, "journal-publications", String(incomplete.id)),
      /required fields and proof uploads/i,
    );

    // Complete → submit succeeds.
    const draft = await createEntry(OWNER, "journal-publications", baseJournal() as never);
    const submitted = await commitDraft(OWNER, "journal-publications", String(draft.id)) as Record<string, unknown>;

    assert.equal(submitted.confirmationStatus, "GENERATED");
    assert.equal(submitted.entryFlow, "record");
    assert.equal(submitted.editWindowExpiresAt, null, "records have NO edit window");
    assert.equal(submitted.streakEligible, true, "past-dated records ARE streak eligible");

    // Streak: no activation phase — the submission is the win.
    const fields = getCategorySchema("journal-publications").fields;
    assert.equal(isEntryActivated(submitted as never), false);
    assert.equal(isEntryWon(submitted as never, fields as never), true);

    // Workflow state: locked view mode, no buttons except Request Action.
    const state = computeWorkflowState(submitted, "journal-publications", DEFAULT_WORKFLOW_CONFIG);
    assert.equal(state.flow, "record");
    assert.equal(state.isFinalized, true);
    assert.equal(state.isEditable, false);
    assert.equal(state.buttons.generate.visible, false);
    assert.equal(state.buttons.finalise.visible, false);
    assert.equal(state.requestState.canRequestEdit, true, "requests open immediately");
    assert.equal(state.autoAction, "none", "nightly never touches records");

    // Locked: direct edits must be refused by the engine.
    await assert.rejects(
      () => updateEntry(OWNER, "journal-publications", String(draft.id), { paperTitle: "sneaky edit" }),
    );

    // Awards: the committed paper scores 5 via journal_publication.
    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "journal_publication");
    assert.equal(metric?.points, 5);
    assert.equal(metric?.count, 1);
  });
});

test("corrections: re-requestable after cancel AND after admin rejection; streak survives", async () => {
  await withSandbox("record-requests", async () => {
    const draft = await createEntry(OWNER, "journal-publications", baseJournal() as never);
    const id = String(draft.id);
    await commitDraft(OWNER, "journal-publications", id);

    // Request → cancel → the record is NOT permanently locked.
    await requestEdit(OWNER, "journal-publications", id, "typo in title");
    const cancelled = await cancelEditRequest(OWNER, "journal-publications", id) as Record<string, unknown>;
    assert.notEqual(cancelled.permanentlyLocked, true, "cancel must not lock a record");

    // Request again → admin rejects → STILL not permanently locked.
    await requestEdit(OWNER, "journal-publications", id, "typo, really");
    const rejected = await rejectEditRequest(ADMIN, "journal-publications", OWNER, id, "not needed") as Record<string, unknown>;
    assert.notEqual(rejected.permanentlyLocked, true, "rejection must not lock a record");
    assert.equal(rejected.streakPermanentlyRemoved ?? false, false, "corrections never forfeit a record streak");

    // Third request → grant → editable again → resubmit locks again.
    await requestEdit(OWNER, "journal-publications", id, "third time");
    const granted = await grantEditAccess(ADMIN, "journal-publications", OWNER, id) as Record<string, unknown>;
    assert.equal(granted.confirmationStatus, "EDIT_GRANTED");
    const editable = computeWorkflowState(granted, "journal-publications", DEFAULT_WORKFLOW_CONFIG);
    assert.equal(editable.isEditable, true);

    await updateEntry(OWNER, "journal-publications", id, { paperTitle: "Corrected title" });
    const resubmitted = await commitDraft(OWNER, "journal-publications", id) as Record<string, unknown>;
    assert.equal(resubmitted.confirmationStatus, "GENERATED");
    assert.equal(resubmitted.paperTitle, "Corrected title");
    assert.equal(resubmitted.editWindowExpiresAt, null);
  });
});

test("fan-out: submitting with TCE co-authors creates their own draft copies", async () => {
  await withSandbox("record-fanout", async () => {
    addFaculty(COAUTHOR, "Record Partner", OWNER);

    const draft = await createEntry(OWNER, "journal-publications", baseJournal({
      coAuthors: [{ id: "r1", name: "Record Partner", email: COAUTHOR }],
    }) as never);
    await commitDraft(OWNER, "journal-publications", String(draft.id));

    const copies = await listEntriesForCategory(COAUTHOR, "journal-publications");
    assert.equal(copies.length, 1, "co-author must receive a prefilled copy");
    const copy = copies[0] as Record<string, unknown>;
    assert.equal(copy.paperTitle, baseJournal().paperTitle);
    assert.equal(copy.sourceEmail, OWNER);
    assert.ok(!copy.committedAtISO, "the copy is an independent DRAFT — their own submit, their own streak");
  });
});
