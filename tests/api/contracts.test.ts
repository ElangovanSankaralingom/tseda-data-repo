import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entryToApiResponse, entriesToApiResponse } from "../../lib/entries/toApiResponse.ts";
import { ENTRY_STATUSES } from "../../lib/types/entry.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

function makeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "contract-test-1",
    category: "workshops",
    ownerEmail: "user@tce.edu",
    createdAt: "2024-06-01T00:00:00Z",
    updatedAt: "2024-06-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Contract: response shape
// ---------------------------------------------------------------------------

describe("API contract — response shape", () => {
  it("always includes isEditable as boolean", () => {
    const result = entryToApiResponse(makeEntry(), "workshops");
    assert.equal(typeof result.isEditable, "boolean");
  });

  it("always includes isFinalized as boolean", () => {
    const result = entryToApiResponse(makeEntry(), "workshops");
    assert.equal(typeof result.isFinalized, "boolean");
  });

  it("always includes editTimeRemaining object", () => {
    const result = entryToApiResponse(makeEntry(), "workshops");
    assert.ok(result.editTimeRemaining !== null);
    assert.equal(typeof result.editTimeRemaining, "object");
    assert.equal(typeof result.editTimeRemaining.hasEditWindow, "boolean");
    assert.equal(typeof result.editTimeRemaining.expired, "boolean");
    assert.equal(typeof result.editTimeRemaining.remainingMs, "number");
    assert.equal(typeof result.editTimeRemaining.remainingLabel, "string");
  });

  it("always includes confirmationStatus as valid EntryStatus", () => {
    const result = entryToApiResponse(makeEntry(), "workshops");
    assert.ok(ENTRY_STATUSES.includes(result.confirmationStatus));
  });

  it("always includes pdfStale as boolean", () => {
    const result = entryToApiResponse(makeEntry(), "workshops");
    assert.equal(typeof result.pdfStale, "boolean");
  });
});

// ---------------------------------------------------------------------------
// Contract: every status produces correct flags
// ---------------------------------------------------------------------------

describe("API contract — flags per status", () => {
  it("DRAFT → editable, not finalized", () => {
    const r = entryToApiResponse(makeEntry({ confirmationStatus: "DRAFT" }), "workshops");
    assert.equal(r.isEditable, true);
    assert.equal(r.isFinalized, false);
  });

  it("GENERATED (active timer) → editable, not finalized", () => {
    const r = entryToApiResponse(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysFromNow(2),
    }), "workshops");
    assert.equal(r.isEditable, true);
    assert.equal(r.isFinalized, false);
  });

  it("GENERATED (expired timer) → not editable, finalized", () => {
    const r = entryToApiResponse(makeEntry({
      confirmationStatus: "GENERATED",
      editWindowExpiresAt: daysAgo(1),
    }), "workshops");
    assert.equal(r.isEditable, false);
    assert.equal(r.isFinalized, true);
  });

  it("EDIT_REQUESTED → not editable, not finalized", () => {
    const r = entryToApiResponse(makeEntry({ confirmationStatus: "EDIT_REQUESTED" }), "workshops");
    assert.equal(r.isEditable, false);
    assert.equal(r.isFinalized, false);
  });

  it("DELETE_REQUESTED → not editable, not finalized", () => {
    const r = entryToApiResponse(makeEntry({ confirmationStatus: "DELETE_REQUESTED" }), "workshops");
    assert.equal(r.isEditable, false);
    assert.equal(r.isFinalized, false);
  });

  it("EDIT_GRANTED → editable, not finalized", () => {
    const r = entryToApiResponse(makeEntry({ confirmationStatus: "EDIT_GRANTED" }), "workshops");
    assert.equal(r.isEditable, true);
    assert.equal(r.isFinalized, false);
  });

  it("ARCHIVED → not editable, not finalized", () => {
    const r = entryToApiResponse(makeEntry({ confirmationStatus: "ARCHIVED" }), "workshops");
    assert.equal(r.isEditable, false);
    assert.equal(r.isFinalized, false);
  });
});

// ---------------------------------------------------------------------------
// Contract: empty/null fields
// ---------------------------------------------------------------------------

describe("API contract — edge cases", () => {
  it("completely empty entry does not crash", () => {
    const r = entryToApiResponse({}, "workshops");
    assert.equal(r.confirmationStatus, "DRAFT");
    assert.equal(r.isEditable, true);
    assert.equal(r.isFinalized, false);
    assert.ok(r.editTimeRemaining);
  });

  it("null confirmationStatus normalizes to DRAFT", () => {
    const r = entryToApiResponse(makeEntry({ confirmationStatus: null }), "workshops");
    assert.equal(r.confirmationStatus, "DRAFT");
  });

  it("undefined fields don't crash", () => {
    const r = entryToApiResponse(makeEntry({
      confirmationStatus: undefined,
      editWindowExpiresAt: undefined,
      pdfGenerated: undefined,
    }), "workshops");
    assert.equal(typeof r.isEditable, "boolean");
    assert.equal(typeof r.pdfStale, "boolean");
  });

  it("preserves original entry data", () => {
    const r = entryToApiResponse(makeEntry({
      eventName: "My Workshop",
      participants: 50,
    }), "workshops");
    assert.equal(r.eventName, "My Workshop");
    assert.equal(r.participants, 50);
  });

  it("batch conversion works for empty array", () => {
    const results = entriesToApiResponse([], "workshops");
    assert.equal(results.length, 0);
  });

  it("batch conversion preserves per-entry contracts", () => {
    const results = entriesToApiResponse([
      makeEntry({ id: "e1", confirmationStatus: "DRAFT" }),
      makeEntry({ id: "e2", confirmationStatus: "GENERATED", editWindowExpiresAt: daysAgo(1) }),
    ], "workshops");
    assert.equal(results.length, 2);
    assert.equal(results[0].isEditable, true);
    assert.equal(results[1].isFinalized, true);
  });
});

// ---------------------------------------------------------------------------
// Contract: all 5 categories
// ---------------------------------------------------------------------------

describe("API contract — all categories", () => {
  const categories = ["fdp-attended", "fdp-conducted", "guest-lectures", "case-studies", "workshops"];
  for (const cat of categories) {
    it(`produces valid response for ${cat}`, () => {
      const r = entryToApiResponse(makeEntry({ confirmationStatus: "GENERATED" }), cat);
      assert.equal(typeof r.isEditable, "boolean");
      assert.equal(typeof r.isFinalized, "boolean");
      assert.equal(typeof r.pdfStale, "boolean");
      assert.ok(ENTRY_STATUSES.includes(r.confirmationStatus));
    });
  }
});
