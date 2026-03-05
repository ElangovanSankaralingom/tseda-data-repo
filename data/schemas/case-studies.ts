import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string" },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "placeOfVisit", label: "Place of Visit", kind: "string" },
  { key: "purposeOfVisit", label: "Purpose of Visit", kind: "string" },
  { key: "coordinator", label: "Coordinator", kind: "object" },
  { key: "staffAccompanying", label: "Staff Accompanying", kind: "array" },
  { key: "studentYear", label: "Student Year", kind: "string" },
  { key: "semesterNumber", label: "Semester Number", kind: "number" },
  { key: "participants", label: "Participants", kind: "number" },
  { key: "amountSupport", label: "Amount Support", kind: "number" },
  { key: "permissionLetter", label: "Permission Letter", kind: "object" },
  { key: "travelPlan", label: "Travel Plan", kind: "object" },
  { key: "geotaggedPhotos", label: "Geotagged Photos", kind: "array" },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object" },
  { key: "streak", label: "Streak", kind: "object" },
] as const;

export const caseStudiesSchema: EntrySchema = {
  category: "case-studies",
  fields,
  immutableWhenPending: [
    "academicYear",
    "semesterType",
    "startDate",
    "endDate",
    "placeOfVisit",
    "purposeOfVisit",
    "coordinator",
    "staffAccompanying",
    "studentYear",
    "semesterNumber",
    "participants",
    "amountSupport",
  ],
  requiredForCommit: [
    "academicYear",
    "semesterType",
    "startDate",
    "endDate",
    "placeOfVisit",
    "purposeOfVisit",
    "staffAccompanying",
    "studentYear",
    "semesterNumber",
    "permissionLetter",
    "travelPlan",
    "geotaggedPhotos",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
