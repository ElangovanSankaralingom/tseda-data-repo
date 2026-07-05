import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { upsertCategoryEntry } from "../../lib/dataStore.ts";
import { listFeedEvents } from "../../lib/feed/feedStore.ts";
import { backfillFeedIfNeeded } from "../../lib/feed/backfill.ts";
import { collectEntryMilestoneEvents } from "../../lib/feed/feedEvents.ts";

/**
 * FEED BACKFILL GUARDS (Elan's "Department Pulse shows no data", round 2):
 * committed entries that were never streak-eligible (past-dated permission
 * entries — the everyday case) MUST reach the wall as entry_committed
 * events, with timestamps taken from the entry (honest chronology), and the
 * sweep must be idempotent + awaited (same request sees the events).
 */

const OWNER = "pulse.faculty@tce.edu";

function committedPastEntry(id: string): Record<string, unknown> {
  return {
    id,
    confirmationStatus: "GENERATED",
    committedAtISO: "2026-06-01T09:00:00.000Z",
    academicYear: "Academic Year 2025-2026",
    semesterType: "EVEN",
    // Past-dated → never streak eligible → no streak fields qualify.
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    streakEligible: false,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-01T09:00:00.000Z",
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

test("collectEntryMilestoneEvents: committed but never-eligible → entry_committed with entry timestamp", () => {
  const events = collectEntryMilestoneEvents(OWNER, "fdp-attended", committedPastEntry("e-past"));
  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "entry_committed");
  assert.equal(events[0]?.id, "entry_committed:e-past");
  assert.equal(events[0]?.categoryKey, "fdp-attended");
  assert.equal(events[0]?.createdAt, "2026-06-01T09:00:00.000Z");
});

test("collectEntryMilestoneEvents: drafts and archived entries stay off the wall", () => {
  const draft = { ...committedPastEntry("e-draft"), confirmationStatus: "DRAFT", committedAtISO: undefined };
  assert.equal(collectEntryMilestoneEvents(OWNER, "fdp-attended", draft).length, 0);

  const archived = { ...committedPastEntry("e-arch"), confirmationStatus: "ARCHIVED" };
  assert.equal(collectEntryMilestoneEvents(OWNER, "fdp-attended", archived).length, 0);
});

test("backfill sweeps committed entries onto the wall, awaited and idempotent", async () => {
  await withSandbox("feed-backfill", async () => {
    await upsertCategoryEntry(OWNER, "fdp-attended", committedPastEntry("e1"));
    await upsertCategoryEntry(OWNER, "fdp-attended", committedPastEntry("e2"));
    await upsertCategoryEntry(OWNER, "workshops", committedPastEntry("e3"));

    // First load: sweep runs AND the same call sees the events (awaited).
    await backfillFeedIfNeeded();
    const events = await listFeedEvents(50);
    assert.equal(events.length, 3, "all committed entries reach the wall");
    assert.ok(events.every((e) => e.type === "entry_committed"));

    // Second load: marker short-circuits; re-running never double-posts.
    await backfillFeedIfNeeded();
    assert.equal((await listFeedEvents(50)).length, 3);
  });
});

test("backfill never feeds DLC department records", async () => {
  await withSandbox("feed-backfill-dlc", async () => {
    await upsertCategoryEntry(OWNER, "student-placements", committedPastEntry("dlc1"));
    await backfillFeedIfNeeded();
    assert.equal((await listFeedEvents(50)).length, 0);
  });
});
