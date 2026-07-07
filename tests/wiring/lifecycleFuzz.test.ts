import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  createEntry,
  updateEntry,
  requestEdit,
  cancelEditRequest,
  requestDelete,
  cancelDeleteRequest,
  grantEditAccess,
  rejectEditRequest,
  archiveEntry,
  restoreEntry,
  finalizeEntry,
} from "../../lib/entries/lifecycle.ts";
import { generateAndPersistEntryPdf } from "../../lib/pdf/pdfService.ts";
import { readCategoryEntries } from "../../lib/dataStore.ts";
import { ensureUserIndex } from "../../lib/data/indexStore.ts";
import { readStoreRevision } from "../../lib/data/storeRevision.ts";
import { listFeedEvents } from "../../lib/feed/feedStore.ts";
import { collectEntryMilestoneEvents } from "../../lib/feed/feedEvents.ts";
import { runSyncReconcile } from "../../lib/jobs/syncReconcile.ts";
import { normalizeEntryStatus } from "../../lib/entries/workflow.ts";
import type { CategoryKey } from "../../lib/entries/types.ts";

/**
 * PROPERTY-BASED LIFECYCLE FUZZER (last-day pass, 2026-07).
 *
 * Every audit so far verified sequences someone THOUGHT of. This one
 * throws seeded-random action sequences at the real engine and checks the
 * system invariants after EVERY step:
 *
 *   I1  legal statuses only (the 6-state machine + ARCHIVED)
 *   I2  store revision is monotonic non-decreasing
 *   I3  after reconcile, the wall holds EXACTLY the earned set (per entry)
 *   I4  index totals equal store counts on the next read (self-heal)
 *   I5  a permanently locked entry never leaves GENERATED via user actions
 *   I6  engine rejections leave state EXACTLY as it was (atomicity)
 *
 * Deterministic PRNG → every failure is reproducible from the printed
 * seed. Illegal actions are EXPECTED to throw — the property is that a
 * rejection must not corrupt state.
 */

const OWNER = "fuzz.faculty@tce.edu";
const ADMIN = "senarch@tce.edu";
const CAT = "workshops" as CategoryKey;

const LEGAL_STATUSES = new Set([
  "DRAFT", "GENERATED", "EDIT_REQUESTED", "DELETE_REQUESTED", "EDIT_GRANTED", "ARCHIVED",
]);

/** Mulberry32 — tiny deterministic PRNG. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function workshopPayload(id: string): Record<string, unknown> {
  return {
    id,
    academicYear: "Academic Year 2026-2027",
    semesterType: "ODD",
    workshopName: `Fuzz Workshop ${id}`,
    organisingBody: "TCE",
    venue: "TCE Campus",
    level: "National",
    mode: "Offline",
    sponsored: "No",
    startDate: "2026-07-20",
    endDate: "2026-07-22",
    numberOfParticipants: 40,
    coCoordinators: [],
    resourcePersonName: "Fuzz Resource",
    resourcePersonDesignation: "Professor",
    resourcePersonOrganisation: "Anna University",
  };
}

type ActionName =
  | "save" | "generate" | "finalise" | "requestEdit" | "cancelEditRequest"
  | "requestDelete" | "cancelDeleteRequest" | "grantEdit" | "rejectEdit"
  | "archive" | "restore" | "reconcile";

const ACTIONS: ActionName[] = [
  "save", "generate", "finalise", "requestEdit", "cancelEditRequest",
  "requestDelete", "cancelDeleteRequest", "grantEdit", "rejectEdit",
  "archive", "restore", "reconcile",
];

async function runAction(action: ActionName, entryId: string): Promise<"ok" | "rejected"> {
  try {
    switch (action) {
      case "save":
        await updateEntry(OWNER, CAT, entryId, { ...workshopPayload(entryId), venue: `Venue ${Date.now() % 97}` } as never);
        return "ok";
      case "generate":
        await generateAndPersistEntryPdf({ email: OWNER, category: CAT, entryId });
        return "ok";
      case "finalise":
        await finalizeEntry(OWNER, CAT, entryId);
        return "ok";
      case "requestEdit":
        await requestEdit(OWNER, CAT, entryId);
        return "ok";
      case "cancelEditRequest":
        await cancelEditRequest(OWNER, CAT, entryId);
        return "ok";
      case "requestDelete":
        await requestDelete(OWNER, CAT, entryId);
        return "ok";
      case "cancelDeleteRequest":
        await cancelDeleteRequest(OWNER, CAT, entryId);
        return "ok";
      case "grantEdit":
        await grantEditAccess(ADMIN, CAT, OWNER, entryId);
        return "ok";
      case "rejectEdit":
        await rejectEditRequest(ADMIN, CAT, OWNER, entryId);
        return "ok";
      case "archive":
        await archiveEntry(ADMIN, CAT, OWNER, entryId);
        return "ok";
      case "restore":
        await restoreEntry(ADMIN, CAT, OWNER, entryId);
        return "ok";
      case "reconcile":
        await runSyncReconcile();
        return "ok";
    }
  } catch {
    return "rejected";
  }
}

const stable = (v: unknown) => JSON.stringify(v);

test("fuzz: 120 random lifecycle actions never violate a system invariant", async (t) => {
  const seed = Number(process.env.FUZZ_SEED ?? 20260707);
  const steps = Number(process.env.FUZZ_STEPS ?? 120);
  t.diagnostic(`FUZZ_SEED=${seed} FUZZ_STEPS=${steps} (set env to reproduce)`);

  const sandbox = await createTestDataRoot("lifecycle-fuzz");
  try {
    const rand = prng(seed);
    const created = await createEntry(OWNER, CAT, workshopPayload("fz-1") as never);
    const entryId = String((created as Record<string, unknown>).id);
    let lastRev = await readStoreRevision(OWNER);

    for (let step = 0; step < steps; step += 1) {
      const action = ACTIONS[Math.floor(rand() * ACTIONS.length)]!;
      const before = (await readCategoryEntries(OWNER, CAT)).find(
        (e) => String((e as Record<string, unknown>).id) === entryId,
      ) as Record<string, unknown> | undefined;
      assert.ok(before, `step ${step}: entry vanished without a delete action`);
      const beforeSnapshot = stable(before);
      const beforeLocked = before.permanentlyLocked === true;

      const outcome = await runAction(action, entryId);

      const after = (await readCategoryEntries(OWNER, CAT)).find(
        (e) => String((e as Record<string, unknown>).id) === entryId,
      ) as Record<string, unknown> | undefined;
      assert.ok(after, `step ${step} [${action}]: entry vanished`);
      const status = String(normalizeEntryStatus(after));

      // I1: legal statuses only.
      assert.ok(LEGAL_STATUSES.has(status), `step ${step} [${action}]: illegal status '${status}'`);

      // I6: a rejected action must not mutate the entry.
      if (outcome === "rejected") {
        assert.equal(
          stable(after),
          beforeSnapshot,
          `step ${step} [${action}]: REJECTED action mutated the entry`,
        );
      }

      // I5: user actions never unlock a permanently locked entry.
      if (beforeLocked && ["save", "generate", "finalise"].includes(action) && outcome === "ok") {
        assert.equal(after.permanentlyLocked, true, `step ${step} [${action}]: lock lost`);
      }

      // I2: revision monotonic non-decreasing.
      const rev = await readStoreRevision(OWNER);
      assert.ok(rev >= lastRev, `step ${step} [${action}]: revision went backwards`);
      lastRev = rev;
    }

    // Terminal coherence: I4 (index self-heal equals store), then I3
    // (reconciled wall = earned set exactly).
    const index = await ensureUserIndex(OWNER);
    assert.ok(index.ok);
    const storeCount = (await readCategoryEntries(OWNER, CAT)).length;
    assert.equal(index.data.totalsByCategory[CAT], storeCount, "index/store drift after fuzz");

    await runSyncReconcile();
    const finalEntry = (await readCategoryEntries(OWNER, CAT)).find(
      (e) => String((e as Record<string, unknown>).id) === entryId,
    ) as Record<string, unknown>;
    const earned = collectEntryMilestoneEvents(OWNER, CAT, finalEntry)
      .map((e) => e.id)
      .sort();
    const onWall = (await listFeedEvents(200))
      .filter((e) => e.id.endsWith(`:${entryId}`))
      .map((e) => e.id)
      .sort();
    assert.deepEqual(onWall, earned, "wall != earned set after reconcile");
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
});
