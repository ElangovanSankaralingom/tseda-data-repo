import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransition,
  transitionEntry,
} from "../../lib/entries/stateMachine.ts";

test("canTransition only allows canonical confirmation transitions", () => {
  assert.equal(canTransition("DRAFT", "PENDING_CONFIRMATION"), true);
  assert.equal(canTransition("REJECTED", "PENDING_CONFIRMATION"), true);
  assert.equal(canTransition("PENDING_CONFIRMATION", "APPROVED"), true);
  assert.equal(canTransition("PENDING_CONFIRMATION", "REJECTED"), true);

  assert.equal(canTransition("DRAFT", "DRAFT"), false);
  assert.equal(canTransition("PENDING_CONFIRMATION", "PENDING_CONFIRMATION"), false);
  assert.equal(canTransition("APPROVED", "APPROVED"), false);
});

test("sendForConfirmation from pending state is rejected", () => {
  assert.throws(
    () =>
      transitionEntry(
        {
          confirmationStatus: "PENDING_CONFIRMATION",
        },
        "sendForConfirmation",
        { nowISO: "2026-03-06T10:00:00.000Z" }
      ),
    /Invalid status transition/
  );
});

test("adminApprove from approved state is rejected", () => {
  assert.throws(
    () =>
      transitionEntry(
        {
          confirmationStatus: "APPROVED",
        },
        "adminApprove",
        { nowISO: "2026-03-06T10:00:00.000Z", adminEmail: "senarch@tce.edu" }
      ),
    /Invalid status transition/
  );
});

test("resending after rejection refreshes sentForConfirmationAtISO", () => {
  const next = transitionEntry(
    {
      confirmationStatus: "REJECTED",
      sentForConfirmationAtISO: "2026-02-01T09:00:00.000Z",
    },
    "sendForConfirmation",
    { nowISO: "2026-03-06T10:00:00.000Z" }
  );

  assert.equal(next.confirmationStatus, "PENDING_CONFIRMATION");
  assert.equal(next.sentForConfirmationAtISO, "2026-03-06T10:00:00.000Z");
});
