import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Online / Industry-Supported Courses — PERMISSION flow (Elan's S3 ruling:
 * TCE-online and industry-supported course development need prior,
 * Dean-signed approval). One category, `courseKind` routes the metric:
 *  - TCE Online Course → tce_online_course, tiered by durationWeeks
 *    (4 → 10, 8 → 15, 12 → 20), new or rerun both count.
 *  - Industry-Supported Course → industry_supported_course, tiered by
 *    credits (1 → 4, 2 → 8), industry expert named.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "courseName", label: "Name of the Course", kind: "string", stage: 1 },
  { key: "courseKind", label: "Course Kind", kind: "string", stage: 1, enumValues: ["TCE Online Course", "Industry-Supported Course"] },
  // Conditional by kind — enforced in the adapter validator.
  { key: "durationWeeks", label: "Duration (Weeks)", kind: "string", required: false, stage: 1, enumValues: ["4", "8", "12"] },
  { key: "newOrRerun", label: "New or Rerun", kind: "string", required: false, stage: 1, enumValues: ["New", "Rerun"] },
  { key: "credits", label: "Credits", kind: "string", required: false, stage: 1, enumValues: ["1", "2"] },
  { key: "industryExpert", label: "Industry Expert / Organisation", kind: "string", required: false, stage: 1 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  // Stage 2 — after the permission letter is generated.
  { key: "permissionLetter", label: "Signed Permission Letter", kind: "array", upload: true, stage: 2 },
  { key: "deanProof", label: "Dean-Signed Offering Proof", kind: "array", upload: true, stage: 2 },
  { key: "coursePageProof", label: "Canvas / Enrollment Page Proof", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const onlineCoursesSchema: EntrySchema = {
  category: "online-courses",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "courseName", "courseKind",
    "durationWeeks", "newOrRerun", "credits", "industryExpert",
    "startDate", "endDate",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "courseName", "courseKind",
    "startDate", "endDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
