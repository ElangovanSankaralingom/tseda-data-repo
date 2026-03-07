import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanonicalStreakMetadata,
  computeCanonicalStreakSnapshot,
  computeStreakProgressAggregate,
  getStreakProgressSnapshot,
} from "../../lib/streakProgress.ts";

test("streak progress marks committed drafts as activated", () => {
  const snapshot = getStreakProgressSnapshot({
    id: "entry-1",
    confirmationStatus: "DRAFT",
    committedAtISO: "2026-03-06T10:00:00.000Z",
    updatedAt: "2026-03-06T10:05:00.000Z",
  });

  assert.equal(snapshot.isActivated, true);
  assert.equal(snapshot.isWin, false);
});

test("streak progress marks approved entries as wins", () => {
  const snapshot = getStreakProgressSnapshot({
    id: "entry-2",
    confirmationStatus: "APPROVED",
    committedAtISO: "2026-03-06T10:00:00.000Z",
    updatedAt: "2026-03-06T10:05:00.000Z",
  });

  assert.equal(snapshot.isActivated, false);
  assert.equal(snapshot.isWin, true);
});

test("streak progress is not timer-dependent for activation", () => {
  const snapshot = getStreakProgressSnapshot({
    id: "entry-3",
    confirmationStatus: "PENDING_CONFIRMATION",
    streak: {
      activatedAtISO: "2026-02-01T10:00:00.000Z",
      dueAtISO: "2026-02-05T23:59:59.999Z",
    },
  });

  assert.equal(snapshot.isActivated, true);
  assert.equal(snapshot.isWin, false);
});

test("streak progress defaults to zeroed state for incomplete drafts", () => {
  const snapshot = getStreakProgressSnapshot({
    id: "entry-4",
    confirmationStatus: "DRAFT",
  });

  assert.equal(snapshot.isActivated, false);
  assert.equal(snapshot.isWin, false);
  assert.equal(snapshot.hasActivatedAt, false);
  assert.equal(snapshot.hasCompletedAt, false);
});

test("canonical streak metadata activates only after the commit milestone", () => {
  const streak = buildCanonicalStreakMetadata({
    streak: {},
    startDateISO: "2026-03-05",
    endDateISO: "2026-03-06",
    hasPdf: true,
    isCommitted: false,
    completionSatisfied: false,
    nowISO: "2026-03-06T10:00:00.000Z",
  });

  assert.equal(streak.activatedAtISO, null);
  assert.equal(streak.dueAtISO, null);
  assert.equal(streak.completedAtISO, null);
});

test("canonical streak metadata derives due date and completion from one shared rule", () => {
  const streak = buildCanonicalStreakMetadata({
    streak: {},
    startDateISO: "2026-03-10",
    endDateISO: "2026-03-12",
    hasPdf: true,
    isCommitted: true,
    completionSatisfied: true,
    nowISO: "2026-03-10T10:00:00.000Z",
  });

  assert.equal(streak.activatedAtISO, "2026-03-10T10:00:00.000Z");
  assert.ok(streak.dueAtISO);
  assert.equal(streak.completedAtISO, "2026-03-10T10:00:00.000Z");
});

test("streak progress ignores legacy streak timestamps without commit milestone", () => {
  const snapshot = getStreakProgressSnapshot({
    id: "entry-legacy",
    confirmationStatus: "DRAFT",
    streak: {
      activatedAtISO: "2026-02-01T10:00:00.000Z",
      completedAtISO: "2026-02-02T10:00:00.000Z",
      dueAtISO: "2026-02-05T23:59:59.999Z",
    },
  });

  assert.equal(snapshot.isActivated, false);
  assert.equal(snapshot.isWin, false);
  assert.equal(snapshot.isCompleted, false);
  assert.equal(snapshot.hasActivatedAt, true);
  assert.equal(snapshot.hasCompletedAt, true);
});

test("streak progress aggregate uses one canonical activated/wins rule", () => {
  const summary = computeStreakProgressAggregate([
    {
      categoryKey: "workshops",
      id: "entry-1",
      confirmationStatus: "DRAFT",
      committedAtISO: "2026-03-06T10:01:00.000Z",
      updatedAt: "2026-03-06T10:01:00.000Z",
    },
    {
      categoryKey: "workshops",
      id: "entry-2",
      confirmationStatus: "APPROVED",
      updatedAt: "2026-03-06T10:02:00.000Z",
    },
    {
      categoryKey: "fdp-attended",
      id: "entry-3",
      confirmationStatus: "APPROVED",
      updatedAt: "2026-03-06T10:03:00.000Z",
    },
  ]);

  assert.equal(summary.activatedCount, 1);
  assert.equal(summary.winsCount, 2);
  assert.equal(summary.byCategory.workshops.activated, 1);
  assert.equal(summary.byCategory.workshops.wins, 1);
  assert.equal(summary.byCategory["fdp-attended"].wins, 1);
  assert.deepEqual(summary.activatedEntries.map((entry) => entry.id), ["entry-1"]);
});

test("canonical streak snapshot maps aggregate totals and active entries", () => {
  const summary = computeCanonicalStreakSnapshot([
    {
      categoryKey: "workshops",
      id: "entry-1",
      confirmationStatus: "DRAFT",
      committedAtISO: "2026-03-06T10:01:00.000Z",
      updatedAt: "2026-03-06T10:01:00.000Z",
    },
    {
      categoryKey: "workshops",
      id: "entry-2",
      confirmationStatus: "APPROVED",
      updatedAt: "2026-03-06T10:02:00.000Z",
    },
  ]);

  assert.equal(summary.streakActivatedCount, 1);
  assert.equal(summary.streakWinsCount, 1);
  assert.equal(summary.byCategory.workshops.activated, 1);
  assert.equal(summary.byCategory.workshops.wins, 1);
  assert.deepEqual(summary.activeEntries.map((entry) => entry.id), ["entry-1"]);
});

test("streak progress snapshot derives due date for committed entries without stored metadata", () => {
  const snapshot = getStreakProgressSnapshot({
    id: "entry-due",
    confirmationStatus: "DRAFT",
    committedAtISO: "2026-03-06T10:01:00.000Z",
    endDate: "2026-03-06",
  });

  assert.ok(snapshot.dueAtISO);
});
