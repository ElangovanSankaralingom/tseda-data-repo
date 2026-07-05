import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

/**
 * Books & Chapters — record flow (post-facto, collaborative). One category,
 * `kind` (Book | Chapter) drives BOTH award metrics: book_publication
 * (10/unit) and book_chapter (5/unit). Field spec: award form T8/T9 +
 * workbook Book Chapters sheet (book title, authors, chapter title, ISBN,
 * publisher, month-year, proofs).
 *
 * `coAuthors` fans out prefilled draft copies to listed TCE co-authors.
 * chapterTitle is REQUIRED when kind = Chapter (adapter-level conditional,
 * same pattern as the sponsored/funding fields on workshops).
 */

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  // Export-filter spine (mandatory on every category).
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "kind", label: "Publication Kind", kind: "string", stage: 1, enumValues: ["Book", "Chapter"] },
  { key: "bookTitle", label: "Title of the Book", kind: "string", stage: 1 },
  { key: "chapterTitle", label: "Title of the Chapter", kind: "string", required: false, stage: 1 },
  { key: "publisher", label: "Publisher", kind: "string", stage: 1 },
  { key: "isbn", label: "ISBN", kind: "string", stage: 1 },
  { key: "editionOrVolume", label: "Edition / Volume", kind: "string", required: false, stage: 1 },
  { key: "pageNumbers", label: "Page Numbers", kind: "string", required: false, stage: 1 },
  { key: "publicationDate", label: "Date of Publication", kind: "date", stage: 1 },
  { key: "coAuthors", label: "Co-Authors (TCE Faculty)", kind: "array", required: false, collaborates: true },
  { key: "externalAuthors", label: "External Authors", kind: "string", required: false, stage: 1 },
  // Proofs — entered in the draft (record flow), stage-2 annotated for the
  // schema-driven satellites (upload slots, hash exclusion, integrity).
  { key: "coverIsbnProof", label: "Cover / ISBN Page Proof", kind: "array", upload: true, stage: 2 },
  { key: "publicationProof", label: "Publication Proof (first pages)", kind: "array", upload: true, stage: 2, required: false },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const booksAndChaptersSchema: EntrySchema = {
  category: "books-and-chapters",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "kind", "bookTitle", "chapterTitle",
    "publisher", "isbn", "editionOrVolume", "pageNumbers", "publicationDate",
    "coAuthors", "externalAuthors",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "kind", "bookTitle", "publisher",
    "isbn", "publicationDate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
