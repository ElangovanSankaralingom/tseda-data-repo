import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { upsertCategoryEntry } from "../../lib/dataStore.ts";
import { readStoreRevision } from "../../lib/data/storeRevision.ts";
import { ensureUserIndex } from "../../lib/data/indexStore.ts";
import { runSyncReconcile } from "../../lib/jobs/syncReconcile.ts";
import { listFeedEvents, removeFeedEvent } from "../../lib/feed/feedStore.ts";
import { getUniverseDataRoot } from "../../lib/userStore.ts";

/**
 * CONTINUOUS-SYNC STRATEGY GUARDS (2026-07, Elan's ruling): sync must not
 * depend on every mutation path remembering its refresh call. Three layers:
 * write-time refresh (existing), READ-TIME drift healing (store revision),
 * and the NIGHTLY reconcile. These tests inject drift on purpose and assert
 * the system converges.
 */

const OWNER = "sync.faculty@tce.edu";

function committedEntry(id: string): Record<string, unknown> {
  return {
    id,
    confirmationStatus: "GENERATED",
    committedAtISO: "2026-06-10T09:00:00.000Z",
    academicYear: "Academic Year 2025-2026",
    semesterType: "EVEN",
    startDate: "2026-05-01",
    endDate: "2026-05-02",
    streakEligible: false,
    createdAt: "2026-06-10T09:00:00.000Z",
    updatedAt: "2026-06-10T09:00:00.000Z",
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

test("store revision bumps monotonically on every entry write", async () => {
  await withSandbox("sync-rev", async () => {
    assert.equal(await readStoreRevision(OWNER), 0, "fresh user starts at 0");
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("r1"));
    const afterFirst = await readStoreRevision(OWNER);
    assert.ok(afterFirst > 0, "first write bumps");
    await upsertCategoryEntry(OWNER, "workshops", committedEntry("r2"));
    const afterSecond = await readStoreRevision(OWNER);
    assert.ok(afterSecond > afterFirst, "every write moves the revision forward");
  });
});

test("read-time heal: a write that skipped the index refresh is healed on the next read", async () => {
  await withSandbox("sync-heal", async () => {
    // Establish a healthy index for one entry.
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("h1"));
    const first = await ensureUserIndex(OWNER);
    assert.ok(first.ok);
    assert.equal(first.data.totalsByCategory["fdp-attended"], 1);

    // DRIFT INJECTION: write straight to the store — the exact shape of a
    // mutation path that forgot refreshIndexForMutation. The choke point
    // bumps the revision; nobody updates the index.
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("h2"));

    // The next read detects the stale revision and rebuilds from the store.
    const healed = await ensureUserIndex(OWNER);
    assert.ok(healed.ok);
    assert.equal(healed.data.totalsByCategory["fdp-attended"], 2, "drift healed on read");
    assert.equal(healed.data.storeRev, await readStoreRevision(OWNER), "revision re-stamped");

    // And once healed, the next read is a plain hit (same rev, same counts).
    const stable = await ensureUserIndex(OWNER);
    assert.ok(stable.ok);
    assert.equal(stable.data.totalsByCategory["fdp-attended"], 2);
  });
});

test("nightly reconcile heals feed drift and rebuilds indexes", async () => {
  await withSandbox("sync-nightly", async () => {
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("n1"));

    // First reconcile: entry lands on the wall + index rebuilt.
    const first = await runSyncReconcile();
    assert.ok(first.usersSwept >= 1);
    assert.ok(first.indexesRebuilt >= 1);
    let events = await listFeedEvents(50);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "entry_committed:n1");

    // DRIFT INJECTION: the feed file is blanked (corruption, bad deploy).
    const feedFile = path.join(process.cwd(), getUniverseDataRoot(), "feed", "activity.json");
    await fs.writeFile(feedFile, JSON.stringify({ version: 1, events: [] }), "utf8");
    assert.equal((await listFeedEvents(50)).length, 0);

    // The nightly sweep converges the wall back to the truth.
    await runSyncReconcile();
    events = await listFeedEvents(50);
    assert.equal(events.length, 1, "reconcile restored the earned event");
    assert.equal(events[0]?.createdAt, "2026-06-10T09:00:00.000Z", "honest timestamp");
  });
});

test("moderation is final: reconcile never resurrects a master-removed card", async () => {
  await withSandbox("sync-moderation", async () => {
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("m1"));
    await runSyncReconcile();
    assert.equal((await listFeedEvents(50)).length, 1);

    // Master admin removes the card — a tombstone is kept.
    assert.equal(await removeFeedEvent("entry_committed:m1"), true);
    assert.equal((await listFeedEvents(50)).length, 0);

    // Neither the sweep nor live re-emission may bring it back.
    await runSyncReconcile();
    assert.equal((await listFeedEvents(50)).length, 0, "tombstone respected");
  });
});
