import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { YEAR_OF_STUDY_VALUES } from "@/lib/types/academicProgression";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "yearOfStudy", label: "Year of Study", kind: "string", enumValues: YEAR_OF_STUDY_VALUES },
  { key: "currentSemester", label: "Current Semester", kind: "number", min: 1, max: 10 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "programName", label: "Program Name", kind: "string" },
  { key: "organisingBody", label: "Organising Body", kind: "string" },
  { key: "supportAmount", label: "Support Amount", kind: "number", required: false },
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
    "yearOfStudy",
    "currentSemester",
    "startDate",
    "endDate",
    "programName",
    "organisingBody",
    "supportAmount",
  ],
  requiredForCommit: [
    "academicYear",
    "yearOfStudy",
    "currentSemester",
    "startDate",
    "endDate",
    "programName",
    "organisingBody",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };
