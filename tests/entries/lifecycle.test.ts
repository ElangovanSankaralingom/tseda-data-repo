import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCutoffDate,
  computeDaysLeft,
  getEntryCategory,
  getTagColor,
  isEditableNow,
} from "../../lib/entries/lifecycle.ts";
import { addDaysISO, computeDueAtISO, computeGenericDueAtISO, nowISTDateISO } from "../../lib/gamification.ts";

test("computeCutoffDate uses +8 days for streak entries", () => {
  assert.equal(computeCutoffDate("2026-03-01", true), computeDueAtISO("2026-03-01"));
});

test("computeCutoffDate uses +2 days for generic entries", () => {
  assert.equal(computeCutoffDate("2026-03-01", false), computeGenericDueAtISO("2026-03-01"));
});

test("tag color thresholds are consistent", () => {
  assert.equal(getTagColor(6), "default");
  assert.equal(getTagColor(5), "yellow");
  assert.equal(getTagColor(3), "yellow");
  assert.equal(getTagColor(2), "red");
  assert.equal(getTagColor(1), "red");
  assert.equal(getTagColor(0), "red");
  assert.equal(getTagColor(-1), "expired");
});

test("computeDaysLeft returns whole-day countdown", () => {
  const future = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  assert.equal(computeDaysLeft(future), 6);
  assert.equal(computeDaysLeft(today), 0);
  assert.equal(computeDaysLeft(past), -1);
});

test("entry category derives from stored state", () => {
  const today = nowISTDateISO();
  const futureEnd = addDaysISO(today, 3);
  const pastStart = addDaysISO(today, -5);
  const pastEnd = addDaysISO(today, -2);

  assert.equal(getEntryCategory({ startDate: today, endDate: futureEnd, streak: {} }), "draft");
  assert.equal(
    getEntryCategory({
      startDate: today,
      endDate: futureEnd,
      streak: { activatedAtISO: new Date().toISOString() },
    }),
    "streak_active"
  );
  assert.equal(
    getEntryCategory({
      startDate: today,
      endDate: futureEnd,
      status: "final",
      streak: { completedAtISO: new Date().toISOString() },
    }),
    "completed"
  );
  assert.equal(getEntryCategory({ startDate: pastStart, endDate: pastEnd, streak: {} }), "generic");
});

test("isEditableNow stays true until cutoff then becomes false", () => {
  const today = nowISTDateISO();
  const futureEnd = addDaysISO(today, 1);
  const genericEnd = addDaysISO(today, -3);

  assert.equal(
    isEditableNow({
      startDate: today,
      endDate: futureEnd,
      streak: { dueAtISO: computeDueAtISO(futureEnd) },
    }),
    true
  );
  assert.equal(
    isEditableNow({
      startDate: genericEnd,
      endDate: genericEnd,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    false
  );
});
