import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { entryToApiResponse, entriesToApiResponse } from "@/lib/entries/toApiResponse";
import { ENTRY_STATUSES, type EntryStatus } from "@/lib/types/entry";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

function makeRawEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "test-entry-1",
    category: "workshops",
    ownerEmail: "user@tce.edu",
    createdAt: "2024-06-01T00:00:00Z",
    updatedAt: "2024-06-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Required computed fields are always present
// ---------------------------------------------------------------------------

describe("entryToApiResponse — required fields", () => {
  it("always includes isEditable as boolean", () => {
    const result = entryToApiResponse(makeRawEntry(), "workshops");
    assert.equal(typeof result.isEditable, "boolean");
  });

  it("always includes isFinalized as boolean", () => {
    const result = entryToApiResponse(makeRawEntry(), "workshops");
    assert.equal(typeof result.isFinalized, "boolean");
  });

  it("always includes editTimeRemaining as object", () => {
    const result = entryToApiResponse(makeRawEntry(), "workshops");
    assert.equal(typeof result.editTimeRemaining, "object");
    assert.ok(result.editTimeRemaining !== null);
    assert.equal(typeof result.editTimeRemaining.hasEditWindow, "boolean");
    assert.equal(typeof result.editTimeRemaining.expired, "boolean");
    assert.equal(typeof result.editTimeRemaining.remainingMs, "number");
    assert.equal(typeof result.editTimeRemaining.remainingLabel, "string");
  });

  it("always includes confirmationStatus as valid EntryStatus", () => {
    const result = entryToApiResponse(makeRawEntry(), "workshops");
    assert.ok(
      ENTRY_STATUSES.includes(result.confirmationStatus),
      `Expected valid EntryStatus but got: ${result.confirmationStatus}`,
    );
  });

  it("includes pdfStale as boolean", () => {
    const result = entryToApiResponse(makeRawEntry(), "workshops");
    assert.equal(typeof result.pdfStale, "boolean");
  });
});

// ---------------------------------------------------------------------------
// Correct status handling for all 6 statuses
// ---------------------------------------------------------------------------

describe("entryToApiResponse — all 6 statuses", () => {
  for (const status of ENTRY_STATUSES) {
    it(`handles ${status} status correctly`, () => {
      const entry = makeRawEntry({
        confirmationStatus: status,
        editWindowExpiresAt: status === "GENERATED" ? daysAgo(1) : undefined,
      });
      const result = entryToApiResponse(entry, "workshops");
      assert.equal(result.confirmationStatus, status);
      assert.equal(typeof result.isEditable, "boolean");
      assert.equal(typeof result.isFinalized, "boolean");
    });
  }
});

// ---------------------------------------------------------------------------
// isEditable / isFinalized computed correctly
// ---------------------------------------------------------------------------

describe("entryToApiResponse — computed editability/finalization", () => {
  it("DRAFT is editable and not finalized", () => {
    const result = entryToApiResponse(makeRawEntry({ confirmationStatus: "DRAFT" }), "workshops");
    assert.equal(result.isEditable, true);
    assert.equal(result.isFinalized, false);
  });

  it("GENERATED with active timer is editable and not finalized", () => {
    const result = entryToApiResponse(
      makeRawEntry({
        confirmationStatus: "GENERATED",
        editWindowExpiresAt: daysFromNow(2),
      }),
      "workshops",
    );
    assert.equal(result.isEditable, true);
    assert.equal(result.isFinalized, false);
  });

  it("GENERATED with expired timer is not editable and is finalized", () => {
    const result = entryToApiResponse(
      makeRawEntry({
        confirmationStatus: "GENERATED",
        editWindowExpiresAt: daysAgo(1),
      }),
      "workshops",
    );
    assert.equal(result.isEditable, false);
    assert.equal(result.isFinalized, true);
  });

  it("EDIT_GRANTED is editable and not finalized", () => {
    const result = entryToApiResponse(
      makeRawEntry({ confirmationStatus: "EDIT_GRANTED" }),
      "workshops",
    );
    assert.equal(result.isEditable, true);
    assert.equal(result.isFinalized, false);
  });

  it("ARCHIVED is not editable and not finalized", () => {
    const result = entryToApiResponse(
      makeRawEntry({ confirmationStatus: "ARCHIVED" }),
      "workshops",
    );
    assert.equal(result.isEditable, false);
    assert.equal(result.isFinalized, false);
  });
});

// ---------------------------------------------------------------------------
// editTimeRemaining
// ---------------------------------------------------------------------------

describe("entryToApiResponse — editTimeRemaining", () => {
  it("entry with no editWindowExpiresAt has no window", () => {
    const result = entryToApiResponse(makeRawEntry({ confirmationStatus: "DRAFT" }), "workshops");
    assert.equal(result.editTimeRemaining.hasEditWindow, false);
    assert.equal(result.editTimeRemaining.expired, false);
    assert.equal(result.editTimeRemaining.remainingMs, 0);
  });

  it("entry with future window has remaining time", () => {
    const result = entryToApiResponse(
      makeRawEntry({
        confirmationStatus: "GENERATED",
        editWindowExpiresAt: daysFromNow(2),
      }),
      "workshops",
    );
    assert.equal(result.editTimeRemaining.hasEditWindow, true);
    assert.equal(result.editTimeRemaining.expired, false);
    assert.ok(result.editTimeRemaining.remainingMs > 0);
  });

  it("entry with expired window shows expired", () => {
    const result = entryToApiResponse(
      makeRawEntry({
        confirmationStatus: "GENERATED",
        editWindowExpiresAt: daysAgo(1),
      }),
      "workshops",
    );
    assert.equal(result.editTimeRemaining.hasEditWindow, true);
    assert.equal(result.editTimeRemaining.expired, true);
    assert.equal(result.editTimeRemaining.remainingMs, 0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("entryToApiResponse — edge cases", () => {
  it("entry with no pdfGenerated field defaults pdfStale correctly", () => {
    const result = entryToApiResponse(makeRawEntry({ confirmationStatus: "DRAFT" }), "workshops");
    assert.equal(typeof result.pdfStale, "boolean");
  });

  it("entry with no editWindowExpiresAt — isFinalized should be false", () => {
    const result = entryToApiResponse(
      makeRawEntry({ confirmationStatus: "GENERATED" }),
      "workshops",
    );
    assert.equal(result.isFinalized, false);
  });

  it("entry with corrupted/invalid editWindowExpiresAt does not crash", () => {
    const result = entryToApiResponse(
      makeRawEntry({
        confirmationStatus: "GENERATED",
        editWindowExpiresAt: "not-a-date",
      }),
      "workshops",
    );
    assert.equal(typeof result.isEditable, "boolean");
    assert.equal(typeof result.isFinalized, "boolean");
  });

  it("entry with corrupted confirmationStatus normalizes to DRAFT", () => {
    const result = entryToApiResponse(
      makeRawEntry({ confirmationStatus: "INVALID_STATUS" }),
      "workshops",
    );
    assert.equal(result.confirmationStatus, "DRAFT");
  });

  it("completely empty entry does not crash", () => {
    const result = entryToApiResponse({}, "workshops");
    assert.equal(result.confirmationStatus, "DRAFT");
    assert.equal(result.isEditable, true);
    assert.equal(result.isFinalized, false);
    assert.ok(result.editTimeRemaining);
  });

  it("preserves original entry fields in the response", () => {
    const result = entryToApiResponse(
      makeRawEntry({
        confirmationStatus: "DRAFT",
        eventName: "Test Workshop",
        speakerName: "Dr. Test",
      }),
      "workshops",
    );
    assert.equal(result.eventName, "Test Workshop");
    assert.equal(result.speakerName, "Dr. Test");
  });
});

// ---------------------------------------------------------------------------
// entriesToApiResponse (batch)
// ---------------------------------------------------------------------------

describe("entriesToApiResponse", () => {
  it("converts array of entries", () => {
    const results = entriesToApiResponse(
      [
        makeRawEntry({ id: "e1", confirmationStatus: "DRAFT" }),
        makeRawEntry({ id: "e2", confirmationStatus: "GENERATED", editWindowExpiresAt: daysAgo(1) }),
      ],
      "workshops",
    );
    assert.equal(results.length, 2);
    assert.equal(results[0].isEditable, true);
    assert.equal(results[1].isFinalized, true);
  });

  it("returns empty array for empty input", () => {
    const results = entriesToApiResponse([], "workshops");
    assert.equal(results.length, 0);
  });
});

// ---------------------------------------------------------------------------
// All 5 categories work
// ---------------------------------------------------------------------------

describe("entryToApiResponse — all categories", () => {
  const categories = ["fdp-attended", "fdp-conducted", "guest-lectures", "case-studies", "workshops"];
  for (const cat of categories) {
    it(`works with ${cat}`, () => {
      const result = entryToApiResponse(makeRawEntry({ confirmationStatus: "DRAFT" }), cat);
      assert.equal(result.confirmationStatus, "DRAFT");
      assert.equal(typeof result.pdfStale, "boolean");
    });
  }
});
