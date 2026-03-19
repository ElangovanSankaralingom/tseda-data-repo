import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "level", label: "Level", kind: "string", stage: 1, enumValues: ["National", "International"] },
  { key: "mode", label: "Mode of FDP", kind: "string", stage: 1, enumValues: ["Online", "Offline"] },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "programName", label: "Program Name", kind: "string" },
  { key: "organisingBody", label: "Organising Body", kind: "string" },
  { key: "sponsored", label: "Sponsored", kind: "string", stage: 1, enumValues: ["Yes", "No"] },
  { key: "fundingAgency", label: "Funding Agency", kind: "string", required: false, stage: 1 },
  { key: "fundingAmount", label: "Funding Amount", kind: "number", required: false, stage: 1 },
  { key: "permissionLetter", label: "Permission Letter", kind: "object", upload: true, stage: 2 },
  { key: "completionCertificate", label: "Completion Certificate", kind: "object", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const fdpAttendedSchema: EntrySchema = {
  category: "fdp-attended",
  fields,
  immutableWhenPending: [
    "academicYear",
    "semesterType",
    "level",
    "mode",
    "startDate",
    "endDate",
    "programName",
    "organisingBody",
    "sponsored",
    "fundingAgency",
    "fundingAmount",
  ],
  requiredForCommit: [
    "academicYear",
    "semesterType",
    "level",
    "mode",
    "startDate",
    "endDate",
    "programName",
    "organisingBody",
    "sponsored",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };
