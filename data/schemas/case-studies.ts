import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { YEAR_OF_STUDY_VALUES } from "@/lib/types/academicProgression";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  // Export-filter spine (2026-07 rule): every category collects ODD/EVEN.
  // Case studies also keep yearOfStudy/currentSemester (student context).
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1, enumValues: ["ODD", "EVEN"] },
  { key: "yearOfStudy", label: "Year of Study", kind: "string", enumValues: YEAR_OF_STUDY_VALUES },
  { key: "currentSemester", label: "Current Semester", kind: "number", min: 1, max: 10 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "placeOfVisit", label: "Place of Visit", kind: "string" },
  { key: "purposeOfVisit", label: "Purpose of Visit", kind: "string" },
  { key: "staffAccompanying", label: "Staff Accompanying", kind: "array", required: false, collaborates: true },
  { key: "sponsored", label: "Sponsored", kind: "string", required: false, enumValues: ["Yes", "No"] },
  { key: "fundingAgency", label: "Funding Agency", kind: "string", required: false },
  { key: "fundingAmount", label: "Funding Amount", kind: "number", required: false, format: "currency" },
  { key: "permissionLetter", label: "Permission Letter", kind: "array", upload: true, stage: 2 },
  { key: "travelPlan", label: "Travel Plan", kind: "array", upload: true, stage: 2 },
  { key: "geotaggedPhotos", label: "Geotagged Photos", kind: "array", upload: true, stage: 2 },
  { key: "report", label: "Report", kind: "array", upload: true, stage: 2 },
  { key: "feedback", label: "Feedback from Students and Industry", kind: "array", upload: true, stage: 2 },
  { key: "advanceClosure", label: "Advance Closure", kind: "array", upload: true, stage: 2 },
  { key: "numberOfParticipants", label: "Number of Participants", kind: "number", required: false, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const caseStudiesSchema: EntrySchema = {
  category: "case-studies",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "yearOfStudy", "currentSemester",
    "startDate", "endDate", "placeOfVisit", "purposeOfVisit",
    "staffAccompanying", "sponsored", "fundingAgency", "fundingAmount",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "yearOfStudy", "currentSemester",
    "startDate", "endDate", "placeOfVisit", "purposeOfVisit",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
