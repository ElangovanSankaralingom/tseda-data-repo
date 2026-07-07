import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { runInDemoUniverse } from "../../lib/demo/universe.ts";
import { upsertCategoryEntry } from "../../lib/dataStore.ts";
import { listFeedEvents } from "../../lib/feed/feedStore.ts";
import { backfillFeedIfNeeded } from "../../lib/feed/backfill.ts";
import { recordEntryMilestonesAwaited } from "../../lib/feed/feedEvents.ts";
import { readStoreRevision } from "../../lib/data/storeRevision.ts";
import { ensureUserIndex } from "../../lib/data/indexStore.ts";
import { runSyncReconcile } from "../../lib/jobs/syncReconcile.ts";
import { getUniverseDataRoot, getDataRoot } from "../../lib/userStore.ts";

/**
 * UNIVERSE ISOLATION — NEW STORES (2026-07 audit, Elan's item 3):
 * everything added this cycle must respect the demo/real boundary exactly
 * like the original stores do:
 *   - entry_committed feed events (practice entries NEVER reach the real
 *     Celebration Wall);
 *   - the feed backfill sweep + its versioned marker;
 *   - per-user store revisions (continuous-sync stamps);
 *   - the nightly syncReconcile (contextless → REAL universe only).
 */

const OWNER = "iso.faculty@tce.edu";

function committedEntry(id: string): Record<string, unknown> {
  return {
    id,
    confirmationStatus: "GENERATED",
    committedAtISO: "2026-06-15T09:00:00.000Z",
    academicYear: "Academic Year 2025-2026",
    semesterType: "EVEN",
    startDate: "2026-05-01",
    endDate: "2026-05-02",
    streakEligible: false,
    createdAt: "2026-06-15T09:00:00.000Z",
    updatedAt: "2026-06-15T09:00:00.000Z",
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

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

test("practice commits never reach the real Celebration Wall (and vice versa)", async () => {
  await withSandbox("iso-feed", async () => {
    // Demo-context commit + emission → demo wall only.
    await runInDemoUniverse(async () => {
      await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("demo-1"));
      await recordEntryMilestonesAwaited(OWNER, "fdp-attended", committedEntry("demo-1"));
      assert.equal((await listFeedEvents(50)).length, 1, "demo wall shows the practice entry");
    });
    assert.equal((await listFeedEvents(50)).length, 0, "REAL wall must stay empty");

    // Real-context commit → real wall only; demo wall unchanged.
    await upsertCategoryEntry(OWNER, "workshops", committedEntry("real-1"));
    await recordEntryMilestonesAwaited(OWNER, "workshops", committedEntry("real-1"));
    assert.equal((await listFeedEvents(50)).length, 1);
    await runInDemoUniverse(async () => {
      const demoEvents = await listFeedEvents(50);
      assert.equal(demoEvents.length, 1);
      assert.equal(demoEvents[0]?.id, "entry_committed:demo-1", "real event must not leak into demo");
    });
  });
});

test("backfill sweep + versioned marker stay inside their universe", async () => {
  await withSandbox("iso-backfill", async () => {
    // Entries in BOTH universes for the same user.
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("real-b1"));
    await runInDemoUniverse(async () => {
      await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("demo-b1"));
    });

    // Demo backfill: sweeps DEMO users only, marker lands under /demo.
    await runInDemoUniverse(async () => {
      await backfillFeedIfNeeded();
      const events = await listFeedEvents(50);
      assert.equal(events.length, 1);
      assert.equal(events[0]?.id, "entry_committed:demo-b1", "demo sweep sees demo entries only");
      assert.ok(
        await exists(path.join(process.cwd(), getUniverseDataRoot(), "feed", ".backfilled-v2")),
        "marker written in the demo universe",
      );
    });
    // Real universe: no marker yet, wall still empty.
    assert.equal(
      await exists(path.join(process.cwd(), getDataRoot(), "feed", ".backfilled-v2")),
      false,
      "real marker must not exist yet",
    );
    assert.equal((await listFeedEvents(50)).length, 0);

    // Real backfill: sees the REAL entry only.
    await backfillFeedIfNeeded();
    const realEvents = await listFeedEvents(50);
    assert.equal(realEvents.length, 1);
    assert.equal(realEvents[0]?.id, "entry_committed:real-b1", "real sweep never reads demo entries");
  });
});

test("store revisions and index healing are universe-scoped", async () => {
  await withSandbox("iso-rev", async () => {
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("real-r1"));
    const realRev = await readStoreRevision(OWNER);
    assert.ok(realRev > 0);

    await runInDemoUniverse(async () => {
      assert.equal(await readStoreRevision(OWNER), 0, "demo universe starts at rev 0");
      await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("demo-r1"));
      await upsertCategoryEntry(OWNER, "workshops", committedEntry("demo-r2"));
      // First read may rebuild more than once (creating missing category
      // stores bumps the revision mid-build — convergent by design); the
      // SECOND read is the steady state and must stamp the exact rev.
      await ensureUserIndex(OWNER);
      const demoIndex = await ensureUserIndex(OWNER);
      assert.ok(demoIndex.ok);
      assert.equal(demoIndex.data.totalsByCategory["fdp-attended"], 1);
      assert.equal(demoIndex.data.totalsByCategory["workshops"], 1);
      assert.equal(demoIndex.data.storeRev, await readStoreRevision(OWNER), "demo index stamps demo rev");
    });

    // Real revision untouched by the demo writes; real index sees real data only.
    assert.equal(await readStoreRevision(OWNER), realRev, "demo writes must not move the real revision");
    const realIndex = await ensureUserIndex(OWNER);
    assert.ok(realIndex.ok);
    assert.equal(realIndex.data.totalsByCategory["fdp-attended"], 1);
    assert.equal(realIndex.data.totalsByCategory["workshops"], 0, "demo entries invisible to the real index");
  });
});

test("contextless syncReconcile converges the REAL universe and never touches demo", async () => {
  await withSandbox("iso-reconcile", async () => {
    await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("real-s1"));
    await runInDemoUniverse(async () => {
      await upsertCategoryEntry(OWNER, "fdp-attended", committedEntry("demo-s1"));
    });

    // Nightly-style contextless run.
    const result = await runSyncReconcile();
    assert.ok(result.usersSwept >= 1);

    const realEvents = await listFeedEvents(50);
    assert.equal(realEvents.length, 1);
    assert.equal(realEvents[0]?.id, "entry_committed:real-s1");

    await runInDemoUniverse(async () => {
      assert.equal(
        (await listFeedEvents(50)).length,
        0,
        "reconcile must never write into the demo universe",
      );
    });
  });
});
