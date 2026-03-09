import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEntryStatus,
  isEntryEditable,
  isEntryFinalized,
  canTransition,
  transitionEntry,
  computeEditWindowExpiry,
  isEditWindowExpired,
  canRequestAction,
  type EntryStateLike,
} from "../../lib/entries/workflow.ts";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

// ---------------------------------------------------------------------------
// Additional transition tests not in engine.test.ts
// ---------------------------------------------------------------------------

describe("transitionEntry — cancelEditRequest", () => {
  it("reverts EDIT_REQUESTED to GENERATED", () => {
    const entry: EntryStateLike = {
      confirmationStatus: "EDIT_REQUESTED",
      editRequestedAt: "2024-01-01T00:00:00Z",
      editRequestMessage: "Please",
      requestType: "edit",
    };
    const result = transitionEntry(entry, "cancelEditRequest");
    assert.equal(result.confirmationStatus, "GENERATED");
    assert.equal(result.editRequestedAt, null);
    assert.equal(result.editRequestMessage, null);
    assert.equal(result.requestType, null);
  });
});

describe("transitionEntry — cancelDeleteRequest", () => {
  it("reverts DELETE_REQUESTED to GENERATED", () => {
    const entry: EntryStateLike = {
      confirmationStatus: "DELETE_REQUESTED",
      deleteRequestedAt: "2024-01-01T00:00:00Z",
      requestType: "delete",
    };
    const result = transitionEntry(entry, "cancelDeleteRequest");
    assert.equal(result.confirmationStatus, "GENERATED");
    assert.equal(result.deleteRequestedAt, null);
    assert.equal(result.requestType, null);
  });
});

describe("transitionEntry — approveDelete", () => {
  it("transitions DELETE_REQUESTED to ARCHIVED with delete_approved reason", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const entry: EntryStateLike = {
      confirmationStatus: "DELETE_REQUESTED",
      deleteRequestedAt: "2024-05-01T00:00:00Z",
    };
    const result = transitionEntry(entry, "approveDelete", {
      nowISO,
      archiveReason: "delete_approved",
    });
    assert.equal(result.confirmationStatus, "ARCHIVED");
    assert.equal(result.archivedAt, nowISO);
    assert.equal(result.archiveReason, "delete_approved");
  });
});

// ---------------------------------------------------------------------------
// Edge cases for isEntryEditable
// ---------------------------------------------------------------------------

describe("isEntryEditable — edge cases", () => {
  it("DELETE_REQUESTED is not editable", () => {
    assert.equal(isEntryEditable({ confirmationStatus: "DELETE_REQUESTED" }), false);
  });

  it("EDIT_REQUESTED is not editable (pending approval)", () => {
    assert.equal(isEntryEditable({ confirmationStatus: "EDIT_REQUESTED" }), false);
  });
});

// ---------------------------------------------------------------------------
// isEntryFinalized edge cases
// ---------------------------------------------------------------------------

describe("isEntryFinalized — edge cases", () => {
  it("EDIT_GRANTED is not finalized", () => {
    assert.equal(isEntryFinalized({ confirmationStatus: "EDIT_GRANTED" }), false);
  });

  it("DELETE_REQUESTED is not finalized", () => {
    assert.equal(isEntryFinalized({ confirmationStatus: "DELETE_REQUESTED" }), false);
  });

  it("GENERATED without editWindowExpiresAt is not finalized (no window = not expired)", () => {
    assert.equal(isEntryFinalized({ confirmationStatus: "GENERATED" }), false);
  });
});

// ---------------------------------------------------------------------------
// normalizeEntryStatus — additional legacy mappings
// ---------------------------------------------------------------------------

describe("normalizeEntryStatus — additional cases", () => {
  it("maps legacy REJECTED to GENERATED", () => {
    // REJECTED is in LEGACY_STATUS_MAP
    assert.equal(normalizeEntryStatus({ status: "REJECTED" }), "GENERATED");
  });

  it("returns fallback for completely empty strings", () => {
    assert.equal(normalizeEntryStatus({ confirmationStatus: "", status: "" }), "DRAFT");
  });

  it("returns fallback for non-string values", () => {
    assert.equal(normalizeEntryStatus({ confirmationStatus: 123 }), "DRAFT");
  });

  it("legacy requestEditStatus pending maps to GENERATED", () => {
    assert.equal(normalizeEntryStatus({ requestEditStatus: "pending" }), "GENERATED");
  });

  it("legacy requestEditStatus approved maps to GENERATED", () => {
    assert.equal(normalizeEntryStatus({ requestEditStatus: "approved" }), "GENERATED");
  });
});

// ---------------------------------------------------------------------------
// canTransition — exhaustive invalid transitions
// ---------------------------------------------------------------------------

describe("canTransition — additional invalid transitions", () => {
  it("EDIT_REQUESTED → DRAFT disallowed", () => assert.equal(canTransition("EDIT_REQUESTED", "DRAFT"), false));
  it("EDIT_REQUESTED → ARCHIVED disallowed", () => assert.equal(canTransition("EDIT_REQUESTED", "ARCHIVED"), false));
  it("EDIT_GRANTED → EDIT_REQUESTED disallowed", () => assert.equal(canTransition("EDIT_GRANTED", "EDIT_REQUESTED"), false));
  it("EDIT_GRANTED → DRAFT disallowed", () => assert.equal(canTransition("EDIT_GRANTED", "DRAFT"), false));
  it("DELETE_REQUESTED → EDIT_REQUESTED disallowed", () => assert.equal(canTransition("DELETE_REQUESTED", "EDIT_REQUESTED"), false));
  it("DELETE_REQUESTED → DRAFT disallowed", () => assert.equal(canTransition("DELETE_REQUESTED", "DRAFT"), false));
  it("ARCHIVED → ARCHIVED disallowed", () => assert.equal(canTransition("ARCHIVED", "ARCHIVED"), false));
  it("ARCHIVED → EDIT_REQUESTED disallowed", () => assert.equal(canTransition("ARCHIVED", "EDIT_REQUESTED"), false));
});

// ---------------------------------------------------------------------------
// computeEditWindowExpiry — streak with custom buffer
// ---------------------------------------------------------------------------

describe("computeEditWindowExpiry — custom streak buffer", () => {
  it("uses custom streakBufferDays override", () => {
    const generated = "2024-06-01T12:00:00.000Z";
    const endDate = "2024-06-20";
    const expiry = computeEditWindowExpiry(
      generated,
      { streakEligible: true, endDate },
      { streakBufferDays: 14 },
    );
    // endDate + 14 = July 4 >> default June 4
    assert.ok(expiry > "2024-07-01");
  });

  it("non-streak entry ignores streakBufferDays override", () => {
    const generated = "2024-06-01T12:00:00.000Z";
    const expiry = computeEditWindowExpiry(
      generated,
      { streakEligible: false },
      { streakBufferDays: 14 },
    );
    const expected = new Date("2024-06-04T12:00:00.000Z").toISOString();
    assert.equal(expiry, expected);
  });
});

// ---------------------------------------------------------------------------
// canRequestAction — additional states
// ---------------------------------------------------------------------------

describe("canRequestAction — additional states", () => {
  it("returns false for EDIT_REQUESTED", () => {
    assert.equal(canRequestAction({ confirmationStatus: "EDIT_REQUESTED" }), false);
  });

  it("returns false for DELETE_REQUESTED", () => {
    assert.equal(canRequestAction({ confirmationStatus: "DELETE_REQUESTED" }), false);
  });

  it("returns false for ARCHIVED", () => {
    assert.equal(canRequestAction({ confirmationStatus: "ARCHIVED" }), false);
  });

  it("returns true with requestCount=2 (under limit)", () => {
    assert.equal(canRequestAction({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysAgo(1),
      requestCount: 2,
    }), true);
  });
});
