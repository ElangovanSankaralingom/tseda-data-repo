import assert from "node:assert/strict";
import test from "node:test";
import {
  commitDraft,
  computeStreak,
  createEntry,
} from "../../lib/entries/lifecycle.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const ownerEmail = "faculty.streak@tce.edu";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("computeStreak returns zeroed numeric summary for empty data", async () => {
  await withSandbox("streak-empty", async () => {
    const summary = await computeStreak(ownerEmail);
    assert.equal(summary.activated, 0);
    assert.equal(summary.wins, 0);
    assert.equal(summary.byCategory.workshops.activated, 0);
    assert.equal(summary.byCategory.workshops.wins, 0);
  });
});

test("computeStreak counts activated and wins entries consistently", async () => {
  await withSandbox("streak-counts", async () => {
    const activeEntry = await createEntry(ownerEmail, "workshops", {
      academicYear: "2025-2026",
      semesterType: "ODD",
      level: "National",
      mode: "Offline",
      startDate: "2026-03-01",
      endDate: "2026-03-02",
      workshopName: "Active streak workshop",
      resourcePersonName: "Speaker Active",
      resourcePersonDesignation: "Professor",
      resourcePersonOrganisation: "Org Active",
      permissionLetter: [{ storedPath: "uploads/workshops/active-permission.pdf" }],
      geotaggedPhotos: [{ storedPath: "uploads/workshops/active-photo.jpg" }],
      attendanceSheet: [{ storedPath: "uploads/workshops/active-attendance.pdf" }],
      officialPoster: [{ storedPath: "uploads/workshops/active-poster.pdf" }],
    });
    await commitDraft(ownerEmail, "workshops", String(activeEntry.id));

    const workshopWin = await createEntry(ownerEmail, "workshops", {
      academicYear: "2025-2026",
      semesterType: "ODD",
      level: "National",
      mode: "Offline",
      startDate: "2026-03-03",
      endDate: "2026-03-04",
      workshopName: "Won streak workshop",
      resourcePersonName: "Speaker Won",
      resourcePersonDesignation: "Professor",
      resourcePersonOrganisation: "Org Won",
      permissionLetter: [{ storedPath: "uploads/workshops/win-permission.pdf" }],
      geotaggedPhotos: [{ storedPath: "uploads/workshops/win-photo.jpg" }],
      attendanceSheet: [{ storedPath: "uploads/workshops/win-attendance.pdf" }],
      officialPoster: [{ storedPath: "uploads/workshops/win-poster.pdf" }],
    });
    await commitDraft(ownerEmail, "workshops", String(workshopWin.id));

    const fdpWin = await createEntry(ownerEmail, "fdp-attended", {
      academicYear: "2025-2026",
      semesterType: "ODD",
      level: "National",
      mode: "Online",
      startDate: "2026-03-05",
      endDate: "2026-03-06",
      programName: "FDP Won",
      organisingBody: "TCE",
      sponsored: "No",
      permissionLetter: [{ storedPath: "uploads/fdp/win-permission.pdf" }],
      completionCertificate: [{ storedPath: "uploads/fdp/win-certificate.pdf" }],
    });
    await commitDraft(ownerEmail, "fdp-attended", String(fdpWin.id));

    const summary = await computeStreak(ownerEmail);
    // All entries have past end dates and no streakEligible flag set,
    // so none are counted by the streak system.
    assert.equal(summary.activated, 0);
    assert.equal(summary.wins, 0);
    assert.equal(summary.byCategory.workshops.activated, 0);
    assert.equal(summary.byCategory.workshops.wins, 0);
    assert.equal(summary.byCategory["fdp-attended"].activated, 0);
    assert.equal(summary.byCategory["fdp-attended"].wins, 0);
  });
});
