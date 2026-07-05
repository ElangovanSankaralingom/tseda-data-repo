import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Research Funding & Consultancy — record flow ("data enter alone", S6).
 * `kind` routes the entry to its award metric and `amountInr` picks the
 * tier:
 * - R&D            → rd_funding (<5L 5 · 5–10L 10 · 10–20L 15 · 20–50L 20 · ≥50L 25)
 * - Consultancy / Other (govt./agencies, non-R&D) → non_rd_funding (<2.5L 3 / ≥2.5L 5)
 * Field spec: award form T11/T12 + workbook "Research Grant" and
 * "Consultancy" sheets (project, agency/client, coordinator, amount INR,
 * sanction/work order, receipts). Investigators fan out copies.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "kind", label: "Funding Kind", kind: "string", stage: 1, enumValues: ["R&D", "Consultancy", "Other"] },
  { key: "projectTitle", label: "Title of the Project", kind: "string", stage: 1 },
  { key: "agencyOrClient", label: "Sponsoring Agency / Client", kind: "string", stage: 1 },
  { key: "amountInr", label: "Amount (INR)", kind: "number", stage: 1, format: "currency" },
  { key: "sanctionDate", label: "Sanction / Order Date", kind: "date", stage: 1 },
  { key: "durationText", label: "Duration / Period", kind: "string", required: false, stage: 1 },
  { key: "investigators", label: "Investigators (TCE Faculty)", kind: "array", required: false, collaborates: true },
  { key: "externalInvestigators", label: "External Investigators / Team", kind: "string", required: false, stage: 1 },
  // Proofs — entered in the draft (record flow).
  { key: "sanctionOrder", label: "Sanction Order / Work Order", kind: "array", upload: true, stage: 2 },
  { key: "supportingProof", label: "Receipts / Statements", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const researchFundingSchema: EntrySchema = {
  category: "research-funding",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "kind", "projectTitle", "agencyOrClient",
    "amountInr", "sanctionDate", "durationText",
    "investigators", "externalInvestigators",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "kind", "projectTitle", "agencyOrClient",
    "amountInr", "sanctionDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
