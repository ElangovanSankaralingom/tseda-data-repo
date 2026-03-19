import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ensureFileMetaArray,
  ensureFacultyArray,
  ensureFaculty,
  ensureStreak,
  safeString,
  safeNumber,
  safeBoolString,
  extractNestedUpload,
} from "../../lib/entries/hydrateEntry.ts";

// ---------------------------------------------------------------------------
// safeString
// ---------------------------------------------------------------------------

describe("safeString", () => {
  it("returns string as-is", () => {
    assert.equal(safeString("hello"), "hello");
  });
  it("returns empty string for null", () => {
    assert.equal(safeString(null), "");
  });
  it("returns empty string for undefined", () => {
    assert.equal(safeString(undefined), "");
  });
  it("returns empty string for number", () => {
    assert.equal(safeString(42), "");
  });
  it("returns fallback when provided", () => {
    assert.equal(safeString(null, "fallback"), "fallback");
  });
});

// ---------------------------------------------------------------------------
// safeNumber
// ---------------------------------------------------------------------------

describe("safeNumber", () => {
  it("returns number as-is", () => {
    assert.equal(safeNumber(42), 42);
  });
  it("returns null for string", () => {
    assert.equal(safeNumber("hello"), null);
  });
  it("returns null for null", () => {
    assert.equal(safeNumber(null), null);
  });
  it("returns null for NaN", () => {
    assert.equal(safeNumber(NaN), null);
  });
  it("returns null for Infinity", () => {
    assert.equal(safeNumber(Infinity), null);
  });
  it("returns 0 for 0", () => {
    assert.equal(safeNumber(0), 0);
  });
});

// ---------------------------------------------------------------------------
// safeBoolString
// ---------------------------------------------------------------------------

describe("safeBoolString", () => {
  it('returns "Yes" for "Yes"', () => {
    assert.equal(safeBoolString("Yes"), "Yes");
  });
  it('returns "No" for "No"', () => {
    assert.equal(safeBoolString("No"), "No");
  });
  it('returns "" for other strings', () => {
    assert.equal(safeBoolString("maybe"), "");
  });
  it('returns "" for null', () => {
    assert.equal(safeBoolString(null), "");
  });
});

// ---------------------------------------------------------------------------
// ensureFileMetaArray
// ---------------------------------------------------------------------------

describe("ensureFileMetaArray", () => {
  it("returns array as-is", () => {
    const arr = [{ storedPath: "a", url: "b", fileName: "c", size: 100, mimeType: "pdf", uploadedAt: "" }];
    assert.deepStrictEqual(ensureFileMetaArray(arr), arr);
  });
  it("wraps single FileMeta object in array", () => {
    const meta = { storedPath: "a", url: "b", fileName: "c", size: 100, mimeType: "pdf", uploadedAt: "" };
    const result = ensureFileMetaArray(meta);
    assert.equal(result.length, 1);
    assert.equal(result[0].storedPath, "a");
  });
  it("returns empty array for null", () => {
    assert.deepStrictEqual(ensureFileMetaArray(null), []);
  });
  it("returns empty array for undefined", () => {
    assert.deepStrictEqual(ensureFileMetaArray(undefined), []);
  });
  it("returns empty array for string", () => {
    assert.deepStrictEqual(ensureFileMetaArray("not a file"), []);
  });
});

// ---------------------------------------------------------------------------
// ensureFaculty
// ---------------------------------------------------------------------------

describe("ensureFaculty", () => {
  it("extracts name and email from object", () => {
    const result = ensureFaculty({ name: "John", email: "john@tce.edu" });
    assert.equal(result.name, "John");
    assert.equal(result.email, "john@tce.edu");
  });
  it("returns empty defaults for null", () => {
    const result = ensureFaculty(null);
    assert.equal(result.name, "");
    assert.equal(result.email, "");
  });
  it("handles missing fields gracefully", () => {
    const result = ensureFaculty({ name: "John" });
    assert.equal(result.name, "John");
    assert.equal(result.email, "");
  });
});

// ---------------------------------------------------------------------------
// ensureFacultyArray
// ---------------------------------------------------------------------------

describe("ensureFacultyArray", () => {
  it("returns array as-is", () => {
    const arr = [{ name: "A", email: "a@tce.edu" }];
    assert.deepStrictEqual(ensureFacultyArray(arr), arr);
  });
  it("returns empty array for null", () => {
    assert.deepStrictEqual(ensureFacultyArray(null), []);
  });
  it("returns empty array for string", () => {
    assert.deepStrictEqual(ensureFacultyArray("not an array"), []);
  });
});

// ---------------------------------------------------------------------------
// ensureStreak
// ---------------------------------------------------------------------------

describe("ensureStreak", () => {
  it("extracts streak fields from object", () => {
    const result = ensureStreak({ activatedAtISO: "2026-01-01", dueAtISO: "2026-01-05", completedAtISO: null, windowDays: 3 });
    assert.equal(result.activatedAtISO, "2026-01-01");
    assert.equal(result.windowDays, 3);
  });
  it("returns defaults for null", () => {
    const result = ensureStreak(null);
    assert.equal(result.activatedAtISO, null);
    assert.equal(result.windowDays, 5);
  });
  it("returns defaults for empty object", () => {
    const result = ensureStreak({});
    assert.equal(result.activatedAtISO, null);
    assert.equal(result.windowDays, 5);
  });
});

// ---------------------------------------------------------------------------
// extractNestedUpload
// ---------------------------------------------------------------------------

describe("extractNestedUpload", () => {
  it("extracts from nested uploads object", () => {
    const entry = {
      uploads: {
        permissionLetter: [{ storedPath: "a", url: "b", fileName: "c", size: 1, mimeType: "pdf", uploadedAt: "" }],
      },
    };
    const result = extractNestedUpload(entry as Record<string, unknown>, "permissionLetter");
    assert.equal(result.length, 1);
  });
  it("falls back to top-level field", () => {
    const entry = {
      permissionLetter: [{ storedPath: "x", url: "y", fileName: "z", size: 1, mimeType: "pdf", uploadedAt: "" }],
    };
    const result = extractNestedUpload(entry as Record<string, unknown>, "permissionLetter");
    assert.equal(result.length, 1);
  });
  it("returns empty array when neither exists", () => {
    const result = extractNestedUpload({} as Record<string, unknown>, "permissionLetter");
    assert.deepStrictEqual(result, []);
  });
});
