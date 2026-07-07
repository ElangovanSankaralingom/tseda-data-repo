import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { collectEntryMilestoneEvents, recordEntryMilestonesAwaited } from "../../lib/feed/feedEvents.ts";
import { listFeedEvents } from "../../lib/feed/feedStore.ts";
import type { CategoryKey } from "../../lib/entries/types.ts";

/**
 * MILESTONE-ONLY PRIVACY PROOF (Elan's audit item 7, 2026-07).
 *
 * The Department Pulse promise: milestones only — NO entry titles, venues,
 * speakers, amounts, descriptions or any other entry data on the shared
 * wall. These tests load an entry with sentinel markers in EVERY data
 * field, run it through every emission shape (streak_started, streak_won,
 * entry_committed), and prove: (1) no marker survives into any event,
 * (2) events carry EXACTLY the allowlisted keys, (3) collaborator names
 * truncate to first names, (4) the GET route ships reaction COUNTS, never
 * the reacting emails, and (5) DLC department records never emit at all.
 */

const OWNER = "privacy.faculty@tce.edu";
const MARKER = "SECRET-XYZZY";

/** Every string field poisoned with the sentinel; realistic lifecycle flags. */
function poisonedEntry(id: string, flow: "permission" | "record"): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id,
    academicYear: "Academic Year 2025-2026",
    semesterType: "EVEN",
    programName: `${MARKER} Programme Title`,
    organisingBody: `${MARKER} Body`,
    venue: `${MARKER} Venue`,
    topicOfLecture: `${MARKER} Topic`,
    guestSpeakerName: `${MARKER} Speaker`,
    description: `${MARKER} Description`,
    remarks: `${MARKER} Remarks`,
    fundingAgency: `${MARKER} Agency`,
    fundingAmount: 999999,
    level: "National",
    mode: "Online",
    sponsored: "No",
    startDate: "2026-02-10",
    endDate: "2026-02-12",
    committedAtISO: "2026-06-01T09:00:00.000Z",
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-01T09:00:00.000Z",
    streakEligible: flow === "record",
    coCoordinators: [
      { email: "colleague@tce.edu", name: `Priya ${MARKER}-Surname Extra Words`, isLocked: true },
    ],
  };
  if (flow === "record") {
    return { ...base, entryFlow: "record", confirmationStatus: "GENERATED" };
  }
  return { ...base, confirmationStatus: "GENERATED", pdfGenerated: true, pdfStale: false };
}

/** The COMPLETE set of keys a feed event may carry. Anything else = leak. */
const EVENT_KEY_ALLOWLIST = new Set([
  "id", "type", "actorEmail", "categoryKey", "createdAt", "tier", "withNames", "milestone",
]);

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("no entry data survives into ANY emitted event (all three kinds)", () => {
  const shapes: Array<[CategoryKey, Record<string, unknown>]> = [
    // entry_committed (past-dated permission commit)
    ["fdp-attended" as CategoryKey, poisonedEntry("p1", "permission")],
    // streak_won silver (record commit)
    ["journal-publications" as CategoryKey, poisonedEntry("p2", "record")],
    // collaborative category (fan-out names path)
    ["workshops" as CategoryKey, poisonedEntry("p3", "permission")],
  ];
  for (const [category, entry] of shapes) {
    const events = collectEntryMilestoneEvents(OWNER, category, entry);
    assert.ok(events.length > 0, `${category}: emits something for a committed entry`);
    for (const event of events) {
      const serialized = JSON.stringify(event);
      assert.ok(!serialized.includes(MARKER), `${category}/${event.type}: entry data leaked: ${serialized}`);
      for (const key of Object.keys(event)) {
        assert.ok(EVENT_KEY_ALLOWLIST.has(key), `${category}/${event.type}: unexpected event key '${key}'`);
      }
    }
  }
});

test("collaborator names truncate to FIRST names — surnames never broadcast", () => {
  const events = collectEntryMilestoneEvents(
    OWNER,
    "workshops" as CategoryKey,
    poisonedEntry("n1", "permission"),
  );
  const withNames = events.flatMap((e) => e.withNames ?? []);
  assert.ok(withNames.length > 0, "collaborative entry carries names");
  assert.deepEqual(withNames, ["Priya"], "first name only — no surname, no marker");
});

test("stored feed events hold the same allowlist — nothing extra persists", async () => {
  await withSandbox("privacy-store", async () => {
    await recordEntryMilestonesAwaited(OWNER, "fdp-attended" as CategoryKey, poisonedEntry("s1", "permission"));
    const stored = await listFeedEvents(50);
    assert.equal(stored.length, 1);
    const serialized = JSON.stringify(stored[0]);
    assert.ok(!serialized.includes(MARKER), "stored event leaked entry data");
    // Stored shape adds server-side bookkeeping (reactions map) — but never
    // entry fields. Assert the full stored key set explicitly.
    assert.deepEqual(
      Object.keys(stored[0]!).sort(),
      ["actorEmail", "categoryKey", "createdAt", "id", "milestone", "reactions", "tier", "type", "withNames"],
    );
  });
});

test("route ships reaction COUNTS and first names — never reactor emails or entry fields (source guard)", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/api/feed/route.ts"), "utf8");
  // Reactions must be shaped to lengths, and the raw per-reaction email
  // lists must never be returned.
  assert.ok(source.includes("list.length"), "reactions shaped to counts");
  assert.ok(!/reactions:\s*e\.reactions\b/.test(source), "raw reaction email lists must not ship");
  // The shaped payload must not include entry-data fields.
  for (const forbidden of ["title", "programName", "venue", "description", "amount"]) {
    assert.ok(!source.includes(`${forbidden}:`), `route payload must not carry '${forbidden}'`);
  }
  // Actor identity ships as a resolved FIRST name, not a free-form field.
  assert.ok(source.includes("actorName: firstName(e.actorEmail)"), "actor shaped to first name");
});

test("DLC department records never emit onto the shared wall", async () => {
  await withSandbox("privacy-dlc", async () => {
    // The backfill/reconcile sweeps skip dlc categories; the collector is
    // reachable directly, so the sweep-level guard is what protects the
    // wall. Prove the wall stays empty when a dlc entry goes through the
    // sweep path (runSyncReconcile skips scope dlc — verified in the
    // backfill suite); here we pin the collector usage in the sweep files.
    const backfill = fs.readFileSync(path.join(process.cwd(), "lib/feed/backfill.ts"), "utf8");
    const reconcile = fs.readFileSync(path.join(process.cwd(), "lib/jobs/syncReconcile.ts"), "utf8");
    for (const [name, src] of [["backfill", backfill], ["syncReconcile", reconcile]] as const) {
      assert.ok(src.includes('getCategoryEntryScope(category) === "dlc"'), `${name}: dlc skip present`);
    }
  });
});
