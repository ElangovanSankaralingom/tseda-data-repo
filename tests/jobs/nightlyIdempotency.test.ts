import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { runAutoArchive } from "../../lib/jobs/autoArchive.ts";
import { upsertCategoryEntry, readCategoryEntries } from "../../lib/dataStore.ts";
import { listQuarantine } from "../../lib/jobs/quarantine.ts";

/**
 * 2026-07 audit gap: the nightly job had no run-twice coverage. If the cron
 * fires twice in one night (retry, manual + scheduled overlap), destructive
 * verdicts must apply exactly once — the second pass must be a no-op, not a
 * second quarantine or an error on already-removed entries.
 */

const OWNER = "faculty.nightly@tce.edu";
const CATEGORY = "workshops";

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysAgoDateISO(days: number): string {
  return daysAgoISO(days).slice(0, 10);
}

test("nightly auto-archive is idempotent: expired incomplete entry is deleted exactly once", async () => {
  const sandbox = await createTestDataRoot("nightly-idempotency");
  try {
    // Expired, incomplete, GENERATED entry → autoAction = delete (quarantine).
    await upsertCategoryEntry(OWNER, CATEGORY, {
      id: "idem-entry-1",
      workshopName: "Expired incomplete workshop",
      confirmationStatus: "GENERATED",
      committedAtISO: daysAgoISO(10),
      generatedAt: daysAgoISO(10),
      editWindowExpiresAt: daysAgoISO(2),
      startDate: daysAgoDateISO(12),
      endDate: daysAgoDateISO(11),
      pdfGenerated: true,
    });

    // First run: the verdict fires once.
    const first = await runAutoArchive();
    assert.ok(first.ok, "first nightly pass must succeed");
    assert.equal(first.data.deleted, 1, "expired incomplete entry must be removed on pass 1");

    const afterFirst = await readCategoryEntries(OWNER, CATEGORY);
    assert.equal(afterFirst.length, 0, "entry must be gone from the live store");

    const quarantinedOnce = await listQuarantine();
    assert.equal(quarantinedOnce.length, 1, "exactly one quarantine bundle after pass 1");

    // Second run: nothing left to act on — no error, no double effects.
    const second = await runAutoArchive();
    assert.ok(second.ok, "second nightly pass must not fail on already-removed entries");
    assert.equal(second.data.deleted, 0, "pass 2 must not delete again");
    assert.equal(second.data.archived, 0, "pass 2 must not archive anything new");

    const quarantinedTwice = await listQuarantine();
    assert.equal(
      quarantinedTwice.length,
      1,
      "pass 2 must not create a second quarantine bundle",
    );
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
});
