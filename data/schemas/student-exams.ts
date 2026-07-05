import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Student Competitive Exams — DLC-scoped department record (B2): qualified
 * competitive exams (GATE, NATA, GRE, CEED, …), keyed by register number.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // EXPORT-FILTER SPINE (mandatory on EVERY category, all scopes).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "regNo", label: "Student Register Number", kind: "string", stage: 1 },
  { key: "studentName", label: "Student Name", kind: "string", stage: 1 },
  { key: "programme", label: "Programme", kind: "string", stage: 1, enumValues: ["B.Arch", "M.Arch"] },
  { key: "examName", label: "Exam", kind: "string", stage: 1 },
  { key: "scoreOrRank", label: "Score / Rank", kind: "string", stage: 1 },
  { key: "examDate", label: "Exam / Result Date", kind: "date", stage: 1 },
  { key: "scoreProof", label: "Scorecard / Proof", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const studentExamsSchema: EntrySchema = {
  category: "student-exams",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "examName", "scoreOrRank", "examDate",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "examName", "scoreOrRank", "examDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
