import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { appendFeedEvent, listFeedEvents, toggleReaction, syncEntryFeedEvents } from "../../lib/feed/feedStore.ts";
import {
  collectEntryMilestoneEvents,
  recordEntryMilestonesAwaited,
  reconcileEntryFeedPresence,
} from "../../lib/feed/feedEvents.ts";
import type { CategoryKey } from "../../lib/entries/types.ts";

/**
 * FEED EMISSION LOGIC PASS (Elan's audit item 5, 2026-07).
 * The emission pipeline in one picture:
 *
 *   entry state ──collectEntryMilestoneEvents──▶ EARNED SET (pure)
 *   live action ──recordEntryMilestones(Awaited)──▶ append (id-deduped)
 *   any lifecycle turn ──reconcileEntryFeedPresence──▶ syncEntryFeedEvents
 *       (wall := exactly the earned set; kept cards keep reactions/time)
 *
 * These tests pin the truth table (state → earned set), idempotency under
 * concurrency, strip/restore behavior, reaction preservation, and the
 * once-ever semantics of win-count milestones.
 */

const OWNER = "logic.faculty@tce.edu";
const CAT = "fdp-attended" as CategoryKey; // permission flow
const REC = "journal-publications" as CategoryKey; // record flow

/** Permission-flow entry shapes along the lifecycle. */
function permissionEntry(id: string, phase: "activated" | "won" | "archived" | "restored-no-streak" | "past-committed"): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id,
    academicYear: "Academic Year 2025-2026",
    semesterType: "EVEN",
    programName: "Emission Logic FDP",
    organisingBody: "TCE",
    level: "National",
    mode: "Online",
    sponsored: "No",
    startDate: "2026-07-20",
    endDate: "2026-07-22",
    committedAtISO: "2026-06-01T09:00:00.000Z",
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-01T09:00:00.000Z",
    streakEligible: true,
    pdfGenerated: true,
    pdfMeta: { url: "/api/entry-file?p=x", fileName: "letter.pdf" },
    pdfStale: false,
    streak: { activatedAtISO: "2026-06-01T09:00:00.000Z", dueAtISO: null, completedAtISO: null, windowDays: 5 },
  };
  switch (phase) {
    case "activated":
      // GENERATED with a LIVE edit window → mid-journey, not finalized.
      return { ...base, confirmationStatus: "GENERATED", editWindowExpiresAt: "2099-01-01T00:00:00.000Z" };
    case "won":
      // Window expired → finalized; fresh PDF; data complete ⇒ WON.
      return {
        ...base,
        confirmationStatus: "GENERATED",
        permanentlyLocked: true,
        editWindowExpiresAt: "2026-06-03T09:00:00.000Z",
        doneAt: "2026-06-03T09:00:00.000Z",
        streak: { ...(base.streak as object), completedAtISO: "2026-06-03T09:00:00.000Z" },
      };
    case "archived":
      return { ...base, confirmationStatus: "ARCHIVED" };
    case "restored-no-streak":
      // engineAdmin.restoreEntry semantics: back to GENERATED but streak
      // permanently removed → no streak cards, still a committed record.
      return { ...base, confirmationStatus: "GENERATED", streakPermanentlyRemoved: true };
    case "past-committed":
      return { ...base, streakEligible: false, confirmationStatus: "GENERATED" };
  }
}

function recordEntry(id: string, status: "GENERATED" | "EDIT_REQUESTED"): Record<string, unknown> {
  return {
    id,
    entryFlow: "record",
    confirmationStatus: status,
    committedAtISO: "2026-06-10T09:00:00.000Z",
    academicYear: "Academic Year 2025-2026",
    semesterType: "EVEN",
    streakEligible: true,
    createdAt: "2026-06-10T09:00:00.000Z",
    updatedAt: "2026-06-10T09:00:00.000Z",
  };
}

const ids = (events: Array<{ id: string }>) => events.map((e) => e.id).sort();

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("truth table: entry state → earned event set", () => {
  // Activated permission entry → started only.
  assert.deepEqual(
    ids(collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("e1", "activated"))),
    ["streak_started:e1"],
  );
  // Finalized permission WIN → started AND won (history is cumulative —
  // the win passed through activation; reconcile must never strip it).
  assert.deepEqual(
    ids(collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("e2", "won"))),
    ["streak_started:e2", "streak_won:e2"],
  );
  // Record commit → won only (records never activate); silver tier.
  const rec = collectEntryMilestoneEvents(OWNER, REC, recordEntry("e3", "GENERATED"));
  assert.deepEqual(ids(rec), ["streak_won:e3"]);
  assert.equal(rec[0]?.tier, "silver");
  // Record under a pending correction request → celebration suspended,
  // but the activity stays LOGGED (it did commit once).
  assert.deepEqual(
    ids(collectEntryMilestoneEvents(OWNER, REC, recordEntry("e4", "EDIT_REQUESTED"))),
    ["entry_committed:e4"],
  );
  // Archived → nothing.
  assert.deepEqual(collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("e5", "archived")), []);
  // Archive-restore (streak permanently removed) → plain committed card.
  assert.deepEqual(
    ids(collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("e6", "restored-no-streak"))),
    ["entry_committed:e6"],
  );
  // Past-dated committed → plain committed card.
  assert.deepEqual(
    ids(collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("e7", "past-committed"))),
    ["entry_committed:e7"],
  );
  // Gold tier on the permission win.
  const won = collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("e8", "won"));
  assert.equal(won.find((e) => e.id === "streak_won:e8")?.tier, "gold");
});

test("determinism + timestamps: same entry → same ids, times from the entry", () => {
  const a = collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("d1", "won"));
  const b = collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("d1", "won"));
  assert.deepEqual(ids(a), ids(b));
  assert.equal(a.find((e) => e.type === "streak_started")?.createdAt, "2026-06-01T09:00:00.000Z", "started = commit time");
  assert.equal(a.find((e) => e.type === "streak_won")?.createdAt, "2026-06-03T09:00:00.000Z", "won = completion time");
});

test("idempotency: concurrent duplicate appends land exactly one card; only the first reports added", async () => {
  await withSandbox("logic-idem", async () => {
    const event = collectEntryMilestoneEvents(OWNER, CAT, permissionEntry("i1", "activated"))[0]!;
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => appendFeedEvent(event)));
    assert.equal((await listFeedEvents(50)).length, 1, "exactly one card");
    assert.equal(results.filter(Boolean).length, 1, "exactly one append reports added");

    // Full emitter re-runs (live + backfill shape) never double-post.
    await recordEntryMilestonesAwaited(OWNER, CAT, permissionEntry("i1", "activated"));
    await recordEntryMilestonesAwaited(OWNER, CAT, permissionEntry("i1", "activated"));
    assert.equal((await listFeedEvents(50)).length, 1);
  });
});

test("lifecycle strips and restores: activated → won → archived → restored", async () => {
  await withSandbox("logic-lifecycle", async () => {
    const reconcile = (phase: Parameters<typeof permissionEntry>[1]) =>
      reconcileEntryFeedPresence(OWNER, CAT, permissionEntry("L1", phase));

    await reconcile("activated");
    assert.deepEqual(ids(await listFeedEvents(50)), ["streak_started:L1"]);

    await reconcile("won");
    assert.deepEqual(ids(await listFeedEvents(50)), ["streak_started:L1", "streak_won:L1"]);

    // Re-reconciling the SAME state changes nothing (stability).
    await reconcile("won");
    assert.deepEqual(ids(await listFeedEvents(50)), ["streak_started:L1", "streak_won:L1"]);

    // Archive strips every card.
    await reconcile("archived");
    assert.deepEqual(await listFeedEvents(50), []);

    // Archive-restore (streak permanently removed): committed card only.
    await reconcile("restored-no-streak");
    assert.deepEqual(ids(await listFeedEvents(50)), ["entry_committed:L1"]);

    // Bin-restore semantics (streak restored): the win comes back whole.
    await reconcile("won");
    assert.deepEqual(ids(await listFeedEvents(50)), ["streak_started:L1", "streak_won:L1"]);
  });
});

test("un-win via pdfStale strips the win card but keeps the started card", async () => {
  await withSandbox("logic-unwin", async () => {
    await reconcileEntryFeedPresence(OWNER, CAT, permissionEntry("U1", "won"));
    assert.deepEqual(ids(await listFeedEvents(50)), ["streak_started:U1", "streak_won:U1"]);

    // Stage-1 edited after an edit grant → PDF stale → no longer a win,
    // but it DID activate: started survives.
    const stale = { ...permissionEntry("U1", "won"), pdfStale: true };
    await reconcileEntryFeedPresence(OWNER, CAT, stale);
    assert.deepEqual(ids(await listFeedEvents(50)), ["streak_started:U1"]);
  });
});

test("reactions and timestamps survive reconcile on kept cards", async () => {
  await withSandbox("logic-reactions", async () => {
    await reconcileEntryFeedPresence(OWNER, CAT, permissionEntry("R1", "won"));
    await toggleReaction("streak_won:R1", "fire", "viewer@tce.edu");

    // A no-op reconcile and a state change that KEEPS the win…
    await reconcileEntryFeedPresence(OWNER, CAT, permissionEntry("R1", "won"));
    const events = await listFeedEvents(50);
    const win = events.find((e) => e.id === "streak_won:R1");
    assert.deepEqual(win?.reactions.fire, ["viewer@tce.edu"], "reactions preserved");
    assert.equal(win?.createdAt, "2026-06-03T09:00:00.000Z", "original timestamp preserved");
  });
});

test("win-count milestones fire once ever per threshold (id-deduped, no re-check on re-emits)", async () => {
  await withSandbox("logic-milestone", async () => {
    // Direct store-level proof of the once-ever id semantics.
    assert.equal(await appendFeedEvent({ id: `milestone:${OWNER}:5`, type: "milestone", actorEmail: OWNER, milestone: 5 }), true);
    assert.equal(await appendFeedEvent({ id: `milestone:${OWNER}:5`, type: "milestone", actorEmail: OWNER, milestone: 5 }), false);
    assert.equal((await listFeedEvents(50)).filter((e) => e.type === "milestone").length, 1);
  });
});

test("sync only manages the entry's own ids — other entries' cards are untouched", async () => {
  await withSandbox("logic-scope", async () => {
    await reconcileEntryFeedPresence(OWNER, CAT, permissionEntry("S1", "won"));
    await reconcileEntryFeedPresence(OWNER, CAT, permissionEntry("S2", "activated"));
    // Stripping S1 (archive) must not touch S2.
    await syncEntryFeedEvents("S1", []);
    assert.deepEqual(ids(await listFeedEvents(50)), ["streak_started:S2"]);
  });
});
