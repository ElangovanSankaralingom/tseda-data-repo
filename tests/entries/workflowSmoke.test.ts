import assert from "node:assert/strict";
import test from "node:test";
import {
  approveEntry,
  commitDraft,
  createEntry,
  sendForConfirmation,
  updateEntry,
} from "../../lib/entries/lifecycle.ts";
import { isEntryEditable } from "../../lib/entries/lock.ts";
import { buildExportRows } from "../../lib/export/exportService.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const ownerEmail = "faculty.workflow@tce.edu";
const adminEmail = "senarch@tce.edu";

function buildUploadedFile(seed: string) {
  return {
    fileName: `${seed}.pdf`,
    mimeType: "application/pdf",
    size: 100,
    uploadedAt: new Date().toISOString(),
    url: `/uploads/${seed}.pdf`,
    storedPath: `${seed}.pdf`,
  };
}

function buildCompleteWorkshopPayload() {
  return {
    academicYear: "Academic Year 2025-2026",
    yearOfStudy: "2nd year",
    currentSemester: 3,
    startDate: "2025-08-10",
    endDate: "2025-08-12",
    eventName: "Workflow Workshop",
    speakerName: "Initial Speaker",
    organisationName: "TCE",
    uploads: {
      permissionLetter: buildUploadedFile("permission"),
      brochure: buildUploadedFile("brochure"),
      attendance: buildUploadedFile("attendance"),
      organiserProfile: buildUploadedFile("organiser-profile"),
      geotaggedPhotos: [buildUploadedFile("photo-1")],
    },
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

test("workflow smoke covers draft save, done, reopen, confirmation, approval, lock, and export", async () => {
  await withSandbox("workflow-smoke-happy-path", async () => {
    const created = await createEntry(ownerEmail, "workshops", buildCompleteWorkshopPayload());
    const entryId = String(created.id);

    assert.equal(String(created.confirmationStatus ?? ""), "DRAFT");
    assert.equal(Boolean(created.committedAtISO), false);
    assert.equal(isEntryEditable(created), true);

    const savedDraft = await updateEntry(ownerEmail, "workshops", entryId, {
      eventName: "Workflow Workshop Draft Saved",
    });
    assert.equal(String(savedDraft.confirmationStatus ?? ""), "DRAFT");
    assert.equal(String(savedDraft.eventName ?? ""), "Workflow Workshop Draft Saved");
    assert.equal(Boolean(savedDraft.committedAtISO), false);
    assert.equal(isEntryEditable(savedDraft), true);

    const committed = await commitDraft(ownerEmail, "workshops", entryId);
    assert.equal(String(committed.confirmationStatus ?? ""), "DRAFT");
    assert.equal(Boolean(committed.committedAtISO), true);
    assert.equal(Boolean(committed.sentForConfirmationAtISO), false);
    assert.equal(isEntryEditable(committed), true);

    const reopened = await updateEntry(ownerEmail, "workshops", entryId, {
      speakerName: "Reopened Speaker",
    });
    assert.equal(String(reopened.confirmationStatus ?? ""), "DRAFT");
    assert.equal(Boolean(reopened.committedAtISO), true);
    assert.equal(String(reopened.speakerName ?? ""), "Reopened Speaker");
    assert.equal(isEntryEditable(reopened), true);

    const pending = await sendForConfirmation(ownerEmail, "workshops", entryId);
    assert.equal(String(pending.confirmationStatus ?? ""), "PENDING_CONFIRMATION");
    assert.equal(Boolean(pending.committedAtISO), true);
    assert.equal(Boolean(pending.sentForConfirmationAtISO), true);

    const approved = await approveEntry(adminEmail, "workshops", ownerEmail, entryId);
    assert.equal(String(approved.confirmationStatus ?? ""), "APPROVED");
    assert.equal(Boolean(approved.confirmedAtISO), true);
    assert.equal(String(approved.confirmedBy ?? ""), adminEmail);
    assert.equal(isEntryEditable(approved), false);

    const built = await buildExportRows(ownerEmail, "workshops", [
      "id",
      "eventName",
      "speakerName",
      "confirmationStatus",
    ]);
    assert.equal(built.ok, true);
    if (!built.ok) return;

    assert.equal(built.data.rows.length, 1);
    assert.deepEqual(built.data.rows[0], [
      entryId,
      "Workflow Workshop Draft Saved",
      "Reopened Speaker",
      "APPROVED",
    ]);
    assert.equal(built.data.countsByStatus.APPROVED, 1);
    assert.equal(built.data.countsByStatus.DRAFT, 0);
    assert.equal(built.data.countsByStatus.PENDING_CONFIRMATION, 0);
  });
});

test("workflow smoke rejects send for confirmation before done/commit", async () => {
  await withSandbox("workflow-smoke-precommit-confirmation", async () => {
    const created = await createEntry(ownerEmail, "workshops", buildCompleteWorkshopPayload());

    await assert.rejects(
      () => sendForConfirmation(ownerEmail, "workshops", String(created.id)),
      /Complete the entry with Done before confirmation\./
    );

    assert.equal(String(created.confirmationStatus ?? ""), "DRAFT");
    assert.equal(isEntryEditable(created), true);
  });
});
