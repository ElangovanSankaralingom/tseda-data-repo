import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fdpAttendedSchema } from "../../data/schemas/fdp-attended.ts";
import { fdpConductedSchema } from "../../data/schemas/fdp-conducted.ts";
import { guestLecturesSchema } from "../../data/schemas/guest-lectures.ts";
import { caseStudiesSchema } from "../../data/schemas/case-studies.ts";
import { workshopsSchema } from "../../data/schemas/workshops.ts";

// ---------------------------------------------------------------------------
// FDP Attended
// ---------------------------------------------------------------------------

describe("fdp-attended schema", () => {
  it("requiredForCommit includes all mandatory fields", () => {
    const required = fdpAttendedSchema.requiredForCommit ?? [];
    assert.ok(required.includes("academicYear"));
    assert.ok(required.includes("semesterType"));
    assert.ok(required.includes("level"));
    assert.ok(required.includes("mode"));
    assert.ok(required.includes("startDate"));
    assert.ok(required.includes("endDate"));
    assert.ok(required.includes("programName"));
    assert.ok(required.includes("sponsored"));
  });

  it("does NOT require fundingAgency or fundingAmount (conditionally required)", () => {
    const required = fdpAttendedSchema.requiredForCommit ?? [];
    assert.ok(!required.includes("fundingAgency"));
    assert.ok(!required.includes("fundingAmount"));
  });

  it("has mode field with Online/Offline enum", () => {
    const modeField = fdpAttendedSchema.fields.find((f) => f.key === "mode");
    assert.ok(modeField);
    assert.deepStrictEqual(modeField.enumValues, ["Online", "Offline"]);
  });

  it("has sponsored field with Yes/No enum", () => {
    const field = fdpAttendedSchema.fields.find((f) => f.key === "sponsored");
    assert.ok(field);
    assert.deepStrictEqual(field.enumValues, ["Yes", "No"]);
  });

  it("upload fields are stage 2 and kind array", () => {
    const uploads = fdpAttendedSchema.fields.filter((f) => f.upload);
    assert.ok(uploads.length >= 2);
    for (const u of uploads) {
      assert.equal(u.stage, 2);
      assert.equal(u.kind, "array");
    }
  });
});

// ---------------------------------------------------------------------------
// FDP Conducted
// ---------------------------------------------------------------------------

describe("fdp-conducted schema", () => {
  it("requiredForCommit includes standardized fields", () => {
    const required = fdpConductedSchema.requiredForCommit ?? [];
    assert.ok(required.includes("academicYear"));
    assert.ok(required.includes("semesterType"));
    assert.ok(required.includes("level"));
    assert.ok(required.includes("mode"));
    assert.ok(required.includes("programName"));
  });

  it("does NOT require yearOfStudy or currentSemester", () => {
    const required = fdpConductedSchema.requiredForCommit ?? [];
    assert.ok(!required.includes("yearOfStudy"));
    assert.ok(!required.includes("currentSemester"));
  });

  it("has attendanceSheet and officialPoster upload fields", () => {
    const keys = fdpConductedSchema.fields.map((f) => f.key);
    assert.ok(keys.includes("attendanceSheet"));
    assert.ok(keys.includes("officialPoster"));
    assert.ok(keys.includes("numberOfParticipants"));
  });
});

// ---------------------------------------------------------------------------
// Guest Lectures
// ---------------------------------------------------------------------------

describe("guest-lectures schema", () => {
  it("requiredForCommit includes guest speaker fields", () => {
    const required = guestLecturesSchema.requiredForCommit ?? [];
    assert.ok(required.includes("topicOfLecture"));
    assert.ok(required.includes("guestSpeakerName"));
    assert.ok(required.includes("guestSpeakerDesignation"));
    assert.ok(required.includes("guestSpeakerOrganisation"));
  });

  it("does NOT require yearOfStudy or currentSemester", () => {
    const required = guestLecturesSchema.requiredForCommit ?? [];
    assert.ok(!required.includes("yearOfStudy"));
    assert.ok(!required.includes("currentSemester"));
  });

  it("has semesterType, level, mode fields", () => {
    const keys = guestLecturesSchema.fields.map((f) => f.key);
    assert.ok(keys.includes("semesterType"));
    assert.ok(keys.includes("level"));
    assert.ok(keys.includes("mode"));
  });

  it("coCoordinators is not required", () => {
    const field = guestLecturesSchema.fields.find((f) => f.key === "coCoordinators");
    assert.ok(field);
    assert.equal(field.required, false);
  });
});

// ---------------------------------------------------------------------------
// Case Studies
// ---------------------------------------------------------------------------

describe("case-studies schema", () => {
  it("KEEPS yearOfStudy and currentSemester", () => {
    const required = caseStudiesSchema.requiredForCommit ?? [];
    assert.ok(required.includes("yearOfStudy"));
    assert.ok(required.includes("currentSemester"));
  });

  it("has placeOfVisit and purposeOfVisit", () => {
    const required = caseStudiesSchema.requiredForCommit ?? [];
    assert.ok(required.includes("placeOfVisit"));
    assert.ok(required.includes("purposeOfVisit"));
  });

  it("has new upload fields: report, feedback, advanceClosure", () => {
    const keys = caseStudiesSchema.fields.map((f) => f.key);
    assert.ok(keys.includes("report"));
    assert.ok(keys.includes("feedback"));
    assert.ok(keys.includes("advanceClosure"));
  });

  it("does NOT have semesterType or level", () => {
    const keys = caseStudiesSchema.fields.map((f) => f.key);
    assert.ok(!keys.includes("semesterType"));
    assert.ok(!keys.includes("level"));
  });
});

// ---------------------------------------------------------------------------
// Workshops
// ---------------------------------------------------------------------------

describe("workshops schema", () => {
  it("requiredForCommit includes resource person fields", () => {
    const required = workshopsSchema.requiredForCommit ?? [];
    assert.ok(required.includes("workshopName"));
    assert.ok(required.includes("resourcePersonName"));
    assert.ok(required.includes("resourcePersonDesignation"));
    assert.ok(required.includes("resourcePersonOrganisation"));
  });

  it("does NOT require yearOfStudy or currentSemester", () => {
    const required = workshopsSchema.requiredForCommit ?? [];
    assert.ok(!required.includes("yearOfStudy"));
    assert.ok(!required.includes("currentSemester"));
  });

  it("has semesterType, level, mode", () => {
    const keys = workshopsSchema.fields.map((f) => f.key);
    assert.ok(keys.includes("semesterType"));
    assert.ok(keys.includes("level"));
    assert.ok(keys.includes("mode"));
  });

  it("all upload fields are kind array and stage 2", () => {
    const uploads = workshopsSchema.fields.filter((f) => f.upload);
    assert.ok(uploads.length >= 4);
    for (const u of uploads) {
      assert.equal(u.stage, 2);
      assert.equal(u.kind, "array");
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-category consistency
// ---------------------------------------------------------------------------

describe("cross-category consistency", () => {
  const schemas = [
    { name: "fdp-attended", schema: fdpAttendedSchema },
    { name: "fdp-conducted", schema: fdpConductedSchema },
    { name: "guest-lectures", schema: guestLecturesSchema },
    { name: "workshops", schema: workshopsSchema },
  ];

  for (const { name, schema } of schemas) {
    it(`${name} has sponsored field with Yes/No enum`, () => {
      const field = schema.fields.find((f) => f.key === "sponsored");
      assert.ok(field, `${name} missing sponsored field`);
      assert.deepStrictEqual(field.enumValues, ["Yes", "No"]);
    });

    it(`${name} has fundingAgency and fundingAmount fields`, () => {
      const keys = schema.fields.map((f) => f.key);
      assert.ok(keys.includes("fundingAgency"), `${name} missing fundingAgency`);
      assert.ok(keys.includes("fundingAmount"), `${name} missing fundingAmount`);
    });
  }

  it("case-studies also has sponsored field", () => {
    const field = caseStudiesSchema.fields.find((f) => f.key === "sponsored");
    assert.ok(field);
    assert.deepStrictEqual(field.enumValues, ["Yes", "No"]);
  });
});
