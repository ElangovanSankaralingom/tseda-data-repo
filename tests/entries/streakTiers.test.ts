import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCanonicalStreakSnapshot,
  computeStreakProgressAggregate,
  getStreakTier,
  type StreakProgressAggregateEntry,
} from "../../lib/streakProgress.ts";

/**
 * STREAK TIERS (Elan, 2026-07): GOLD for permission-flow wins, SILVER for
 * record-flow ("data alone") wins — the tier gives permission entries their
 * weight. Also pins the fix shipped with this feature: record wins now
 * count in the dashboard aggregate (they previously showed only on the
 * wall because the aggregate hard-gated on PDF existence).
 */

const PAST = "2025-01-01T00:00:00.000Z";

function recordWin(id: string): StreakProgressAggregateEntry {
  return {
    id,
    categoryKey: "journal-publications",
    entryFlow: "record",
    streakEligible: true,
    confirmationStatus: "GENERATED",
  } as unknown as StreakProgressAggregateEntry;
}

function permissionWin(id: string): StreakProgressAggregateEntry {
  return {
    id,
    categoryKey: "fdp-attended",
    streakEligible: true,
    confirmationStatus: "GENERATED",
    pdfGenerated: true,
    pdfStale: false,
    // Expired edit window → finalized → win (fields checked below are the
    // required data fields; fdp-attended requirements are satisfied here).
    editWindowExpiresAt: PAST,
    academicYear: "Academic Year 2025-2026",
    semesterType: "ODD",
    programName: "FDP",
    organisingBody: "TCE",
    sponsored: "No",
    level: "National",
    mode: "Online",
    startDate: "2025-10-01",
    endDate: "2025-10-03",
  } as unknown as StreakProgressAggregateEntry;
}

test("getStreakTier: record flow → silver, permission flow → gold", () => {
  assert.equal(getStreakTier({ entryFlow: "record" } as never), "silver");
  assert.equal(getStreakTier({} as never), "gold");
});

test("aggregate splits gold/silver and counts record wins (bug fix)", () => {
  const aggregate = computeStreakProgressAggregate([
    recordWin("r1"),
    recordWin("r2"),
    permissionWin("p1"),
  ]);

  assert.equal(aggregate.silverWinsCount, 2, "record wins count as silver");
  assert.equal(aggregate.goldWinsCount, 1, "permission win counts as gold");
  assert.equal(aggregate.winsCount, 3, "total = gold + silver");
  assert.equal(aggregate.byCategory["journal-publications"].wins, 2);

  // A record entry with a pending edit request is NOT a win (mirrors isEntryWon).
  const paused = computeStreakProgressAggregate([
    { ...recordWin("r3"), confirmationStatus: "EDIT_REQUESTED" } as never,
  ]);
  assert.equal(paused.winsCount, 0);

  // Canonical snapshot carries the split for the dashboard index.
  const snapshot = computeCanonicalStreakSnapshot([recordWin("r1"), permissionWin("p1")]);
  assert.equal(snapshot.streakGoldWinsCount, 1);
  assert.equal(snapshot.streakSilverWinsCount, 1);
  assert.equal(snapshot.streakWinsCount, 2);
});
