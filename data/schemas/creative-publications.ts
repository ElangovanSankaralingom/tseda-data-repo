import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Creative Publications — record flow (S4/S5, roadmap #11). Essays,
 * critiques, visual narratives in reputed design platforms and magazines.
 * Individual recognition (no fan-out); feeds creative_publication 5/unit.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // EXPORT-FILTER SPINE (mandatory on EVERY category, both flows).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "workTitle", label: "Title of the Work", kind: "string", stage: 1 },
  { key: "publicationName", label: "Platform / Magazine", kind: "string", stage: 1 },
  { key: "publicationDate", label: "Date of Publication", kind: "date", stage: 1 },
  { key: "issn", label: "ISSN (if any)", kind: "string", required: false, stage: 1 },
  { key: "workUrl", label: "Link (if online)", kind: "string", required: false, stage: 1 },
  // Proof uploads — same stage as the data (record flow), annotated stage: 2
  // so every schema-driven satellite keeps working unchanged.
  { key: "publicationCopy", label: "Copy of the Publication", kind: "array", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const creativePublicationsSchema: EntrySchema = {
  category: "creative-publications",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "workTitle", "publicationName",
    "publicationDate", "issn", "workUrl",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "workTitle", "publicationName",
    "publicationDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
