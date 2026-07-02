import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "level", label: "Level", kind: "string", stage: 1, enumValues: ["National", "International"] },
  { key: "mode", label: "Mode", kind: "string", stage: 1, enumValues: ["Online", "Offline"] },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "workshopName", label: "Name of the Workshop", kind: "string" },
  { key: "resourcePersonName", label: "Resource Person Name", kind: "string" },
  { key: "resourcePersonDesignation", label: "Resource Person Designation", kind: "string" },
  { key: "resourcePersonOrganisation", label: "Resource Person Organisation", kind: "string" },
  { key: "coCoordinators", label: "Co-Coordinators", kind: "array", required: false, collaborates: true },
  { key: "sponsored", label: "Sponsored", kind: "string", required: false, enumValues: ["Yes", "No"] },
  { key: "fundingAgency", label: "Funding Agency", kind: "string", required: false },
  { key: "fundingAmount", label: "Funding Amount", kind: "number", required: false, format: "currency" },
  { key: "permissionLetter", label: "Permission Letter", kind: "array", upload: true, stage: 2 },
  { key: "geotaggedPhotos", label: "Geotagged Photos", kind: "array", upload: true, stage: 2 },
  { key: "attendanceSheet", label: "Attendance Sheet", kind: "array", upload: true, stage: 2 },
  { key: "officialPoster", label: "Official Poster", kind: "array", upload: true, stage: 2 },
  { key: "numberOfParticipants", label: "Number of Participants", kind: "number", required: false, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const workshopsSchema: EntrySchema = {
  category: "workshops",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "level", "mode",
    "startDate", "endDate", "workshopName",
    "resourcePersonName", "resourcePersonDesignation", "resourcePersonOrganisation",
    "coCoordinators", "sponsored", "fundingAgency", "fundingAmount",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "level", "mode",
    "startDate", "endDate", "workshopName",
    "resourcePersonName", "resourcePersonDesignation", "resourcePersonOrganisation",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
