import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fdpAttendedSchema } from "../../data/schemas/fdp-attended.ts";
import { fdpConductedSchema } from "../../data/schemas/fdp-conducted.ts";
import { guestLecturesSchema } from "../../data/schemas/guest-lectures.ts";
import { caseStudiesSchema } from "../../data/schemas/case-studies.ts";
import { workshopsSchema } from "../../data/schemas/workshops.ts";

function getUploadFieldKeys(schema: { fields: readonly { key: string; upload?: boolean }[] }): string[] {
  return schema.fields.filter((f) => f.upload).map((f) => f.key);
}

describe("upload slot consistency", () => {
  it("fdp-attended has permissionLetter and completionCertificate", () => {
    const keys = getUploadFieldKeys(fdpAttendedSchema);
    assert.ok(keys.includes("permissionLetter"));
    assert.ok(keys.includes("completionCertificate"));
    assert.equal(keys.length, 2);
  });

  it("fdp-conducted has 4 upload slots", () => {
    const keys = getUploadFieldKeys(fdpConductedSchema);
    assert.ok(keys.includes("permissionLetter"));
    assert.ok(keys.includes("geotaggedPhotos"));
    assert.ok(keys.includes("attendanceSheet"));
    assert.ok(keys.includes("officialPoster"));
    assert.equal(keys.length, 4);
  });

  it("guest-lectures has 4 upload slots", () => {
    const keys = getUploadFieldKeys(guestLecturesSchema);
    assert.ok(keys.includes("permissionLetter"));
    assert.ok(keys.includes("geotaggedPhotos"));
    assert.ok(keys.includes("attendanceSheet"));
    assert.ok(keys.includes("officialPoster"));
    assert.equal(keys.length, 4);
  });

  it("case-studies has 6 upload slots", () => {
    const keys = getUploadFieldKeys(caseStudiesSchema);
    assert.ok(keys.includes("permissionLetter"));
    assert.ok(keys.includes("travelPlan"));
    assert.ok(keys.includes("geotaggedPhotos"));
    assert.ok(keys.includes("report"));
    assert.ok(keys.includes("feedback"));
    assert.ok(keys.includes("advanceClosure"));
    assert.equal(keys.length, 6);
  });

  it("workshops has 4 upload slots", () => {
    const keys = getUploadFieldKeys(workshopsSchema);
    assert.ok(keys.includes("permissionLetter"));
    assert.ok(keys.includes("geotaggedPhotos"));
    assert.ok(keys.includes("attendanceSheet"));
    assert.ok(keys.includes("officialPoster"));
    assert.equal(keys.length, 4);
  });

  it("all upload fields across all schemas are kind array", () => {
    const allSchemas = [fdpAttendedSchema, fdpConductedSchema, guestLecturesSchema, caseStudiesSchema, workshopsSchema];
    for (const schema of allSchemas) {
      const uploads = schema.fields.filter((f) => f.upload);
      for (const field of uploads) {
        assert.equal(field.kind, "array", `${schema.category}.${field.key} should be kind: array but is ${field.kind}`);
      }
    }
  });

  it("all upload fields are stage 2", () => {
    const allSchemas = [fdpAttendedSchema, fdpConductedSchema, guestLecturesSchema, caseStudiesSchema, workshopsSchema];
    for (const schema of allSchemas) {
      const uploads = schema.fields.filter((f) => f.upload);
      for (const field of uploads) {
        assert.equal(field.stage, 2, `${schema.category}.${field.key} should be stage 2 but is ${field.stage}`);
      }
    }
  });
});
