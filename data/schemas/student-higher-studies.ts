import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Student Higher Studies — DLC-scoped department record (B2): admissions to
 * higher education, keyed by register number, entered by the assigned DLC.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // EXPORT-FILTER SPINE (mandatory on EVERY category, all scopes).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "regNo", label: "Student Register Number", kind: "string", stage: 1 },
  { key: "studentName", label: "Student Name", kind: "string", stage: 1 },
  { key: "programme", label: "Programme", kind: "string", stage: 1, enumValues: ["B.Arch", "M.Arch"] },
  { key: "institutionName", label: "Institution Admitted To", kind: "string", stage: 1 },
  { key: "courseAdmitted", label: "Course Admitted", kind: "string", stage: 1 },
  { key: "country", label: "Country", kind: "string", stage: 1 },
  { key: "qualifyingExam", label: "Qualifying Exam / Score", kind: "string", required: false, stage: 1 },
  { key: "admissionDate", label: "Admission Date", kind: "date", stage: 1 },
  { key: "admitProof", label: "Admit / Offer Proof", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const studentHigherStudiesSchema: EntrySchema = {
  category: "student-higher-studies",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "institutionName", "courseAdmitted", "country", "qualifyingExam", "admissionDate",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "institutionName", "courseAdmitted", "country", "admissionDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
