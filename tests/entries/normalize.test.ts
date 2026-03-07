import assert from "node:assert/strict";
import test from "node:test";
import { workshopsSchema } from "../../data/schemas/workshops.ts";
import { normalizeEntry, normalizePayload } from "../../lib/normalize.ts";

test("normalizePayload trims strings and converts empty strings to null", () => {
  const normalized = normalizePayload(
    {
      eventName: "  Workshop Title  ",
      speakerName: "   ",
      organisationName: "\nTCE  ",
      startDate: "2026-01-12T10:45:00.000Z",
      endDate: "2026-01-13",
    },
    workshopsSchema
  );

  assert.equal(normalized.eventName, "Workshop Title");
  assert.equal(normalized.speakerName, null);
  assert.equal(normalized.organisationName, "TCE");
  assert.equal(normalized.startDate, "2026-01-12");
  assert.equal(normalized.endDate, "2026-01-13");
});

test("normalizePayload preserves invalid non-empty date strings for validator errors", () => {
  const normalized = normalizePayload(
    {
      startDate: "not-a-date",
      endDate: " 2026-02-01 ",
    },
    workshopsSchema
  );

  assert.equal(normalized.startDate, "not-a-date");
  assert.equal(normalized.endDate, "2026-02-01");
});

test("normalizeEntry guarantees timestamps and attachments shape", () => {
  const normalized = normalizeEntry(
    {
      id: "entry-1",
      eventName: "  Sample  ",
      createdAt: "2026-01-01T08:00:00+05:30",
      updatedAt: "2026-01-01 10:00:00Z",
      attachments: null,
    },
    workshopsSchema
  );

  assert.equal(normalized.eventName, "Sample");
  assert.deepEqual(normalized.attachments, []);
  assert.match(String(normalized.createdAt ?? ""), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(normalized.updatedAt ?? ""), /^\d{4}-\d{2}-\d{2}T/);
});

test("normalizePayload maps academic progression aliases and derives semester type", () => {
  const normalized = normalizePayload(
    {
      studentYear: "2nd year",
      semesterNumber: "4",
    },
    workshopsSchema
  );

  assert.equal(normalized.yearOfStudy, "2nd year");
  assert.equal(normalized.currentSemester, 4);
  assert.equal(normalized.studentYear, "2nd year");
  assert.equal(normalized.semesterNumber, 4);
  assert.equal(normalized.semesterType, "EVEN");
});
