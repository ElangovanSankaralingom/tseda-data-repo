import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelEditRequest,
  commitDraft,
  createEntry,
  deleteEntry,
  finalizeEntry,
  requestEdit,
  updateEntry,
} from "../../lib/entries/lifecycle.ts";
import { isEntryEditable } from "../../lib/entries/lock.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

/**
 * S1 regression tests (TECH-AUDIT-2026-06 C3): `permanentlyLocked` must be
 * enforced by the ENGINE write path — not just hidden buttons in the UI.
 * A crafted PATCH/DELETE against a locked entry must be rejected.
 */

const ownerEmail = "faculty.lock@tce.edu";

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
    workshopName: "Lock Enforcement Workshop",
    resourcePersonName: "Speaker",
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

async function createPermanentlyLockedEntry(): Promise<string> {
  const created = await createEntry(ownerEmail, "workshops", buildCompleteWorkshopPayload());
  const id = String((created as Record<string, unknown>).id);
  await commitDraft(ownerEmail, "workshops", id);
  // Simulate PDF generation before finalise (same pattern as wal.test.ts)
  await updateEntry(ownerEmail, "workshops", id, {
    pdfGeneratedAt: new Date().toISOString(),
    pdfStale: false,
  } as Record<string, unknown>);
  await finalizeEntry(ownerEmail, "workshops", id);
  // Real workflow path to a terminal lock: request edit, then cancel it.
  await requestEdit(ownerEmail, "workshops", id, "lock test");
  const cancelled = await cancelEditRequest(ownerEmail, "workshops", id);
  assert.equal(
    (cancelled as Record<string, unknown>).permanentlyLocked,
    true,
    "cancelling an edit request must permanently lock the entry",
  );
  return id;
}

test("engine rejects updateEntry on a permanently locked entry", async () => {
  await withSandbox("lock-update", async () => {
    const id = await createPermanentlyLockedEntry();
    await assert.rejects(
      updateEntry(ownerEmail, "workshops", id, { workshopName: "Sneaky rename" }),
      (error: unknown) =>
        String((error as { code?: string }).code) === "FORBIDDEN" ||
        /permanently locked/i.test(String((error as Error).message)),
    );
  });
});

test("engine rejects user deleteEntry on a permanently locked entry", async () => {
  await withSandbox("lock-delete", async () => {
    const id = await createPermanentlyLockedEntry();
    await assert.rejects(
      deleteEntry(ownerEmail, "workshops", id),
      (error: unknown) =>
        String((error as { code?: string }).code) === "FORBIDDEN" ||
        /permanently locked/i.test(String((error as Error).message)),
    );
  });
});

test("isEntryEditable honors permanentlyLocked regardless of status", () => {
  assert.equal(isEntryEditable({ confirmationStatus: "DRAFT", permanentlyLocked: true }), false);
  assert.equal(isEntryEditable({ confirmationStatus: "DRAFT" }), true);
});
