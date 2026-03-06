import assert from "node:assert/strict";
import test from "node:test";
import {
  approveEntry,
  computeStreak,
  createEntry,
  sendForConfirmation,
} from "../../lib/entries/lifecycle.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const ownerEmail = "faculty.streak@tce.edu";
const adminEmail = "senarch@tce.edu";

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
    await createEntry(ownerEmail, "workshops", {
      academicYear: "2025-2026",
      semesterType: "Odd",
      startDate: "2026-03-01",
      endDate: "2026-03-02",
      eventName: "Active streak workshop",
      speakerName: "Speaker Active",
      organisationName: "Org Active",
      uploads: {
        permissionLetter: { storedPath: "uploads/workshops/active-permission.pdf" },
        brochure: { storedPath: "uploads/workshops/active-brochure.pdf" },
        attendance: { storedPath: "uploads/workshops/active-attendance.pdf" },
        organiserProfile: { storedPath: "uploads/workshops/active-profile.pdf" },
        geotaggedPhotos: [{ storedPath: "uploads/workshops/active-photo.jpg" }],
      },
      status: "final",
    });

    const workshopWin = await createEntry(ownerEmail, "workshops", {
      academicYear: "2025-2026",
      semesterType: "Odd",
      startDate: "2026-03-03",
      endDate: "2026-03-04",
      eventName: "Won streak workshop",
      speakerName: "Speaker Won",
      organisationName: "Org Won",
      uploads: {
        permissionLetter: { storedPath: "uploads/workshops/win-permission.pdf" },
        brochure: { storedPath: "uploads/workshops/win-brochure.pdf" },
        attendance: { storedPath: "uploads/workshops/win-attendance.pdf" },
        organiserProfile: { storedPath: "uploads/workshops/win-profile.pdf" },
        geotaggedPhotos: [{ storedPath: "uploads/workshops/win-photo.jpg" }],
      },
      status: "final",
    });
    await sendForConfirmation(ownerEmail, "workshops", String(workshopWin.id));
    await approveEntry(adminEmail, "workshops", ownerEmail, String(workshopWin.id));

    const fdpWin = await createEntry(ownerEmail, "fdp-attended", {
      academicYear: "2025-2026",
      semesterType: "Odd",
      startDate: "2026-03-05",
      endDate: "2026-03-06",
      programName: "FDP Won",
      organisingBody: "TCE",
      permissionLetter: { storedPath: "uploads/fdp/win-permission.pdf" },
      completionCertificate: { storedPath: "uploads/fdp/win-certificate.pdf" },
      status: "final",
    });
    await sendForConfirmation(ownerEmail, "fdp-attended", String(fdpWin.id));
    await approveEntry(adminEmail, "fdp-attended", ownerEmail, String(fdpWin.id));

    const summary = await computeStreak(ownerEmail);
    assert.equal(summary.activated, 1);
    assert.equal(summary.wins, 2);
    assert.equal(summary.byCategory.workshops.activated, 1);
    assert.equal(summary.byCategory.workshops.wins, 1);
    assert.equal(summary.byCategory["fdp-attended"].wins, 1);
  });
});
