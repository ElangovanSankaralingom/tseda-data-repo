import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Conferences / Seminars / Symposia Organized — PERMISSION flow (Elan's S7
 * ruling): organizing needs prior approval. Generate the permission letter →
 * edit-window timer → conduct the event → stage-2 proofs → finalise.
 * Future-dated entries are streak-eligible exactly like workshops.
 *
 * Award: intl_conference_organized (20) / natl_conference_organized (12),
 * SHARED by role — Coordinator 50%, Co-Coordinator 30%, Committee Member
 * 20% (T'SEDA sharing rule). `organizingTeam` fans out prefilled copies;
 * each recipient sets THEIR OWN role before generating their letter.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "conferenceTitle", label: "Title of the Conference", kind: "string", stage: 1 },
  { key: "level", label: "Level", kind: "string", stage: 1, enumValues: ["National", "International"] },
  { key: "role", label: "Your Role", kind: "string", stage: 1, enumValues: ["Coordinator", "Co-Coordinator", "Committee Member"] },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "collaboratingBodies", label: "Collaborating Bodies", kind: "string", required: false, stage: 1 },
  { key: "organizingTeam", label: "Organizing Team (TCE Faculty)", kind: "array", required: false, collaborates: true },
  // Stage 2 — after the permission letter is generated.
  { key: "permissionLetter", label: "Signed Permission Letter", kind: "array", upload: true, stage: 2 },
  { key: "eventReport", label: "Event Report", kind: "array", upload: true, stage: 2 },
  { key: "committeeProof", label: "Committee / Role Proof", kind: "array", upload: true, stage: 2 },
  { key: "photographs", label: "Photographs", kind: "array", upload: true, stage: 2, required: false },
  { key: "numberOfDelegates", label: "Number of Delegates", kind: "number", required: false, stage: 2 },
  { key: "papersPresented", label: "Papers Presented", kind: "number", required: false, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const conferencesOrganizedSchema: EntrySchema = {
  category: "conferences-organized",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "conferenceTitle", "level", "role",
    "startDate", "endDate", "collaboratingBodies", "organizingTeam",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "conferenceTitle", "level", "role",
    "startDate", "endDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
