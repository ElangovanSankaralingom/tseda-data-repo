import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  commitDraft,
  createEntry,
  deleteEntry,
} from "../../lib/entries/lifecycle.ts";
import { ensureUserIndex } from "../../lib/data/indexStore.ts";
import { getUserStoreDir } from "../../lib/userStore.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const ownerEmail = "faculty.index@tce.edu";

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
    eventName: "Index Workshop",
    speakerName: "Speaker",
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

test("ensureUserIndex creates index.json from category files when missing", async () => {
  await withSandbox("index-store-create", async () => {
    await createEntry(ownerEmail, "workshops", {
      eventName: "Index Seed Entry",
    });

    const ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;

    const indexPath = path.join(getUserStoreDir(ownerEmail), "index.json");
    await fs.access(indexPath);

    assert.equal(ensured.data.totalsByCategory.workshops, 1);
    assert.equal(ensured.data.countsByStatus.DRAFT, 1);
  });
});

test("entry generation updates index counts", async () => {
  await withSandbox("index-store-status", async () => {
    const created = await createEntry(ownerEmail, "workshops", buildCompleteWorkshopPayload());

    await commitDraft(ownerEmail, "workshops", String(created.id));
    let ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;
    assert.equal(ensured.data.countsByStatus.GENERATED, 1);
    // Entry has past endDate and no streakEligible flag — not counted by streak system
    assert.equal(ensured.data.streakSnapshot.streakActivatedCount, 0);
    assert.equal(ensured.data.streakSnapshot.streakWinsCount, 0);
    assert.equal(ensured.data.streakSnapshot.byCategory.workshops.activated, 0);
    assert.equal(ensured.data.streakSnapshot.byCategory.workshops.wins, 0);
  });
});

test("deleteEntry updates index totals without rebuilding manually", async () => {
  await withSandbox("index-store-delete", async () => {
    const created = await createEntry(ownerEmail, "workshops", {
      eventName: "Index Delete Entry",
    });

    let ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;
    assert.equal(ensured.data.totalsByCategory.workshops, 1);

    await deleteEntry(ownerEmail, "workshops", String(created.id));
    ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;
    assert.equal(ensured.data.totalsByCategory.workshops, 0);
    assert.equal(ensured.data.countsByStatus.DRAFT, 0);
  });
});
