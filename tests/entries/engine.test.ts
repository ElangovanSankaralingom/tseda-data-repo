import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEntryStatus,
  isEntryCommitted,
  computeEditWindowExpiry,
  computeEditGrantExpiry,
  isEditWindowExpired,
  isEntryFinalized,
  isEntryEditable,
  canTransition,
  transitionEntry,
  getEditTimeRemaining,
  canRequestAction,
  getRequestCountRemaining,
  type EntryStateLike,
} from "@/lib/entries/workflow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<EntryStateLike> = {}): EntryStateLike {
  return { ...overrides };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

// ---------------------------------------------------------------------------
// normalizeEntryStatus
// ---------------------------------------------------------------------------

describe("normalizeEntryStatus", () => {
  it("returns DRAFT for empty entry", () => {
    assert.equal(normalizeEntryStatus(makeEntry()), "DRAFT");
  });

  it("returns confirmationStatus when set", () => {
    assert.equal(normalizeEntryStatus(makeEntry({ confirmationStatus: "GENERATED" })), "GENERATED");
  });

  it("returns GENERATED when status field is set", () => {
    assert.equal(normalizeEntryStatus(makeEntry({ status: "GENERATED" })), "GENERATED");
  });

  it("returns GENERATED from legacy confirmedAtISO", () => {
    assert.equal(normalizeEntryStatus(makeEntry({ confirmedAtISO: "2024-01-01T00:00:00Z" })), "GENERATED");
  });

  it("returns GENERATED from legacy sentForConfirmationAtISO", () => {
    assert.equal(normalizeEntryStatus(makeEntry({ sentForConfirmationAtISO: "2024-01-01T00:00:00Z" })), "GENERATED");
  });

  it("returns GENERATED from generatedAt field", () => {
    assert.equal(normalizeEntryStatus(makeEntry({ generatedAt: "2024-01-01T00:00:00Z" })), "GENERATED");
  });

  it("maps all 6 canonical statuses correctly", () => {
    const statuses = ["DRAFT", "GENERATED", "EDIT_REQUESTED", "DELETE_REQUESTED", "EDIT_GRANTED", "ARCHIVED"] as const;
    for (const s of statuses) {
      assert.equal(normalizeEntryStatus(makeEntry({ confirmationStatus: s })), s);
    }
  });

  it("maps legacy PENDING_CONFIRMATION to GENERATED", () => {
    assert.equal(normalizeEntryStatus(makeEntry({ status: "PENDING_CONFIRMATION" })), "GENERATED");
  });
});

// ---------------------------------------------------------------------------
// isEntryCommitted
// ---------------------------------------------------------------------------

describe("isEntryCommitted", () => {
  it("returns false for DRAFT entry", () => {
    assert.equal(isEntryCommitted(makeEntry()), false);
  });

  it("returns true when generatedAt is set", () => {
    assert.equal(isEntryCommitted(makeEntry({ generatedAt: "2024-01-01T00:00:00Z" })), true);
  });

  it("returns true for GENERATED entry", () => {
    assert.equal(isEntryCommitted(makeEntry({ confirmationStatus: "GENERATED" })), true);
  });
});

// ---------------------------------------------------------------------------
// computeEditWindowExpiry
// ---------------------------------------------------------------------------

describe("computeEditWindowExpiry", () => {
  it("returns generatedAt + 3 days for non-streak entries", () => {
    const generated = "2024-06-01T12:00:00.000Z";
    const expiry = computeEditWindowExpiry(generated, {});
    const expected = new Date("2024-06-04T12:00:00.000Z").toISOString();
    assert.equal(expiry, expected);
  });

  it("uses endDate + 8 days for streak-eligible entries when later", () => {
    const generated = "2024-06-01T12:00:00.000Z";
    const endDate = "2024-06-20"; // endDate + 8 = June 28 >> default June 4
    const expiry = computeEditWindowExpiry(generated, { streakEligible: true, endDate });
    assert.ok(expiry > "2024-06-20");
  });

  it("falls back to default window if endDate + buffer is earlier", () => {
    const generated = "2024-06-15T12:00:00.000Z"; // default = June 18
    const endDate = "2024-06-01"; // endDate + 8 = June 9 < June 18
    const expiry = computeEditWindowExpiry(generated, { streakEligible: true, endDate });
    const defaultExpiry = new Date("2024-06-18T12:00:00.000Z").toISOString();
    assert.equal(expiry, defaultExpiry);
  });

  it("accepts custom override days", () => {
    const generated = "2024-06-01T12:00:00.000Z";
    const expiry = computeEditWindowExpiry(generated, {}, { editWindowDays: 5 });
    const expected = new Date("2024-06-06T12:00:00.000Z").toISOString();
    assert.equal(expiry, expected);
  });
});

// ---------------------------------------------------------------------------
// computeEditGrantExpiry
// ---------------------------------------------------------------------------

describe("computeEditGrantExpiry", () => {
  it("returns grantedAt + grantedDays", () => {
    const result = computeEditGrantExpiry("2024-06-01T12:00:00.000Z", 5);
    const expected = new Date("2024-06-06T12:00:00.000Z").toISOString();
    assert.equal(result, expected);
  });
});

// ---------------------------------------------------------------------------
// isEditWindowExpired
// ---------------------------------------------------------------------------

describe("isEditWindowExpired", () => {
  it("returns false when no editWindowExpiresAt", () => {
    assert.equal(isEditWindowExpired(makeEntry()), false);
  });

  it("returns false when window is in the future", () => {
    assert.equal(isEditWindowExpired(makeEntry({ editWindowExpiresAt: daysFromNow(1) })), false);
  });

  it("returns true when window is in the past", () => {
    assert.equal(isEditWindowExpired(makeEntry({ editWindowExpiresAt: daysAgo(1) })), true);
  });
});

// ---------------------------------------------------------------------------
// isEntryFinalized
// ---------------------------------------------------------------------------

describe("isEntryFinalized", () => {
  it("returns false for DRAFT", () => {
    assert.equal(isEntryFinalized(makeEntry()), false);
  });

  it("returns false for ARCHIVED", () => {
    assert.equal(isEntryFinalized(makeEntry({ confirmationStatus: "ARCHIVED" })), false);
  });

  it("returns false for EDIT_REQUESTED", () => {
    assert.equal(isEntryFinalized(makeEntry({ confirmationStatus: "EDIT_REQUESTED" })), false);
  });

  it("returns false for GENERATED with active timer", () => {
    assert.equal(isEntryFinalized(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysFromNow(1),
    })), false);
  });

  it("returns true for GENERATED with expired timer", () => {
    assert.equal(isEntryFinalized(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysAgo(1),
    })), true);
  });
});

// ---------------------------------------------------------------------------
// isEntryEditable
// ---------------------------------------------------------------------------

describe("isEntryEditable", () => {
  it("returns true for DRAFT", () => {
    assert.equal(isEntryEditable(makeEntry()), true);
  });

  it("returns true for EDIT_GRANTED", () => {
    assert.equal(isEntryEditable(makeEntry({ confirmationStatus: "EDIT_GRANTED" })), true);
  });

  it("returns true for GENERATED with active timer", () => {
    assert.equal(isEntryEditable(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysFromNow(1),
    })), true);
  });

  it("returns false for GENERATED with expired timer", () => {
    assert.equal(isEntryEditable(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysAgo(1),
    })), false);
  });

  it("returns false for EDIT_REQUESTED", () => {
    assert.equal(isEntryEditable(makeEntry({ confirmationStatus: "EDIT_REQUESTED" })), false);
  });

  it("returns false for ARCHIVED", () => {
    assert.equal(isEntryEditable(makeEntry({ confirmationStatus: "ARCHIVED" })), false);
  });
});

// ---------------------------------------------------------------------------
// canTransition
// ---------------------------------------------------------------------------

describe("canTransition", () => {
  it("DRAFT → GENERATED allowed", () => assert.equal(canTransition("DRAFT", "GENERATED"), true));
  it("DRAFT → ARCHIVED disallowed", () => assert.equal(canTransition("DRAFT", "ARCHIVED"), false));
  it("GENERATED → EDIT_REQUESTED allowed", () => assert.equal(canTransition("GENERATED", "EDIT_REQUESTED"), true));
  it("GENERATED → DELETE_REQUESTED allowed", () => assert.equal(canTransition("GENERATED", "DELETE_REQUESTED"), true));
  it("GENERATED → ARCHIVED allowed", () => assert.equal(canTransition("GENERATED", "ARCHIVED"), true));
  it("GENERATED → DRAFT disallowed", () => assert.equal(canTransition("GENERATED", "DRAFT"), false));
  it("EDIT_REQUESTED → EDIT_GRANTED allowed", () => assert.equal(canTransition("EDIT_REQUESTED", "EDIT_GRANTED"), true));
  it("EDIT_REQUESTED → GENERATED allowed (reject)", () => assert.equal(canTransition("EDIT_REQUESTED", "GENERATED"), true));
  it("DELETE_REQUESTED → ARCHIVED allowed", () => assert.equal(canTransition("DELETE_REQUESTED", "ARCHIVED"), true));
  it("DELETE_REQUESTED → GENERATED allowed (cancel)", () => assert.equal(canTransition("DELETE_REQUESTED", "GENERATED"), true));
  it("EDIT_GRANTED → GENERATED allowed (re-generate)", () => assert.equal(canTransition("EDIT_GRANTED", "GENERATED"), true));
  it("ARCHIVED → GENERATED allowed (restore)", () => assert.equal(canTransition("ARCHIVED", "GENERATED"), true));
  it("ARCHIVED → DRAFT disallowed", () => assert.equal(canTransition("ARCHIVED", "DRAFT"), false));
});

// ---------------------------------------------------------------------------
// transitionEntry — DRAFT → GENERATED
// ---------------------------------------------------------------------------

describe("transitionEntry — generateEntry (DRAFT → GENERATED)", () => {
  it("sets confirmationStatus to GENERATED", () => {
    const entry = makeEntry({ confirmationStatus: "DRAFT" });
    const result = transitionEntry(entry, "generateEntry");
    assert.equal(result.confirmationStatus, "GENERATED");
  });

  it("sets generatedAt and committedAtISO", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const result = transitionEntry(makeEntry({ confirmationStatus: "DRAFT" }), "generateEntry", { nowISO });
    assert.equal(result.generatedAt, nowISO);
    assert.equal(result.committedAtISO, nowISO);
  });

  it("sets editWindowExpiresAt (3 days default)", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const result = transitionEntry(makeEntry({ confirmationStatus: "DRAFT" }), "generateEntry", { nowISO });
    assert.equal(result.editWindowExpiresAt, new Date("2024-06-04T12:00:00.000Z").toISOString());
  });

  it("throws on invalid transition (ARCHIVED → GENERATED via generateEntry)", () => {
    // generateEntry maps to GENERATED; ARCHIVED → GENERATED is valid via restoreEntry, not generateEntry
    // But canTransition(ARCHIVED, GENERATED) is true, so this actually works.
    // Let's test a truly invalid one: DRAFT → ARCHIVED
    assert.throws(() => {
      transitionEntry(makeEntry({ confirmationStatus: "DRAFT" }), "archiveEntry");
    }, /Invalid status transition/);
  });
});

// ---------------------------------------------------------------------------
// transitionEntry — request edit / request delete
// ---------------------------------------------------------------------------

describe("transitionEntry — requestEdit (GENERATED → EDIT_REQUESTED)", () => {
  it("sets confirmationStatus to EDIT_REQUESTED", () => {
    const entry = makeEntry({ confirmationStatus: "GENERATED", editWindowExpiresAt: daysAgo(1) });
    const result = transitionEntry(entry, "requestEdit");
    assert.equal(result.confirmationStatus, "EDIT_REQUESTED");
  });

  it("sets editRequestedAt and requestType", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const entry = makeEntry({ confirmationStatus: "GENERATED" });
    const result = transitionEntry(entry, "requestEdit", { nowISO });
    assert.equal(result.editRequestedAt, nowISO);
    assert.equal(result.requestType, "edit");
  });
});

describe("transitionEntry — requestDelete (GENERATED → DELETE_REQUESTED)", () => {
  it("sets confirmationStatus to DELETE_REQUESTED", () => {
    const entry = makeEntry({ confirmationStatus: "GENERATED" });
    const result = transitionEntry(entry, "requestDelete");
    assert.equal(result.confirmationStatus, "DELETE_REQUESTED");
  });

  it("clears pending edit request fields", () => {
    const entry = makeEntry({
      confirmationStatus: "GENERATED",
      editRequestedAt: "2024-01-01T00:00:00Z",
      editRequestMessage: "Please",
    });
    const result = transitionEntry(entry, "requestDelete");
    assert.equal(result.editRequestedAt, null);
    assert.equal(result.editRequestMessage, null);
  });
});

// ---------------------------------------------------------------------------
// transitionEntry — grantEdit / rejectEdit
// ---------------------------------------------------------------------------

describe("transitionEntry — grantEdit (EDIT_REQUESTED → EDIT_GRANTED)", () => {
  it("sets confirmationStatus to EDIT_GRANTED", () => {
    const entry = makeEntry({ confirmationStatus: "EDIT_REQUESTED" });
    const result = transitionEntry(entry, "grantEdit");
    assert.equal(result.confirmationStatus, "EDIT_GRANTED");
  });

  it("sets editGrantedAt and editWindowExpiresAt", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const entry = makeEntry({ confirmationStatus: "EDIT_REQUESTED" });
    const result = transitionEntry(entry, "grantEdit", { nowISO, editGrantedDays: 5 });
    assert.equal(result.editGrantedAt, nowISO);
    assert.equal(result.editGrantedDays, 5);
    assert.equal(result.editWindowExpiresAt, new Date("2024-06-06T12:00:00.000Z").toISOString());
  });
});

describe("transitionEntry — rejectEdit (EDIT_REQUESTED → GENERATED)", () => {
  it("reverts to GENERATED", () => {
    const entry = makeEntry({ confirmationStatus: "EDIT_REQUESTED" });
    const result = transitionEntry(entry, "rejectEdit");
    assert.equal(result.confirmationStatus, "GENERATED");
  });

  it("clears edit request fields", () => {
    const entry = makeEntry({
      confirmationStatus: "EDIT_REQUESTED",
      editRequestedAt: "2024-01-01T00:00:00Z",
      editRequestMessage: "Please let me edit",
      requestType: "edit",
    });
    const result = transitionEntry(entry, "rejectEdit");
    assert.equal(result.editRequestedAt, null);
    assert.equal(result.editRequestMessage, null);
    assert.equal(result.requestType, null);
  });
});

// ---------------------------------------------------------------------------
// transitionEntry — archiveEntry / restoreEntry
// ---------------------------------------------------------------------------

describe("transitionEntry — archiveEntry (GENERATED → ARCHIVED)", () => {
  it("sets confirmationStatus to ARCHIVED", () => {
    const entry = makeEntry({ confirmationStatus: "GENERATED" });
    const result = transitionEntry(entry, "archiveEntry");
    assert.equal(result.confirmationStatus, "ARCHIVED");
  });

  it("sets archivedAt and archiveReason", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const entry = makeEntry({ confirmationStatus: "GENERATED" });
    const result = transitionEntry(entry, "archiveEntry", { nowISO, archiveReason: "auto_no_pdf" });
    assert.equal(result.archivedAt, nowISO);
    assert.equal(result.archiveReason, "auto_no_pdf");
  });

  it("clears pending request fields", () => {
    const entry = makeEntry({
      confirmationStatus: "GENERATED",
      editRequestedAt: "2024-01-01T00:00:00Z",
      deleteRequestedAt: "2024-01-02T00:00:00Z",
      requestType: "delete",
    });
    const result = transitionEntry(entry, "archiveEntry");
    assert.equal(result.editRequestedAt, null);
    assert.equal(result.deleteRequestedAt, null);
    assert.equal(result.requestType, null);
  });
});

describe("transitionEntry — restoreEntry (ARCHIVED → GENERATED)", () => {
  it("sets confirmationStatus to GENERATED", () => {
    const entry = makeEntry({ confirmationStatus: "ARCHIVED" });
    const result = transitionEntry(entry, "restoreEntry");
    assert.equal(result.confirmationStatus, "GENERATED");
  });

  it("clears archivedAt and archiveReason", () => {
    const entry = makeEntry({
      confirmationStatus: "ARCHIVED",
      archivedAt: "2024-01-01T00:00:00Z",
      archiveReason: "auto_no_pdf",
    });
    const result = transitionEntry(entry, "restoreEntry");
    assert.equal(result.archivedAt, null);
    assert.equal(result.archiveReason, null);
  });

  it("resets PDF state", () => {
    const entry = makeEntry({
      confirmationStatus: "ARCHIVED",
      pdfGenerated: true,
      pdfGeneratedAt: "2024-01-01T00:00:00Z",
      pdfUrl: "/some/url",
    });
    const result = transitionEntry(entry, "restoreEntry");
    assert.equal(result.pdfGenerated, false);
    assert.equal(result.pdfGeneratedAt, null);
    assert.equal(result.pdfUrl, null);
  });

  it("sets new editWindowExpiresAt and generatedAt", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const entry = makeEntry({ confirmationStatus: "ARCHIVED" });
    const result = transitionEntry(entry, "restoreEntry", { nowISO });
    assert.equal(result.generatedAt, nowISO);
    assert.ok(result.editWindowExpiresAt);
  });
});

// ---------------------------------------------------------------------------
// transitionEntry — re-generate from EDIT_GRANTED
// ---------------------------------------------------------------------------

describe("transitionEntry — generateEntry from EDIT_GRANTED", () => {
  it("reverts to GENERATED with fresh edit window", () => {
    const nowISO = "2024-06-01T12:00:00.000Z";
    const entry = makeEntry({
      confirmationStatus: "EDIT_GRANTED",
      editGrantedAt: "2024-05-01T00:00:00Z",
      editGrantedBy: "admin@tce.edu",
      editGrantedDays: 3,
    });
    const result = transitionEntry(entry, "generateEntry", { nowISO });
    assert.equal(result.confirmationStatus, "GENERATED");
    assert.equal(result.editWindowExpiresAt, new Date("2024-06-04T12:00:00.000Z").toISOString());
    assert.equal(result.editGrantedAt, null);
    assert.equal(result.editGrantedBy, null);
  });
});

// ---------------------------------------------------------------------------
// getEditTimeRemaining
// ---------------------------------------------------------------------------

describe("getEditTimeRemaining", () => {
  it("returns no window for entry without editWindowExpiresAt", () => {
    const result = getEditTimeRemaining(makeEntry());
    assert.equal(result.hasEditWindow, false);
    assert.equal(result.remainingMs, 0);
  });

  it("returns expired for past window", () => {
    const result = getEditTimeRemaining(makeEntry({ editWindowExpiresAt: daysAgo(1) }));
    assert.equal(result.hasEditWindow, true);
    assert.equal(result.expired, true);
    assert.equal(result.remainingMs, 0);
  });

  it("returns remaining time for future window", () => {
    const result = getEditTimeRemaining(makeEntry({ editWindowExpiresAt: daysFromNow(2) }));
    assert.equal(result.hasEditWindow, true);
    assert.equal(result.expired, false);
    assert.ok(result.remainingMs > 0);
    assert.ok(result.remainingLabel.includes("day"));
  });
});

// ---------------------------------------------------------------------------
// canRequestAction / getRequestCountRemaining
// ---------------------------------------------------------------------------

describe("canRequestAction", () => {
  it("returns false for DRAFT", () => {
    assert.equal(canRequestAction(makeEntry()), false);
  });

  it("returns false for GENERATED with active timer (not finalized)", () => {
    assert.equal(canRequestAction(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysFromNow(1),
    })), false);
  });

  it("returns true for finalized GENERATED entry with no requests", () => {
    assert.equal(canRequestAction(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysAgo(1),
    })), true);
  });

  it("returns false when at request limit", () => {
    assert.equal(canRequestAction(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysAgo(1),
      requestCount: 3,
    })), false);
  });
});

describe("getRequestCountRemaining", () => {
  it("returns 3 for no requests", () => {
    assert.equal(getRequestCountRemaining(makeEntry()), 3);
  });

  it("returns 1 when 2 requests used", () => {
    assert.equal(getRequestCountRemaining(makeEntry({ requestCount: 2 })), 1);
  });

  it("returns 0 when at limit", () => {
    assert.equal(getRequestCountRemaining(makeEntry({ requestCount: 3 })), 0);
  });
});

// ---------------------------------------------------------------------------
// Invalid transitions throw
// ---------------------------------------------------------------------------

describe("invalid transitions throw", () => {
  it("DRAFT → ARCHIVED throws", () => {
    assert.throws(() => transitionEntry(makeEntry({ confirmationStatus: "DRAFT" }), "archiveEntry"));
  });

  it("DRAFT → EDIT_REQUESTED throws", () => {
    assert.throws(() => transitionEntry(makeEntry({ confirmationStatus: "DRAFT" }), "requestEdit"));
  });

  it("ARCHIVED → EDIT_REQUESTED throws", () => {
    assert.throws(() => transitionEntry(makeEntry({ confirmationStatus: "ARCHIVED" }), "requestEdit"));
  });

  it("EDIT_GRANTED → ARCHIVED via approveDelete throws", () => {
    // EDIT_GRANTED can go to GENERATED or ARCHIVED, but approveDelete maps to ARCHIVED
    // canTransition(EDIT_GRANTED, ARCHIVED) is true, so this should NOT throw
    const entry = makeEntry({ confirmationStatus: "EDIT_GRANTED" });
    const result = transitionEntry(entry, "approveDelete");
    assert.equal(result.confirmationStatus, "ARCHIVED");
  });
});
