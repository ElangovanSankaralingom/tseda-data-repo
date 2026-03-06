import assert from "node:assert/strict";
import test from "node:test";
import { getStreakProgressSnapshot } from "../../lib/streakProgress.ts";

test("streak progress marks committed drafts as activated", () => {
  const snapshot = getStreakProgressSnapshot({
    id: "entry-1",
    status: "final",
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
    status: "final",
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
    status: "final",
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
    status: "draft",
    confirmationStatus: "DRAFT",
  });

  assert.equal(snapshot.isActivated, false);
  assert.equal(snapshot.isWin, false);
  assert.equal(snapshot.hasActivatedAt, false);
  assert.equal(snapshot.hasCompletedAt, false);
});
