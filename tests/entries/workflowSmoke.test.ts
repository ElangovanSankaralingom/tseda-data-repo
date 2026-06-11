import assert from "node:assert/strict";
import test from "node:test";
import {
  commitDraft,
  createEntry,
  finalizeEntry,
  requestEdit,
  grantEditAccess,
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
    semesterType: "ODD",
    level: "National",
    mode: "Offline",
    startDate: "2025-08-10",
    endDate: "2025-08-12",
    workshopName: "Workflow Workshop",
    resourcePersonName: "Initial Speaker",
    resourcePersonDesignation: "Professor",
    resourcePersonOrganisation: "TCE",
    permissionLetter: [buildUploadedFile("permission")],
    geotaggedPhotos: [buildUploadedFile("photo-1")],
    attendanceSheet: [buildUploadedFile("attendance")],
    officialPoster: [buildUploadedFile("official-poster")],
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

test("workflow smoke: draft, generate, edit request, grant, and export", async () => {
  await withSandbox("workflow-smoke-happy-path", async () => {
    const created = await createEntry(ownerEmail, "workshops", buildCompleteWorkshopPayload());
    const entryId = String(created.id);

    assert.equal(String(created.confirmationStatus ?? ""), "DRAFT");
    assert.equal(Boolean(created.committedAtISO), false);
    assert.equal(isEntryEditable(created), true);

    const savedDraft = await updateEntry(ownerEmail, "workshops", entryId, {
      workshopName: "Workflow Workshop Draft Saved",
    });
    assert.equal(String(savedDraft.confirmationStatus ?? ""), "DRAFT");
    assert.equal(String(savedDraft.workshopName ?? ""), "Workflow Workshop Draft Saved");
    assert.equal(Boolean(savedDraft.committedAtISO), false);
    assert.equal(isEntryEditable(savedDraft), true);

    const committed = await commitDraft(ownerEmail, "workshops", entryId);
    assert.equal(String(committed.confirmationStatus ?? ""), "GENERATED");
    assert.equal(Boolean(committed.committedAtISO), true);
    assert.ok(committed.editWindowExpiresAt);
    assert.equal(isEntryEditable(committed), true);

    // Simulate PDF generation (sets pdfGenerated via normalizeEntryStreakFields)
    await updateEntry(ownerEmail, "workshops", entryId, {
      pdfGeneratedAt: new Date().toISOString(),
      pdfStale: false,
    } as Record<string, unknown>);

    const reopened = await updateEntry(ownerEmail, "workshops", entryId, {
      resourcePersonName: "Reopened Speaker",
    });
    assert.equal(String(reopened.confirmationStatus ?? ""), "GENERATED");
    assert.equal(Boolean(reopened.committedAtISO), true);
    assert.equal(String(reopened.resourcePersonName ?? ""), "Reopened Speaker");
    assert.equal(isEntryEditable(reopened), true);

    // Finalise the entry (required before requesting edit — only finalized entries)
    const finalized = await finalizeEntry(ownerEmail, "workshops", entryId);
    assert.equal(String(finalized.confirmationStatus ?? ""), "GENERATED");
    assert.equal(isEntryEditable(finalized), false);

    // Request edit after finalization
    const editRequested = await requestEdit(ownerEmail, "workshops", entryId);
    assert.equal(String(editRequested.confirmationStatus ?? ""), "EDIT_REQUESTED");
    assert.ok(editRequested.editRequestedAt);

    // Admin grants edit access
    const editGranted = await grantEditAccess(adminEmail, "workshops", ownerEmail, entryId);
    assert.equal(String(editGranted.confirmationStatus ?? ""), "EDIT_GRANTED");
    assert.ok(editGranted.editGrantedAt);
    assert.equal(String(editGranted.editGrantedBy ?? ""), adminEmail);
    assert.equal(isEntryEditable(editGranted), true);

    const built = await buildExportRows(ownerEmail, "workshops", [
      "id",
      "workshopName",
      "resourcePersonName",
      "confirmationStatus",
    ]);
    assert.equal(built.ok, true);
    if (!built.ok) return;

    assert.equal(built.data.rows.length, 1);
    assert.deepEqual(built.data.rows[0], [
      entryId,
      "Workflow Workshop Draft Saved",
      "Reopened Speaker",
      "EDIT_GRANTED",
    ]);
    assert.equal(built.data.countsByStatus.EDIT_GRANTED, 1);
    assert.equal(built.data.countsByStatus.DRAFT, 0);
  });
});

test("workflow smoke rejects request edit before generation", async () => {
  await withSandbox("workflow-smoke-precommit-edit-request", async () => {
    const created = await createEntry(ownerEmail, "workshops", buildCompleteWorkshopPayload());

    await assert.rejects(
      () => requestEdit(ownerEmail, "workshops", String(created.id)),
      /Entry must be generated before requesting edit access\./
    );

    assert.equal(String(created.confirmationStatus ?? ""), "DRAFT");
    assert.equal(isEntryEditable(created), true);
  });
});
