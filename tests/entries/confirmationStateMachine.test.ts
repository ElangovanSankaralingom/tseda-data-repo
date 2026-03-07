import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransition,
  normalizeEntryStatus,
  transitionEntry,
} from "../../lib/entries/workflow.ts";

test("canTransition only allows canonical workflow transitions", () => {
  assert.equal(canTransition("DRAFT", "GENERATED"), true);
  assert.equal(canTransition("GENERATED", "EDIT_REQUESTED"), true);
  assert.equal(canTransition("EDIT_REQUESTED", "EDIT_GRANTED"), true);
  assert.equal(canTransition("EDIT_GRANTED", "GENERATED"), true);

  assert.equal(canTransition("DRAFT", "DRAFT"), false);
  assert.equal(canTransition("GENERATED", "GENERATED"), false);
  assert.equal(canTransition("DRAFT", "EDIT_REQUESTED"), false);
});

test("requestEdit from EDIT_REQUESTED state is rejected", () => {
  assert.throws(
    () =>
      transitionEntry(
        {
          confirmationStatus: "EDIT_REQUESTED",
        },
        "requestEdit",
        { nowISO: "2026-03-06T10:00:00.000Z" }
      ),
    /Invalid status transition/
  );
});

test("grantEdit from DRAFT state is rejected", () => {
  assert.throws(
    () =>
      transitionEntry(
        {
          confirmationStatus: "DRAFT",
        },
        "grantEdit",
        { nowISO: "2026-03-06T10:00:00.000Z", adminEmail: "senarch@tce.edu" }
      ),
    /Invalid status transition/
  );
});

test("generateEntry transitions DRAFT to GENERATED with edit window", () => {
  const next = transitionEntry(
    {
      confirmationStatus: "DRAFT" as const,
    } as Record<string, unknown>,
    "generateEntry",
    { nowISO: "2026-03-06T10:00:00.000Z" }
  );

  assert.equal(next.confirmationStatus, "GENERATED");
  assert.ok(next.editWindowExpiresAt);
});

test("normalizeEntryStatus maps legacy sentForConfirmationAtISO to GENERATED", () => {
  const status = normalizeEntryStatus(
    {
      status: "draft",
      sentForConfirmationAtISO: "2026-03-06T10:00:00.000Z",
    },
    "DRAFT"
  );

  assert.equal(status, "GENERATED");
});

test("normalizeEntryStatus maps legacy PENDING_CONFIRMATION to GENERATED", () => {
  const status = normalizeEntryStatus(
    {
      confirmationStatus: "PENDING_CONFIRMATION",
    },
    "DRAFT"
  );

  assert.equal(status, "GENERATED");
});

test("normalizeEntryStatus maps legacy APPROVED to GENERATED", () => {
  const status = normalizeEntryStatus(
    {
      confirmationStatus: "APPROVED",
    },
    "DRAFT"
  );

  assert.equal(status, "GENERATED");
});
