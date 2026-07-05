import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Studio Contributions — record flow (Elan's S1 ruling, 2026-07): "a small
 * descriptive box to enter what they have done, and upload proof."
 *
 * One entry per studio event: open reviews / exhibitions score the
 * open_reviews_exhibitions metric (1/unit, max 3) automatically; studio
 * documentation and beyond-syllabus entries are the EVIDENCE BASE the
 * committee reads before awarding the S1 interview metrics on
 * /admin/awards.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // EXPORT-FILTER SPINE (mandatory on EVERY category, both flows).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "contributionKind", label: "Contribution Type", kind: "string", stage: 1, enumValues: ["Open Review / Jury", "Exhibition of Student Work", "Studio Documentation", "Beyond Syllabus"] },
  { key: "activityTitle", label: "Title", kind: "string", stage: 1 },
  { key: "descriptionText", label: "What You Did", kind: "string", stage: 1 },
  { key: "eventDate", label: "Date", kind: "date", stage: 1 },
  { key: "venue", label: "Venue / Studio", kind: "string", required: false, stage: 1 },
  { key: "externalParticipants", label: "External Experts / Jurors", kind: "string", required: false, stage: 1 },
  // Proof uploads — same stage as the data (record flow), annotated stage: 2
  // so every schema-driven satellite keeps working unchanged.
  { key: "proofs", label: "Proofs (Photos / Report / Invitation)", kind: "array", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const studioContributionsSchema: EntrySchema = {
  category: "studio-contributions",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "contributionKind", "activityTitle", "descriptionText",
    "eventDate", "venue", "externalParticipants",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "contributionKind", "activityTitle", "descriptionText",
    "eventDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
