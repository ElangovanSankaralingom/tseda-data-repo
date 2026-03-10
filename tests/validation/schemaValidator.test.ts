import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateByFieldDefinitions } from "../../data/schemas/common.ts";
import type { SchemaFieldDefinition } from "../../data/schemas/types.ts";
import { workshopsSchema } from "../../data/schemas/workshops.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_FIELDS: SchemaFieldDefinition[] = [
  { key: "id", label: "ID", kind: "string", required: true },
  { key: "title", label: "Title", kind: "string", required: true, maxLength: 100 },
  { key: "startDate", label: "Start Date", kind: "date", required: true },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "count", label: "Count", kind: "number", min: 1, max: 100 },
  { key: "active", label: "Active", kind: "boolean" },
  { key: "tags", label: "Tags", kind: "array" },
  { key: "meta", label: "Metadata", kind: "object" },
  { key: "category", label: "Category", kind: "string", enumValues: ["A", "B", "C"] },
  { key: "uploads", label: "Uploads", kind: "object", upload: true, stage: 2 },
];

// ---------------------------------------------------------------------------
// Required field validation
// ---------------------------------------------------------------------------

describe("schema validation — required fields", () => {
  it("returns error for missing required field on create", () => {
    const errors = validateByFieldDefinitions(
      { id: "" },
      "create",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "id"));
    assert.ok(errors[0].message.includes("required"));
  });

  it("returns no error when all required fields present", () => {
    const errors = validateByFieldDefinitions(
      { id: "abc", title: "Test", startDate: "2024-06-01" },
      "create",
      SAMPLE_FIELDS,
    );
    assert.equal(errors.length, 0);
  });

  it("skips required check on update mode for absent fields", () => {
    const errors = validateByFieldDefinitions(
      { title: "Updated" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.equal(errors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Type validation
// ---------------------------------------------------------------------------

describe("schema validation — type checking", () => {
  it("rejects non-string for string field", () => {
    const errors = validateByFieldDefinitions(
      { title: 123 },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "title" && e.message.includes("string")));
  });

  it("rejects non-number for number field", () => {
    const errors = validateByFieldDefinitions(
      { count: "five" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "count" && e.message.includes("number")));
  });

  it("rejects NaN for number field", () => {
    const errors = validateByFieldDefinitions(
      { count: NaN },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "count"));
  });

  it("rejects non-boolean for boolean field", () => {
    const errors = validateByFieldDefinitions(
      { active: "yes" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "active" && e.message.includes("boolean")));
  });

  it("rejects non-array for array field", () => {
    const errors = validateByFieldDefinitions(
      { tags: "not-array" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "tags" && e.message.includes("array")));
  });

  it("rejects non-object for object field", () => {
    const errors = validateByFieldDefinitions(
      { meta: "not-object" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "meta" && e.message.includes("object")));
  });
});

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

describe("schema validation — date format", () => {
  it("accepts valid YYYY-MM-DD date", () => {
    const errors = validateByFieldDefinitions(
      { startDate: "2024-06-01" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.equal(errors.length, 0);
  });

  it("rejects invalid date format", () => {
    const errors = validateByFieldDefinitions(
      { startDate: "06/01/2024" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "startDate" && e.message.includes("YYYY-MM-DD")));
  });

  it("rejects ISO datetime as date", () => {
    const errors = validateByFieldDefinitions(
      { startDate: "2024-06-01T00:00:00Z" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "startDate"));
  });
});

// ---------------------------------------------------------------------------
// Enum validation
// ---------------------------------------------------------------------------

describe("schema validation — enum values", () => {
  it("accepts valid enum value", () => {
    const errors = validateByFieldDefinitions(
      { category: "A" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.equal(errors.length, 0);
  });

  it("rejects invalid enum value", () => {
    const errors = validateByFieldDefinitions(
      { category: "X" },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "category" && e.message.includes("invalid")));
  });
});

// ---------------------------------------------------------------------------
// Max length / min / max validation
// ---------------------------------------------------------------------------

describe("schema validation — constraints", () => {
  it("rejects string exceeding maxLength", () => {
    const errors = validateByFieldDefinitions(
      { title: "a".repeat(101) },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "title" && e.message.includes("100")));
  });

  it("rejects number below min", () => {
    const errors = validateByFieldDefinitions(
      { count: 0 },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "count" && e.message.includes("at least")));
  });

  it("rejects number above max", () => {
    const errors = validateByFieldDefinitions(
      { count: 101 },
      "update",
      SAMPLE_FIELDS,
    );
    assert.ok(errors.some((e) => e.field === "count" && e.message.includes("at most")));
  });
});

// ---------------------------------------------------------------------------
// Stage 2 fields excluded from Stage 1 checks
// ---------------------------------------------------------------------------

describe("schema validation — stage 2 uploads", () => {
  it("uploads field is not required even when marked", () => {
    // Upload fields (stage 2) should not block create
    const errors = validateByFieldDefinitions(
      { id: "abc", title: "Test", startDate: "2024-06-01" },
      "create",
      SAMPLE_FIELDS,
    );
    // No error for missing uploads
    assert.ok(!errors.some((e) => e.field === "uploads"));
  });
});

// ---------------------------------------------------------------------------
// Workshops schema integration
// ---------------------------------------------------------------------------

describe("workshopsSchema.validate", () => {
  it("returns no errors for valid create payload", () => {
    const errors = workshopsSchema.validate(
      {
        id: "w1",
        academicYear: "2025-26",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        eventName: "Workshop",
        speakerName: "Dr. Test",
        organisationName: "TCE",
      },
      "create",
    );
    assert.equal(errors.length, 0);
  });

  it("rejects invalid semester value", () => {
    const errors = workshopsSchema.validate(
      { currentSemester: 11 },
      "update",
    );
    assert.ok(errors.some((e) => e.field === "currentSemester"));
  });

  it("rejects invalid date format on update", () => {
    const errors = workshopsSchema.validate(
      { startDate: "March 1, 2026" },
      "update",
    );
    assert.ok(errors.some((e) => e.field === "startDate"));
  });
});
