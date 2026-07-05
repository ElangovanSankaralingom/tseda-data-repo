import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Design Competitions — PERMISSION flow (Elan's S4 ruling): participation
 * needs prior approval, complete data mandatory. Generate the permission
 * letter → participate → stage-2 certificate + result → finalise.
 *
 * Award: design_competition tier by result — Recognized entry / Award 5,
 * Participation 2. `teamMembers` fans out prefilled copies to TCE
 * colleagues on the team.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "competitionName", label: "Name of the Competition", kind: "string", stage: 1 },
  { key: "level", label: "Level", kind: "string", stage: 1, enumValues: ["National", "International"] },
  { key: "organizer", label: "Organizing Body", kind: "string", stage: 1 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "entryTheme", label: "Entry / Theme", kind: "string", required: false, stage: 1 },
  { key: "teamMembers", label: "Team Members (TCE Faculty)", kind: "array", required: false, collaborates: true },
  // Stage 2 — after the permission letter is generated; the result is known
  // only after participating, so it lives here alongside the certificate.
  { key: "result", label: "Result", kind: "string", stage: 2, enumValues: ["Recognized Entry / Award", "Participation"] },
  { key: "certificate", label: "Certificate / Competition Proof", kind: "array", upload: true, stage: 2 },
  { key: "submissionCopy", label: "Copy of the Submitted Entry", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const designCompetitionsSchema: EntrySchema = {
  category: "design-competitions",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "competitionName", "level", "organizer",
    "startDate", "endDate", "entryTheme", "teamMembers",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "competitionName", "level", "organizer",
    "startDate", "endDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
