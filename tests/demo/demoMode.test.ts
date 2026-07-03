import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  isDemoContext,
  runInDemoUniverse,
  universeRoot,
} from "../../lib/demo/universe.ts";
import { assertDemoPath, wipeOwnDemoData } from "../../lib/demo/wipe.ts";
import {
  enterDemoMode,
  exitDemoMode,
  getDemoState,
  isDemoActive,
  isDemoParticipant,
  resetDemoStateCache,
  setDemoRoster,
} from "../../lib/demo/state.ts";
import { runDemoCleanup } from "../../lib/jobs/demoCleanup.ts";
import { upsertCategoryEntry, readCategoryEntries } from "../../lib/dataStore.ts";
import { appendFeedEvent, listFeedEvents } from "../../lib/feed/feedStore.ts";
import { addNotification, getNotifications } from "../../lib/confirmations/notificationStore.ts";
import { createEntry, commitDraft, listEntriesForCategory } from "../../lib/entries/lifecycle.ts";
import { addFaculty } from "../../lib/admin/facultyRegistry.ts";
import { MASTER_ADMIN_EMAILS } from "../../lib/admin.ts";
import { getDataRoot, getUserStoreDir } from "../../lib/userStore.ts";
import { addDaysISO, nowISTDateISO } from "../../lib/time.ts";

/**
 * DEMO MODE GUARDS — the three promises of the feature:
 * 1. ISOLATION: nothing written in demo mode ever touches real stores
 *    (entries, feed, notifications) and vice versa.
 * 2. WIPE SAFETY: demo deletion can never point at real data — the path
 *    guard throws before rm.
 * 3. LIFECYCLE: exit wipes the user's demo data; last-out wipes the
 *    universe; stale sessions expire via the nightly sweep; permissions
 *    are enforced server-side.
 */

const MASTER = MASTER_ADMIN_EMAILS[0];
const FACULTY = "demo.faculty@tce.edu";
const STRANGER = "demo.stranger@tce.edu";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  resetDemoStateCache();
  try {
    return await run();
  } finally {
    resetDemoStateCache();
    sandbox.restore();
    await sandbox.cleanup();
  }
}

function demoUsersDir(): string {
  return path.join(process.cwd(), getDataRoot(), "demo", "users");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

test("universe context: paths fork under /demo only inside the context", () => {
  assert.equal(isDemoContext(), false);
  assert.equal(universeRoot(".data"), ".data");
  runInDemoUniverse(() => {
    assert.equal(isDemoContext(), true);
    assert.equal(universeRoot(".data"), path.join(".data", "demo"));
    assert.ok(getUserStoreDir(FACULTY).includes(`${path.sep}demo${path.sep}`));
  });
  assert.equal(isDemoContext(), false, "context must not leak out of run()");
  assert.ok(!getUserStoreDir(FACULTY).includes(`${path.sep}demo${path.sep}`));
});

test("wipe guard: refuses every path outside the demo universe", async () => {
  await withSandbox("demo-wipe-guard", async () => {
    const root = path.join(process.cwd(), getDataRoot());
    assert.throws(() => assertDemoPath(root), /Refusing/);
    assert.throws(() => assertDemoPath(path.join(root, "users")), /Refusing/);
    assert.throws(() => assertDemoPath(path.join(root, "users", "x@tce.edu")), /Refusing/);
    assert.throws(() => assertDemoPath("/etc"), /Refusing/);
    // A "demo" segment elsewhere in the tree is NOT enough.
    assert.throws(() => assertDemoPath(path.join(root, "users", "demo")), /Refusing/);
    // Real demo paths pass.
    assert.doesNotThrow(() => assertDemoPath(path.join(root, "demo")));
    assert.doesNotThrow(() => assertDemoPath(path.join(root, "demo", "users", "x")));
  });
});

test("isolation: demo writes are invisible in real stores (entries, feed, notifications)", async () => {
  await withSandbox("demo-isolation", async () => {
    // Real entry first.
    await upsertCategoryEntry(FACULTY, "workshops", {
      id: "real-1",
      workshopName: "Real workshop",
    });

    await runInDemoUniverse(async () => {
      await upsertCategoryEntry(FACULTY, "workshops", {
        id: "demo-1",
        workshopName: "Demo workshop",
      });
      await appendFeedEvent({ id: "demo-feed-1", type: "streak_started", actorEmail: FACULTY });
      await addNotification(FACULTY, {
        type: "shared_entry",
        title: "Demo notification",
        message: "only in demo",
      } as never);

      // Inside demo: sees ONLY demo data.
      const demoEntries = await readCategoryEntries(FACULTY, "workshops");
      assert.deepEqual(demoEntries.map((e) => e.id), ["demo-1"]);
      assert.equal((await listFeedEvents()).length, 1);
      assert.equal((await getNotifications(FACULTY)).length, 1);
    });

    // Outside demo: real data only, no demo residue anywhere.
    const realEntries = await readCategoryEntries(FACULTY, "workshops");
    assert.deepEqual(realEntries.map((e) => e.id), ["real-1"]);
    assert.equal((await listFeedEvents()).length, 0, "real feed must not see demo milestones");
    assert.equal((await getNotifications(FACULTY)).length, 0, "real notifications must stay empty");
  });
});

test("fan-out containment: collaboration copies stay inside the demo universe", async () => {
  await withSandbox("demo-fanout", async () => {
    addFaculty(FACULTY, "Demo Partner", MASTER);
    const today = nowISTDateISO();

    await runInDemoUniverse(async () => {
      const created = await createEntry(MASTER, "workshops", {
        academicYear: "2026-2027",
        semesterType: "ODD",
        level: "National",
        mode: "Offline",
        startDate: addDaysISO(today, 2),
        endDate: addDaysISO(today, 5),
        workshopName: "Demo collab workshop",
        resourcePersonName: "Dr. Demo",
        resourcePersonDesignation: "Professor",
        resourcePersonOrganisation: "TCE",
        coCoordinators: [{ id: "r1", name: "Demo Partner", email: FACULTY }],
      } as never);
      await commitDraft(MASTER, "workshops", String(created.id));

      const demoCopies = await listEntriesForCategory(FACULTY, "workshops");
      assert.equal(demoCopies.length, 1, "recipient must get the copy inside demo");
    });

    // The recipient's REAL store never saw the fan-out.
    assert.equal((await listEntriesForCategory(FACULTY, "workshops")).length, 0);
    assert.equal((await listEntriesForCategory(MASTER, "workshops")).length, 0);
  });
});

test("permissions: only master admins and assigned faculty may enter", async () => {
  await withSandbox("demo-permissions", async () => {
    assert.equal(await isDemoParticipant(MASTER), true, "master admin always permitted");
    assert.equal(await isDemoParticipant(STRANGER), false);
    await assert.rejects(() => enterDemoMode(STRANGER), /Not permitted/);

    // Assignment flows through the roster (registry-validated).
    addFaculty(FACULTY, "Demo Faculty", MASTER);
    await setDemoRoster([FACULTY, "not.in.registry@tce.edu"], MASTER);
    const state = await getDemoState();
    assert.deepEqual(state.roster, [FACULTY], "non-registry emails are dropped");
    assert.equal(await isDemoParticipant(FACULTY), true);
    await enterDemoMode(FACULTY);
    assert.equal(await isDemoActive(FACULTY), true);

    // Removing an active member exits them and wipes their demo subtree.
    await runInDemoUniverse(() =>
      upsertCategoryEntry(FACULTY, "workshops", { id: "d1", workshopName: "W" }),
    );
    await setDemoRoster([], MASTER);
    assert.equal(await isDemoActive(FACULTY), false);
    assert.equal(await isDemoParticipant(FACULTY), false);
    await runInDemoUniverse(async () => {
      assert.equal((await readCategoryEntries(FACULTY, "workshops")).length, 0);
    });
  });
});

test("exit wipes own demo data; last-out wipes the whole universe; real data survives", async () => {
  await withSandbox("demo-exit-wipe", async () => {
    await upsertCategoryEntry(MASTER, "workshops", { id: "real-keep", workshopName: "Keep me" });

    await enterDemoMode(MASTER);
    await runInDemoUniverse(async () => {
      await upsertCategoryEntry(MASTER, "workshops", { id: "demo-gone", workshopName: "Wipe me" });
      await appendFeedEvent({ id: "demo-feed-x", type: "streak_started", actorEmail: MASTER });
    });
    assert.ok(await exists(demoUsersDir()), "demo tree exists while active");

    await exitDemoMode(MASTER);
    assert.equal(await isDemoActive(MASTER), false);
    // Last participant left → entire demo universe removed (incl. feed).
    assert.equal(await exists(path.join(process.cwd(), getDataRoot(), "demo")), false);

    // Real data untouched.
    const real = await readCategoryEntries(MASTER, "workshops");
    assert.deepEqual(real.map((e) => e.id), ["real-keep"]);
  });
});

test("nightly sweep: stale sessions expire, orphans wiped, live sessions survive", async () => {
  await withSandbox("demo-nightly", async () => {
    // MASTER stale (25h), FACULTY fresh — write state directly, drop cache.
    const statePath = path.join(process.cwd(), getDataRoot(), "demo-mode.json");
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(
      statePath,
      JSON.stringify({
        version: 1,
        roster: [FACULTY],
        active: {
          [MASTER]: { activatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
          [FACULTY]: { activatedAt: new Date().toISOString() },
        },
      }),
    );
    resetDemoStateCache();

    await runInDemoUniverse(async () => {
      await upsertCategoryEntry(MASTER, "workshops", { id: "stale", workshopName: "Stale" });
      await upsertCategoryEntry(FACULTY, "workshops", { id: "live", workshopName: "Live" });
      // Orphan subtree: demo data for a user who is not active at all
      // (e.g. a fan-out copy for a colleague who never entered demo).
      await upsertCategoryEntry(STRANGER, "workshops", { id: "orphan", workshopName: "Orphan" });
    });

    const result = await runDemoCleanup();
    assert.equal(result.expiredSessions, 1, "stale master session must expire");
    assert.ok(result.orphanedSubtreesWiped >= 1, "orphan subtree must be wiped");
    assert.equal(result.universeWiped, false, "FACULTY still active → universe survives");

    const state = await getDemoState();
    assert.deepEqual(Object.keys(state.active), [FACULTY]);
    await runInDemoUniverse(async () => {
      assert.equal((await readCategoryEntries(FACULTY, "workshops")).length, 1, "live survives");
      assert.equal((await readCategoryEntries(MASTER, "workshops")).length, 0, "stale wiped");
      assert.equal((await readCategoryEntries(STRANGER, "workshops")).length, 0, "orphan wiped");
    });

    // Second sweep after the last participant exits → universe gone.
    await exitDemoMode(FACULTY);
    assert.equal(await exists(path.join(process.cwd(), getDataRoot(), "demo")), false);
  });
});

test("wipeOwnDemoData never touches the real user store", async () => {
  await withSandbox("demo-wipe-scope", async () => {
    await upsertCategoryEntry(FACULTY, "workshops", { id: "real-2", workshopName: "Real" });
    await runInDemoUniverse(() =>
      upsertCategoryEntry(FACULTY, "workshops", { id: "demo-2", workshopName: "Demo" }),
    );

    await wipeOwnDemoData(FACULTY);

    assert.equal((await readCategoryEntries(FACULTY, "workshops")).length, 1, "real survives");
    await runInDemoUniverse(async () => {
      assert.equal((await readCategoryEntries(FACULTY, "workshops")).length, 0, "demo wiped");
    });
  });
});
