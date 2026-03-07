import assert from "node:assert/strict";
import test from "node:test";
import {
  checkStreakEligibility,
  computeCanonicalStreakSnapshot,
  computeStreakProgressAggregate,
  isEntryActivated,
  isEntryStreakEligible,
  isEntryWon,
} from "../../lib/streakProgress.ts";

// --- checkStreakEligibility ---

test("entry with future end date is streak-eligible", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const futureDateISO = futureDate.toISOString().slice(0, 10);

  assert.equal(checkStreakEligibility({ endDate: futureDateISO }), true);
});

test("entry with past end date is not streak-eligible", () => {
  assert.equal(checkStreakEligibility({ endDate: "2020-01-01" }), false);
});

test("entry with today's end date is not streak-eligible", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(checkStreakEligibility({ endDate: today }), false);
});

test("entry with no end date is not streak-eligible", () => {
  assert.equal(checkStreakEligibility({}), false);
  assert.equal(checkStreakEligibility({ endDate: "" }), false);
  assert.equal(checkStreakEligibility({ endDate: null }), false);
});

// --- isEntryStreakEligible ---

test("entry with streakEligible=true is eligible", () => {
  assert.equal(isEntryStreakEligible({ streakEligible: true }), true);
});

test("entry without streakEligible flag is not eligible", () => {
  assert.equal(isEntryStreakEligible({}), false);
  assert.equal(isEntryStreakEligible({ streakEligible: false }), false);
  assert.equal(isEntryStreakEligible({ streakEligible: undefined }), false);
});

// --- isEntryActivated ---

test("eligible entry with committedAtISO is activated", () => {
  assert.equal(
    isEntryActivated({
      streakEligible: true,
      committedAtISO: "2026-03-06T10:00:00.000Z",
    }),
    true
  );
});

test("non-eligible entry with committedAtISO is NOT activated", () => {
  assert.equal(
    isEntryActivated({
      streakEligible: false,
      committedAtISO: "2026-03-06T10:00:00.000Z",
    }),
    false
  );
});

test("eligible entry without committedAtISO is NOT activated", () => {
  assert.equal(isEntryActivated({ streakEligible: true }), false);
});

test("entry with no flags is not activated", () => {
  assert.equal(isEntryActivated({}), false);
});

// --- isEntryWon ---

test("eligible activated entry with all exportable fields filled is a win", () => {
  const fields = [
    { key: "id", label: "ID", kind: "string" as const, exportable: false },
    { key: "title", label: "Title", kind: "string" as const },
    { key: "date", label: "Date", kind: "date" as const },
  ];
  const entry = {
    streakEligible: true,
    committedAtISO: "2026-03-06T10:00:00.000Z",
    id: "e1",
    title: "My Entry",
    date: "2026-03-06",
  };
  assert.equal(isEntryWon(entry, fields), true);
});

test("non-eligible entry with all fields filled is NOT a win", () => {
  const fields = [
    { key: "title", label: "Title", kind: "string" as const },
  ];
  const entry = {
    streakEligible: false,
    committedAtISO: "2026-03-06T10:00:00.000Z",
    title: "Filled",
  };
  assert.equal(isEntryWon(entry, fields), false);
});

test("eligible entry missing a field is NOT a win", () => {
  const fields = [
    { key: "title", label: "Title", kind: "string" as const },
    { key: "date", label: "Date", kind: "date" as const },
  ];
  const entry = {
    streakEligible: true,
    committedAtISO: "2026-03-06T10:00:00.000Z",
    title: "My Entry",
    // date missing
  };
  assert.equal(isEntryWon(entry, fields), false);
});

test("non-exportable fields are skipped for win check", () => {
  const fields = [
    { key: "id", label: "ID", kind: "string" as const, exportable: false },
    { key: "pdfMeta", label: "PDF", kind: "object" as const, exportable: false },
    { key: "streak", label: "Streak", kind: "object" as const, exportable: false },
    { key: "title", label: "Title", kind: "string" as const },
  ];
  const entry = {
    streakEligible: true,
    committedAtISO: "2026-03-06T10:00:00.000Z",
    id: "e1",
    title: "Filled",
  };
  assert.equal(isEntryWon(entry, fields), true);
});

// --- Aggregate computation ---

// Helper: create a complete workshops entry (all exportable fields filled)
function completeWorkshopEntry(id: string, committedAt: string) {
  return {
    categoryKey: "workshops" as const,
    id,
    streakEligible: true,
    committedAtISO: committedAt,
    academicYear: "2025-26",
    yearOfStudy: "I",
    currentSemester: 1,
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    eventName: "Test Workshop",
    speakerName: "Dr. Test",
    organisationName: "TCE",
    coordinator: { name: "Coord", designation: "Prof" },
    coCoordinators: [{ name: "Co" }],
    participants: 50,
    uploads: { photo: "file.jpg" },
  };
}

// Helper: create an incomplete workshops entry (missing some fields)
function incompleteWorkshopEntry(id: string, committedAt: string) {
  return {
    categoryKey: "workshops" as const,
    id,
    streakEligible: true,
    committedAtISO: committedAt,
    eventName: "Workshop " + id,
    // other exportable fields missing
  };
}

test("zero entries: both counters are 0", () => {
  const summary = computeStreakProgressAggregate([]);
  assert.equal(summary.activatedCount, 0);
  assert.equal(summary.winsCount, 0);
});

test("3 eligible generated entries, none complete: activated=3, wins=0", () => {
  const summary = computeStreakProgressAggregate([
    incompleteWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
    incompleteWorkshopEntry("e3", "2026-03-06T12:00:00.000Z"),
  ]);

  assert.equal(summary.activatedCount, 3);
  assert.equal(summary.winsCount, 0);
});

test("5 generated, 2 complete: activated=3, wins=2 (mutually exclusive)", () => {
  const summary = computeStreakProgressAggregate([
    completeWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    completeWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
    incompleteWorkshopEntry("e3", "2026-03-06T12:00:00.000Z"),
    incompleteWorkshopEntry("e4", "2026-03-06T13:00:00.000Z"),
    incompleteWorkshopEntry("e5", "2026-03-06T14:00:00.000Z"),
  ]);

  assert.equal(summary.activatedCount, 3, "activated should be in-progress only");
  assert.equal(summary.winsCount, 2, "wins should be completed only");
  assert.equal(
    summary.activatedCount + summary.winsCount,
    5,
    "activated + wins = total eligible generated"
  );
});

test("5 generated, 5 complete: activated=0, wins=5", () => {
  const summary = computeStreakProgressAggregate([
    completeWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    completeWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
    completeWorkshopEntry("e3", "2026-03-06T12:00:00.000Z"),
    completeWorkshopEntry("e4", "2026-03-06T13:00:00.000Z"),
    completeWorkshopEntry("e5", "2026-03-06T14:00:00.000Z"),
  ]);

  assert.equal(summary.activatedCount, 0, "all completed — none in progress");
  assert.equal(summary.winsCount, 5, "all are wins");
});

test("3 generated entries, 2 eligible, 1 not: only eligible ones counted", () => {
  const summary = computeStreakProgressAggregate([
    incompleteWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
    {
      categoryKey: "workshops",
      id: "e3",
      streakEligible: false,
      committedAtISO: "2026-03-06T12:00:00.000Z",
    },
  ]);

  assert.equal(summary.activatedCount, 2);
  assert.equal(summary.winsCount, 0);
});

test("entry not yet generated contributes to neither counter", () => {
  const summary = computeStreakProgressAggregate([
    {
      categoryKey: "workshops",
      id: "e1",
      streakEligible: true,
      // no committedAtISO
    },
  ]);

  assert.equal(summary.activatedCount, 0);
  assert.equal(summary.winsCount, 0);
});

test("entry without streakEligible flag (pre-migration) not counted", () => {
  const summary = computeStreakProgressAggregate([
    {
      categoryKey: "workshops",
      id: "e1",
      committedAtISO: "2026-03-06T10:00:00.000Z",
      // no streakEligible flag
    },
  ]);

  assert.equal(summary.activatedCount, 0);
  assert.equal(summary.winsCount, 0);
});

test("entries across multiple categories all count", () => {
  const summary = computeStreakProgressAggregate([
    incompleteWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    {
      categoryKey: "fdp-attended",
      id: "e2",
      streakEligible: true,
      committedAtISO: "2026-03-06T11:00:00.000Z",
    },
    {
      categoryKey: "guest-lectures",
      id: "e3",
      streakEligible: true,
      committedAtISO: "2026-03-06T12:00:00.000Z",
    },
  ]);

  assert.equal(summary.activatedCount, 3);
  assert.equal(summary.byCategory.workshops.activated, 1);
  assert.equal(summary.byCategory["fdp-attended"].activated, 1);
  assert.equal(summary.byCategory["guest-lectures"].activated, 1);
});

test("canonical snapshot maps aggregate totals", () => {
  const snapshot = computeCanonicalStreakSnapshot([
    incompleteWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
  ]);

  assert.equal(snapshot.streakActivatedCount, 2);
  assert.equal(snapshot.byCategory.workshops.activated, 2);
  assert.equal(snapshot.activeEntries.length, 2);
});

test("activated + wins = total eligible generated entries", () => {
  const summary = computeStreakProgressAggregate([
    completeWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
    completeWorkshopEntry("e3", "2026-03-06T12:00:00.000Z"),
  ]);

  assert.equal(summary.activatedCount, 1);
  assert.equal(summary.winsCount, 2);
  assert.equal(summary.activatedCount + summary.winsCount, 3);
});

test("eligibility flag is permanent — not rechecked against current date", () => {
  // This entry has a past end date but streakEligible=true (was set when end date was future)
  const summary = computeStreakProgressAggregate([
    {
      categoryKey: "workshops",
      id: "e1",
      streakEligible: true,
      committedAtISO: "2025-01-01T10:00:00.000Z",
      endDate: "2025-01-15", // past date
    },
  ]);

  // Still counted because streakEligible flag is permanent
  assert.equal(summary.activatedCount, 1);
});

test("deleting non-eligible entry has no effect on counters", () => {
  // Before delete: one eligible, one non-eligible
  const before = computeStreakProgressAggregate([
    incompleteWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    {
      categoryKey: "workshops",
      id: "e2",
      streakEligible: false,
      committedAtISO: "2026-03-06T11:00:00.000Z",
    },
  ]);

  // After deleting the non-eligible entry
  const after = computeStreakProgressAggregate([
    incompleteWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
  ]);

  assert.equal(before.activatedCount, 1);
  assert.equal(after.activatedCount, 1);
  // No change
});

test("deleting a complete entry decreases wins, not activated", () => {
  const before = computeStreakProgressAggregate([
    completeWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
  ]);

  // Delete the complete entry
  const after = computeStreakProgressAggregate([
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
  ]);

  assert.equal(before.activatedCount, 1);
  assert.equal(before.winsCount, 1);
  assert.equal(after.activatedCount, 1);
  assert.equal(after.winsCount, 0, "wins decreases when complete entry deleted");
});

test("deleting an incomplete entry decreases activated, not wins", () => {
  const before = computeStreakProgressAggregate([
    completeWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
    incompleteWorkshopEntry("e3", "2026-03-06T12:00:00.000Z"),
  ]);

  // Delete one incomplete entry
  const after = computeStreakProgressAggregate([
    completeWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e3", "2026-03-06T12:00:00.000Z"),
  ]);

  assert.equal(before.activatedCount, 2);
  assert.equal(before.winsCount, 1);
  assert.equal(after.activatedCount, 1, "activated decreases when incomplete entry deleted");
  assert.equal(after.winsCount, 1, "wins unchanged");
});

test("per-category counts are also mutually exclusive", () => {
  const summary = computeStreakProgressAggregate([
    completeWorkshopEntry("e1", "2026-03-06T10:00:00.000Z"),
    incompleteWorkshopEntry("e2", "2026-03-06T11:00:00.000Z"),
    incompleteWorkshopEntry("e3", "2026-03-06T12:00:00.000Z"),
  ]);

  assert.equal(summary.byCategory.workshops.activated, 2);
  assert.equal(summary.byCategory.workshops.wins, 1);
  assert.equal(
    summary.byCategory.workshops.activated + summary.byCategory.workshops.wins,
    3
  );
});
