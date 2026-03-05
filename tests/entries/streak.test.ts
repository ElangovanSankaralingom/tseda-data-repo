import assert from "node:assert/strict";
import test from "node:test";
import { computeStreak, createEntry } from "../../lib/entryEngine.ts";
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
    assert.equal(summary.completed, 0);
    assert.equal(summary.byCategory.workshops.activated, 0);
    assert.equal(summary.byCategory.workshops.completed, 0);
  });
});

test("computeStreak counts activated and completed entries consistently", async () => {
  await withSandbox("streak-counts", async () => {
    await createEntry(ownerEmail, "workshops", {
      eventName: "Active streak workshop",
      streak: { activatedAtISO: "2026-03-05T10:00:00.000Z" },
    });
    await createEntry(ownerEmail, "workshops", {
      eventName: "Completed streak workshop",
      streak: {
        activatedAtISO: "2026-03-05T08:00:00.000Z",
        completedAtISO: "2026-03-05T09:00:00.000Z",
      },
    });
    await createEntry(ownerEmail, "fdp-attended", {
      eventName: "FDP completed streak",
      streak: {
        activatedAtISO: "2026-03-04T08:00:00.000Z",
        completedAtISO: "2026-03-04T09:00:00.000Z",
      },
    });

    const summary = await computeStreak(ownerEmail);
    assert.equal(summary.activated, 1);
    assert.equal(summary.completed, 2);
    assert.equal(summary.byCategory.workshops.activated, 1);
    assert.equal(summary.byCategory.workshops.completed, 1);
    assert.equal(summary.byCategory["fdp-attended"].completed, 1);
  });
});
