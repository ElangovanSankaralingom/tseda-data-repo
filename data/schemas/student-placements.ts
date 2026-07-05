import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Student Placements — the FIRST dlc-scoped category (Elan's B2 ruling):
 * department records keyed by STUDENT reg no, entered by the assigned
 * entry-DLC only. Record flow, NO streaks, NO feed, NO award points —
 * pure department data with full export support (spine included).
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // EXPORT-FILTER SPINE (mandatory on EVERY category, all scopes).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "regNo", label: "Student Register Number", kind: "string", stage: 1 },
  { key: "studentName", label: "Student Name", kind: "string", stage: 1 },
  { key: "programme", label: "Programme", kind: "string", stage: 1, enumValues: ["B.Arch", "M.Arch"] },
  { key: "companyName", label: "Company / Organisation", kind: "string", stage: 1 },
  { key: "roleOffered", label: "Role Offered", kind: "string", required: false, stage: 1 },
  { key: "packageLpa", label: "Package (LPA)", kind: "number", required: false, stage: 1 },
  { key: "offerDate", label: "Offer Date", kind: "date", stage: 1 },
  { key: "placementType", label: "Placement Type", kind: "string", stage: 1, enumValues: ["On-Campus", "Off-Campus", "Internship-to-Offer"] },
  // Proofs optional — DLCs enter in bulk from placement-cell records.
  { key: "offerProof", label: "Offer Letter / Proof", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const studentPlacementsSchema: EntrySchema = {
  category: "student-placements",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "companyName", "roleOffered", "packageLpa", "offerDate", "placementType",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "regNo", "studentName", "programme",
    "companyName", "offerDate", "placementType",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
