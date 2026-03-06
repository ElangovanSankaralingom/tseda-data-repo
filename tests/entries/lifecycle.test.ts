import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCutoffDate,
  computeDaysLeft,
  getEntryCategory,
  getEntryStreakDisplayState,
  getTagColor,
  isEditableNow,
} from "../../lib/entries/displayLifecycle.ts";
import { groupEntries } from "../../lib/entryCategorization.ts";
import { addDaysISO, computeDueAtISO, nowISTDateISO } from "../../lib/gamification.ts";

test("computeCutoffDate uses +8 days for streak entries", () => {
  assert.equal(computeCutoffDate("2026-03-01", true), computeDueAtISO("2026-03-01"));
});

test("computeCutoffDate returns no generic cutoff for non-streak entries", () => {
  assert.equal(computeCutoffDate("2026-03-01", false), null);
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
      committedAtISO: new Date().toISOString(),
      streak: { completedAtISO: new Date().toISOString() },
    }),
    "completed"
  );
  assert.equal(getEntryCategory({ startDate: pastStart, endDate: pastEnd, streak: {} }), "draft");
  assert.equal(
    getEntryCategory({
      startDate: pastStart,
      endDate: pastEnd,
      committedAtISO: new Date().toISOString(),
      streak: {},
    }),
    "completed"
  );
});

test("entry streak display state only shows flames for actual streak state", () => {
  const today = nowISTDateISO();
  const futureEnd = addDaysISO(today, 3);

  assert.equal(getEntryStreakDisplayState({ startDate: today, endDate: futureEnd, streak: {} }), "none");
  assert.equal(
    getEntryStreakDisplayState({
      startDate: today,
      endDate: futureEnd,
      streak: { activatedAtISO: new Date().toISOString() },
    }),
    "activated"
  );
  assert.equal(
    getEntryStreakDisplayState({
      startDate: today,
      endDate: futureEnd,
      streak: { completedAtISO: new Date().toISOString() },
    }),
    "completed"
  );
});

test("groupEntries groups entries globally and sorts newest first within each group", () => {
  const today = nowISTDateISO();
  const futureEnd = addDaysISO(today, 3);

  const grouped = groupEntries([
    {
      id: "draft-old",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
      startDate: today,
      endDate: futureEnd,
      streak: {},
    },
    {
      id: "draft-new",
      createdAt: "2026-03-02T10:00:00.000Z",
      updatedAt: "2026-03-02T10:00:00.000Z",
      startDate: today,
      endDate: futureEnd,
      streak: {},
    },
    {
      id: "active",
      createdAt: "2026-03-03T10:00:00.000Z",
      updatedAt: "2026-03-03T10:00:00.000Z",
      startDate: today,
      endDate: futureEnd,
      streak: { activatedAtISO: "2026-03-03T10:00:00.000Z" },
    },
    {
      id: "completed",
      createdAt: "2026-03-04T10:00:00.000Z",
      updatedAt: "2026-03-04T10:00:00.000Z",
      startDate: today,
      endDate: futureEnd,
      committedAtISO: "2026-03-04T10:00:00.000Z",
      streak: {},
    },
  ]);

  assert.deepEqual(grouped.draft.map((entry) => (entry as { id: string }).id), ["draft-new", "draft-old"]);
  assert.deepEqual(grouped.activated.map((entry) => (entry as { id: string }).id), ["active"]);
  assert.deepEqual(grouped.completed.map((entry) => (entry as { id: string }).id), ["completed"]);
});

test("isEditableNow is not driven by cutoff timing anymore", () => {
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
    true
  );
});
