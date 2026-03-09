import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { YEAR_OF_STUDY_VALUES } from "@/lib/types/academicProgression";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "placeOfVisit", label: "Place of Visit", kind: "string" },
  { key: "purposeOfVisit", label: "Purpose of Visit", kind: "string" },
  { key: "coordinator", label: "Coordinator", kind: "object" },
  { key: "staffAccompanying", label: "Staff Accompanying", kind: "array" },
  { key: "yearOfStudy", label: "Year of Study", kind: "string", enumValues: YEAR_OF_STUDY_VALUES },
  { key: "currentSemester", label: "Current Semester", kind: "number", min: 1, max: 10 },
  { key: "participants", label: "Participants", kind: "number" },
  { key: "amountSupport", label: "Amount Support", kind: "number" },
  { key: "permissionLetter", label: "Permission Letter", kind: "object", upload: true, stage: 2 },
  { key: "travelPlan", label: "Travel Plan", kind: "object", upload: true, stage: 2 },
  { key: "geotaggedPhotos", label: "Geotagged Photos", kind: "array", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const caseStudiesSchema: EntrySchema = {
  category: "case-studies",
  fields,
  immutableWhenPending: [
    "academicYear",
    "startDate",
    "endDate",
    "placeOfVisit",
    "purposeOfVisit",
    "coordinator",
    "staffAccompanying",
    "yearOfStudy",
    "currentSemester",
    "participants",
    "amountSupport",
  ],
  requiredForCommit: [
    "academicYear",
    "startDate",
    "endDate",
    "placeOfVisit",
    "purposeOfVisit",
    "staffAccompanying",
    "yearOfStudy",
    "currentSemester",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
