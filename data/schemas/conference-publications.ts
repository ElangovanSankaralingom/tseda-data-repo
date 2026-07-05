import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Conference Publications — record flow (post-facto, specially collaborative).
 * No permission PDF, no timer: data + proofs together, submit locks, streak
 * counts immediately. Field spec: workbook conference block + award rules
 * (Scopus-indexed / reputed forums; accepted/presented-only papers are NOT
 * counted — the paper must be PUBLISHED with a clear date).
 *
 * `coAuthors` fans out prefilled draft copies to listed TCE co-authors —
 * each submits their own copy and earns their own streak (S5 ruling).
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "paperTitle", label: "Title of the Paper", kind: "string", stage: 1 },
  { key: "conferenceName", label: "Name of the Conference", kind: "string", stage: 1 },
  { key: "level", label: "Level", kind: "string", stage: 1, enumValues: ["National", "International"] },
  { key: "organizedBy", label: "Organized By (Institution)", kind: "string", stage: 1 },
  { key: "publicationDate", label: "Date of Publication", kind: "date", stage: 1 },
  { key: "issnIsbn", label: "ISSN / ISBN", kind: "string", required: false, stage: 1 },
  { key: "pageNumbers", label: "Page Numbers", kind: "string", required: false, stage: 1 },
  { key: "doi", label: "DOI", kind: "string", required: false, stage: 1 },
  { key: "indexing", label: "Indexing", kind: "string", stage: 1, enumValues: ["Scopus", "Web of Science", "UGC-CARE", "Other/None"] },
  { key: "coAuthors", label: "Co-Authors (TCE Faculty)", kind: "array", required: false, collaborates: true },
  { key: "externalAuthors", label: "External Authors", kind: "string", required: false, stage: 1 },
  // Proofs — same stage-2 annotation, entered in the draft (record flow).
  { key: "firstPage", label: "First Page of the Paper", kind: "array", upload: true, stage: 2 },
  { key: "indexProof", label: "Indexing / Proceedings Proof", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const conferencePublicationsSchema: EntrySchema = {
  category: "conference-publications",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "paperTitle", "conferenceName", "level",
    "organizedBy", "publicationDate", "issnIsbn", "pageNumbers", "doi",
    "indexing", "coAuthors", "externalAuthors",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "paperTitle", "conferenceName", "level",
    "organizedBy", "publicationDate", "indexing",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
