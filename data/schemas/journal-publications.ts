import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Journal Publications — the FIRST record-flow category (2026-07).
 * Post-facto achievement: no permission PDF, no timer. Fields + proof
 * uploads are entered together; SUBMIT locks the entry and the streak counts
 * immediately. Corrections only via edit/delete request to the DLC/admin.
 *
 * Field spec: official award form T7 + the department's "R&D – Journals"
 * sheet (title, authors, journal, ISSN, vol/issue, pages, month-year, DOI,
 * indexing, first page + listing proofs).
 *
 * `coAuthors` carries collaborates: true — a submitted entry fans out
 * prefilled draft copies to every listed TCE co-author; each earns their own
 * streak when they submit their copy.
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // EXPORT-FILTER SPINE (mandatory on EVERY category, both flows): academic
  // year + ODD/EVEN semester drive all department exports and filters.
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "paperTitle", label: "Title of the Paper", kind: "string", stage: 1 },
  { key: "journalName", label: "Name of the Journal", kind: "string", stage: 1 },
  { key: "issn", label: "ISSN", kind: "string", stage: 1 },
  { key: "volumeIssue", label: "Volume / Issue", kind: "string", required: false, stage: 1 },
  { key: "pageNumbers", label: "Page Numbers", kind: "string", required: false, stage: 1 },
  { key: "publicationDate", label: "Date of Publication", kind: "date", stage: 1 },
  { key: "doi", label: "DOI", kind: "string", required: false, stage: 1 },
  { key: "indexing", label: "Indexing", kind: "string", stage: 1, enumValues: ["Scopus", "Web of Science", "UGC-CARE", "Other/None"] },
  { key: "coAuthors", label: "Co-Authors (TCE Faculty)", kind: "array", required: false, collaborates: true },
  { key: "externalAuthors", label: "External Authors", kind: "string", required: false, stage: 1 },
  // Proof uploads — entered in the SAME stage as the data (record flow), but
  // annotated stage: 2 so every schema-driven satellite (upload slots, PDF
  // hash exclusion, integrity checks) keeps working unchanged.
  { key: "firstPage", label: "First Page of the Paper", kind: "array", upload: true, stage: 2 },
  { key: "indexProof", label: "Indexing / Listing Proof", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const journalPublicationsSchema: EntrySchema = {
  category: "journal-publications",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "paperTitle", "journalName", "issn",
    "volumeIssue", "pageNumbers", "publicationDate", "doi", "indexing",
    "coAuthors", "externalAuthors",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "paperTitle", "journalName", "issn",
    "publicationDate", "indexing",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
