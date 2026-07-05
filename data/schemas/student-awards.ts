import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Student Awards — DLC-scoped department record (B2): prizes and
 * recognitions won by students, keyed by register number.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // EXPORT-FILTER SPINE (mandatory on EVERY category, all scopes).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "regNo", label: "Student Register Number", kind: "string", stage: 1 },
  { key: "studentName", label: "Student Name", kind: "string", stage: 1 },
  { key: "programme", label: "Programme", kind: "string", stage: 1, enumValues: ["B.Arch", "M.Arch"] },
  { key: "awardTitle", label: "Award / Prize", kind: "string", stage: 1 },
  { key: "awardedBy", label: "Awarded By", kind: "string", stage: 1 },
  { key: "awardLevel", label: "Level", kind: "string", stage: 1, enumValues: ["Institute", "State", "National", "International"] },
  { key: "awardDate", label: "Award Date", kind: "date", stage: 1 },
  { key: "awardProof", label: "Certificate / Proof", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const studentAwardsSchema: EntrySchema = {
  category: "student-awards",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "awardTitle", "awardedBy", "awardLevel", "awardDate",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "awardTitle", "awardedBy", "awardLevel", "awardDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
