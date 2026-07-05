import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Public Exhibitions / Outreach — PERMISSION flow (Elan's S4 ruling):
 * public-facing events beyond academics need prior approval. Generate the
 * permission letter → hold the event → stage-2 documentation → finalise.
 *
 * Award: public_exhibition 2/unit, capped at 4.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "eventName", label: "Name of the Event", kind: "string", stage: 1 },
  { key: "eventKind", label: "Event Type", kind: "string", stage: 1, enumValues: ["Public Exhibition", "Community Outreach"] },
  { key: "venue", label: "Venue", kind: "string", stage: 1 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "externalExperts", label: "External Experts / Partners", kind: "string", required: false, stage: 1 },
  // Stage 2 — after the permission letter is generated.
  { key: "permissionLetter", label: "Signed Permission Letter", kind: "array", upload: true, stage: 2 },
  { key: "documentation", label: "Catalogue / Invitation / Report", kind: "array", upload: true, stage: 2 },
  { key: "photographs", label: "Photographs", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const exhibitionsOutreachSchema: EntrySchema = {
  category: "exhibitions-outreach",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "eventName", "eventKind", "venue",
    "startDate", "endDate", "externalExperts",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "eventName", "eventKind", "venue",
    "startDate", "endDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
