import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Mentoring Programs (Fast / Slow Learners) — PERMISSION flow (Elan's S3
 * ruling): mentoring programmes need prior approval. Fast: research-
 * practice courses, hackathon teams, patents with students. Slow:
 * non-remunerative special classes with arrear-clearing proof.
 *
 * Award: fast_slow_learners fixed 5 (awarded once per year).
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "programName", label: "Name of the Programme", kind: "string", stage: 1 },
  { key: "targetGroup", label: "Target Group", kind: "string", stage: 1, enumValues: ["Fast Learners", "Slow Learners"] },
  { key: "activityDetail", label: "Activity / Focus", kind: "string", stage: 1 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  // Stage 2 — after the permission letter is generated.
  { key: "studentsCovered", label: "Number of Students Covered", kind: "number", required: false, stage: 2 },
  { key: "permissionLetter", label: "Signed Permission Letter", kind: "array", upload: true, stage: 2 },
  { key: "outcomeProof", label: "Outcome Proof (schedule / certificates / arrear clearance)", kind: "array", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const mentoringProgramsSchema: EntrySchema = {
  category: "mentoring-programs",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "programName", "targetGroup",
    "activityDetail", "startDate", "endDate",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "programName", "targetGroup",
    "activityDetail", "startDate", "endDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
