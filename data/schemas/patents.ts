import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Patents — record flow ("data enter alone", S6 ruling). `status`
 * (Published | Granted) is the award tier key: granted 10, published 5
 * (utility_patent metric). Field spec: award form T5/T6 + workbook patents
 * block. Inventors fan out copies to listed TCE faculty.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "patentTitle", label: "Title of the Patent", kind: "string", stage: 1 },
  { key: "status", label: "Patent Status", kind: "string", stage: 1, enumValues: ["Published", "Granted"] },
  { key: "level", label: "Level", kind: "string", stage: 1, enumValues: ["National", "International"] },
  { key: "applicationNumber", label: "Application Number", kind: "string", stage: 1 },
  { key: "applicationDate", label: "Application Date", kind: "date", required: false, stage: 1 },
  { key: "statusDate", label: "Publication / Grant Date", kind: "date", stage: 1 },
  { key: "inventors", label: "Inventors (TCE Faculty)", kind: "array", required: false, collaborates: true },
  { key: "externalInventors", label: "External Inventors", kind: "string", required: false, stage: 1 },
  // Proofs — entered in the draft (record flow).
  { key: "patentDocument", label: "Patent Document", kind: "array", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const patentsSchema: EntrySchema = {
  category: "patents",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "patentTitle", "status", "level",
    "applicationNumber", "applicationDate", "statusDate",
    "inventors", "externalInventors",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "patentTitle", "status", "level",
    "applicationNumber", "statusDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
