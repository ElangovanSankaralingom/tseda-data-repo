import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransition,
  isEntryLocked,
  normalizeEntryStatus,
  transitionEntry,
} from "../../lib/entries/stateMachine.ts";

test("normalizeEntryStatus maps legacy and missing values safely", () => {
  assert.equal(normalizeEntryStatus({}), "DRAFT");
  assert.equal(normalizeEntryStatus({ requestEditStatus: "pending" }), "PENDING_CONFIRMATION");
  assert.equal(normalizeEntryStatus({ confirmedAtISO: "2026-03-05T10:00:00.000Z" }), "APPROVED");
});

test("canTransition allows only supported workflow paths", () => {
  assert.equal(canTransition("DRAFT", "PENDING_CONFIRMATION"), true);
  assert.equal(canTransition("REJECTED", "PENDING_CONFIRMATION"), true);
  assert.equal(canTransition("PENDING_CONFIRMATION", "APPROVED"), true);
  assert.equal(canTransition("PENDING_CONFIRMATION", "REJECTED"), true);

  assert.equal(canTransition("DRAFT", "APPROVED"), false);
  assert.equal(canTransition("APPROVED", "REJECTED"), false);
});

test("transitionEntry blocks invalid transitions", () => {
  assert.throws(
    () =>
      transitionEntry(
        { confirmationStatus: "DRAFT" },
        "adminApprove",
        { nowISO: "2026-03-05T10:00:00.000Z" }
      ),
    /Invalid status transition/
  );
});

test("isEntryLocked is true only for APPROVED status", () => {
  assert.equal(isEntryLocked({ confirmationStatus: "DRAFT" }), false);
  assert.equal(isEntryLocked({ confirmationStatus: "PENDING_CONFIRMATION" }), false);
  assert.equal(isEntryLocked({ confirmationStatus: "REJECTED" }), false);
  assert.equal(isEntryLocked({ confirmationStatus: "APPROVED" }), true);
});
