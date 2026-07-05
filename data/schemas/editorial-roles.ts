import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Editorial Roles — record flow (S5). Individual recognition: no
 * collaborates field, no fan-out. Editor / Associate Editor roles score the
 * fixed editorial_role award points; board memberships and reviewer roles
 * are recorded for the profile/NAAC but are not points-eligible (the
 * deriver says so in its notes). Field spec: award form T10.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "journalName", label: "Name of the Journal", kind: "string", stage: 1 },
  { key: "role", label: "Editorial Role", kind: "string", stage: 1, enumValues: ["Editor", "Associate Editor", "Editorial Board Member", "Reviewer"] },
  { key: "issn", label: "ISSN", kind: "string", required: false, stage: 1 },
  { key: "publisher", label: "Publisher", kind: "string", required: false, stage: 1 },
  { key: "appointmentDate", label: "Appointment Date", kind: "date", stage: 1 },
  { key: "detailsText", label: "Details (reviews handled, issues edited…)", kind: "string", required: false, stage: 1 },
  // Proofs — entered in the draft (record flow).
  { key: "appointmentProof", label: "Appointment / Invitation Proof", kind: "array", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const editorialRolesSchema: EntrySchema = {
  category: "editorial-roles",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "journalName", "role", "issn",
    "publisher", "appointmentDate", "detailsText",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "journalName", "role", "appointmentDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
