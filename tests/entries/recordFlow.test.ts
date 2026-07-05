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

test("registry: journal-publications is a record-flow category; originals stay permission", () => {
  assert.equal(getCategoryFlow("journal-publications"), "record");
  for (const slug of ["workshops", "guest-lectures", "fdp-attended", "fdp-conducted", "case-studies"]) {
    assert.equal(getCategoryFlow(slug), "permission", `${slug} must remain permission-flow`);
  }
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
