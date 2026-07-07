import "server-only";
import { ENTRY_SCHEMAS } from "@/data/schemas";
import { CATEGORY_LIST } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";
import type { SchemaFieldDefinition } from "@/data/schemas/types";
import type { CellValue } from "@/lib/import/xlsxReader";
import { foldKey, normalizeDate, normalizeNumber } from "@/lib/import/normalize";

/**
 * Sheet → category classification and column → field mapping.
 *
 * Ground truth for the vocabulary is docs/DATA-INVENTORY.md — the ACTUAL
 * column headers the department types into "Academic Data 2025-2026.xlsx".
 * Generic matching against schema labels covers most fields (the schemas
 * were designed from this workbook); HEADER_SYNONYMS carries the spots
 * where the two vocabularies diverge. Extend synonyms as real sheets
 * reveal new dialects — the dry-run report shows every unmapped header.
 *
 * Matching is deliberately conservative: a sheet below threshold is
 * reported "unmatched", never guessed. Silent misclassification is the
 * importer's worst failure mode.
 */

// --- Vocabulary -------------------------------------------------------------

/** Columns that exist for spreadsheet bookkeeping, never data. */
const IGNORED_HEADERS = ["s no", "sl no", "s no.", "sno", "serial no", "serial number", "sr no"];

/** Columns naming the OWNING faculty (drives draft ownership). */
const OWNER_HEADERS = [
  "teacher name", "name of the teacher", "faculty name", "name of the faculty",
  "name of faculty member", "faculty involved", "staff name", "staff accompanying",
  "name of the staff", "coordinator", "project coordinator", "recipient", "faculty",
];

/** Global spine fields shared by every category. */
const GLOBAL_SYNONYMS: Record<string, string[]> = {
  academicYear: ["academic year", "ay", "year"],
  semesterType: ["semester", "sem", "semester type", "odd even"],
};

/** Category-specific header dialects (from DATA-INVENTORY.md §B). */
const HEADER_SYNONYMS: Partial<Record<CategoryKey, Record<string, string[]>>> = {
  "journal-publications": {
    paperTitle: ["title of paper", "title of the paper", "paper title", "title"],
    journalName: ["journal name", "name of the journal", "journal"],
    issn: ["issn", "issn no", "issn number"],
    volumeIssue: ["vol issue", "volume issue", "vol no issue no", "volume and issue", "vol"],
    pageNumbers: ["page numbers", "pages", "page no", "page nos", "pp"],
    publicationDate: ["month year", "month and year", "month year of publication", "date of publication", "published on"],
    doi: ["doi", "doi link", "doi number"],
    indexing: ["indexing", "indexed in", "indexed", "scopus wos", "index"],
    coAuthors: ["authors", "author names", "name of the authors", "faculty authors", "authors s"],
    externalAuthors: ["external authors", "other authors", "co authors external"],
  },
  "conference-publications": {
    paperTitle: ["paper title", "title of paper", "title of the paper", "title"],
    conferenceName: ["conference name", "name of the conference", "conference"],
    issn: ["issn", "isbn issn", "issn no"],
    level: ["international national", "national international", "level", "intl natl"],
    publicationDate: ["month year", "month and year", "date", "date of conference"],
    pageNumbers: ["pages", "page numbers", "page nos"],
    coAuthors: ["authors", "author names", "name of the authors"],
  },
  "books-and-chapters": {
    bookTitle: ["book title", "title of the book", "name of the book"],
    chapterTitle: ["chapter title", "title of the chapter", "name of the chapter"],
    publisher: ["publisher", "publishing house", "publisher name"],
    isbn: ["isbn", "isbn no", "isbn number"],
    publicationDate: ["month year", "month and year", "year of publication", "date of publication"],
    coAuthors: ["authors", "author names", "name of the authors"],
  },
  "research-funding": {
    projectTitle: ["project name", "name of the project", "project title", "title of the project", "project"],
    agency: ["sponsoring agency", "funding agency", "agency", "client", "name of the client", "sponsored by"],
    amount: ["amount inr", "amount", "revenue generated", "sanctioned amount", "grant amount", "amount in rs"],
    sanctionDate: ["sanction date", "date of sanction", "sanctioned on"],
    investigators: ["project coordinator", "investigators", "pi co pi", "faculty involved", "principal investigator"],
  },
  patents: {
    patentTitle: ["patent title", "title of the patent", "name of the patent", "title"],
    inventors: ["inventors", "name of the inventors", "faculty involved"],
    applicationDate: ["application date", "date of application", "filed on"],
    grantDate: ["grant date", "date of grant", "granted on"],
  },
  "guest-lectures": {
    eventName: ["event name", "name of the event", "topic", "title of the lecture"],
    speakerName: ["speaker", "speaker organization", "name of the speaker", "resource person"],
    organisation: ["institution industry", "speaker organization", "organization", "organisation", "company"],
    eventDate: ["date", "date of the event", "event date"],
  },
  "case-studies": {
    placesOfVisit: ["places of visit", "place of visit", "location"],
    purpose: ["purpose interactions", "purpose", "purpose of visit"],
    accompanyingStaff: ["staff accompanying", "accompanying staff", "faculty accompanying"],
    visitDate: ["date", "date of visit"],
  },
  "fdp-attended": {
    programName: ["program name", "programme name", "name of the program", "name of the fdp", "fdp name"],
    organizingBody: ["organizing body", "organising body", "organized by", "organiser"],
    amountOfSupport: ["amount of support", "support amount", "financial support"],
    startDate: ["from", "start date", "dates", "duration"],
    durationDays: ["duration days", "no of days", "duration"],
  },
  "mentoring-programs": {
    programName: ["event name", "name of the event", "program name"],
    programDate: ["date", "dates"],
  },
  "exhibitions-outreach": {
    eventName: ["event", "event name", "name of the event"],
    venue: ["venue", "location", "place"],
    eventDate: ["date", "dates"],
  },
  "online-courses": {
    courseName: ["course name", "name of the course", "course"],
    partner: ["offering organization", "industry partner", "organization"],
  },
};

const SHEET_NAME_HINTS: Partial<Record<CategoryKey, string[]>> = {
  "journal-publications": ["journal", "r d journal", "rd journal", "qn 19"],
  "conference-publications": ["conference paper", "conference publication", "conference"],
  "books-and-chapters": ["book chapter", "book", "chapter", "qn 20"],
  "research-funding": ["seed money", "research grant", "grant", "consultancy", "fellowship", "funding", "qn 12", "qn 24", "qn 56"],
  patents: ["patent"],
  "guest-lectures": ["guest", "special lecture", "qn 11"],
  workshops: ["workshop"],
  "fdp-attended": ["fdp", "fdp conference attended", "attended", "qn 38", "qn 39"],
  "fdp-conducted": ["fdp conducted", "training conducted", "fdps workshops training"],
  "case-studies": ["case stud", "site visit"],
  "mentoring-programs": ["fast learner", "slow learner", "mentoring", "qn 6", "qn 7"],
  "student-placements": ["placement", "qn 32"],
  "student-higher-studies": ["higher studies", "qn 33"],
  "student-exams": ["competitive exam", "qn 34"],
  "student-awards": ["student award", "nss ncc", "qn 35"],
  "conferences-organized": ["conference organized", "conference organised", "conference conducted"],
  "editorial-roles": ["editor", "editorial"],
  "design-competitions": ["design competition", "competition", "design expo", "medal"],
  "exhibitions-outreach": ["exhibition", "outreach", "extension", "qn 26"],
  "creative-publications": ["creative publication", "magazine", "creative writing", "article"],
  "online-courses": ["nptel", "online course", "one credit", "qn 2"],
  "studio-contributions": ["studio"],
};

// --- Similarity -------------------------------------------------------------

const STOPWORDS = new Set(["of", "the", "and", "a", "an", "in"]);

function tokenSet(s: string): Set<string> {
  return new Set(foldKey(s).split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t)));
}

/** Header ↔ vocabulary similarity in [0,1]. */
export function headerSimilarity(header: string, vocab: string): number {
  const h = foldKey(header);
  const v = foldKey(vocab);
  if (!h || !v) return 0;
  if (h === v) return 1;
  if (h.includes(v) || v.includes(h)) {
    const ratio = Math.min(h.length, v.length) / Math.max(h.length, v.length);
    return 0.72 + 0.2 * ratio;
  }
  const ht = tokenSet(h);
  const vt = tokenSet(v);
  if (!ht.size || !vt.size) return 0;
  let inter = 0;
  for (const t of ht) if (vt.has(t)) inter++;
  return inter ? (0.9 * inter) / Math.max(ht.size, vt.size) : 0;
}

// --- Column mapping ---------------------------------------------------------

export type ColumnMapping = {
  /** column index → schema field key, "__owner__", or "__ignore__" */
  columns: Map<number, string>;
  /** column index → match confidence */
  confidence: Map<number, number>;
  unmappedHeaders: { index: number; header: string }[];
  /** requiredForCommit fields with no mapped column (drafts tolerate this). */
  missingForCommit: string[];
};

function mappableFields(category: CategoryKey): SchemaFieldDefinition[] {
  return ENTRY_SCHEMAS[category].fields.filter(
    (f) => !f.upload && f.key !== "id" && f.kind !== "object",
  );
}

function vocabularyFor(category: CategoryKey, field: SchemaFieldDefinition): string[] {
  const words = [field.label, field.key.replace(/([a-z])([A-Z])/g, "$1 $2")];
  const syn = HEADER_SYNONYMS[category]?.[field.key];
  if (syn) words.push(...syn);
  const global = GLOBAL_SYNONYMS[field.key];
  if (global) words.push(...global);
  return words;
}

/** Sampled kind-compatibility: a date field must see mostly date-ish values. */
function kindCompatible(field: SchemaFieldDefinition, samples: CellValue[]): boolean {
  const nonEmpty = samples.filter((v) => v !== null && v !== "").slice(0, 8);
  if (!nonEmpty.length) return true; // no evidence — don't block the mapping
  if (field.kind === "date") {
    const ok = nonEmpty.filter((v) => normalizeDate(v) !== null).length;
    return ok >= Math.ceil(nonEmpty.length / 2);
  }
  if (field.kind === "number") {
    const ok = nonEmpty.filter((v) => normalizeNumber(v) !== null).length;
    return ok >= Math.ceil(nonEmpty.length / 2);
  }
  return true;
}

const MIN_HEADER_SCORE = 0.55;

export function mapColumns(
  category: CategoryKey,
  headers: (string | null)[],
  sampleRows: CellValue[][],
): ColumnMapping {
  const fields = mappableFields(category);
  type Cand = { col: number; fieldKey: string; score: number };
  const candidates: Cand[] = [];
  headers.forEach((rawHeader, col) => {
    if (rawHeader === null || rawHeader === "") return;
    const header = String(rawHeader);
    if (IGNORED_HEADERS.some((ig) => headerSimilarity(header, ig) >= 0.95)) {
      candidates.push({ col, fieldKey: "__ignore__", score: 1 });
      return;
    }
    const samples = sampleRows.map((r) => r[col] ?? null);
    for (const field of fields) {
      let best = 0;
      for (const vocab of vocabularyFor(category, field)) {
        const s = headerSimilarity(header, vocab);
        if (s > best) best = s;
      }
      if (best >= MIN_HEADER_SCORE && kindCompatible(field, samples)) {
        candidates.push({ col, fieldKey: field.key, score: best });
      }
    }
    for (const ownerVocab of OWNER_HEADERS) {
      const s = headerSimilarity(header, ownerVocab);
      if (s >= 0.8) candidates.push({ col, fieldKey: "__owner__", score: s * 0.98 });
    }
  });

  // Greedy one-to-one assignment, highest score first ("__ignore__" and
  // "__owner__" don't consume schema fields but do consume their column).
  candidates.sort((a, b) => b.score - a.score);
  const columns = new Map<number, string>();
  const confidence = new Map<number, number>();
  const usedFields = new Set<string>();
  for (const c of candidates) {
    if (columns.has(c.col)) continue;
    if (c.fieldKey !== "__ignore__" && c.fieldKey !== "__owner__" && usedFields.has(c.fieldKey)) continue;
    columns.set(c.col, c.fieldKey);
    confidence.set(c.col, c.score);
    if (c.fieldKey !== "__ignore__" && c.fieldKey !== "__owner__") usedFields.add(c.fieldKey);
  }

  const unmappedHeaders: { index: number; header: string }[] = [];
  headers.forEach((h, i) => {
    if (h !== null && h !== "" && !columns.has(i)) unmappedHeaders.push({ index: i, header: String(h) });
  });

  const required = ENTRY_SCHEMAS[category].requiredForCommit ?? [];
  const missingForCommit = required.filter((k) => !usedFields.has(k) && k !== "id");
  return { columns, confidence, unmappedHeaders, missingForCommit };
}

// --- Header row discovery ----------------------------------------------------

const ALL_VOCAB: string[] = (() => {
  const out = new Set<string>();
  for (const category of CATEGORY_LIST as readonly CategoryKey[]) {
    for (const f of mappableFields(category)) {
      for (const v of vocabularyFor(category, f)) out.add(foldKey(v));
    }
  }
  for (const v of [...IGNORED_HEADERS, ...OWNER_HEADERS]) out.add(foldKey(v));
  return [...out];
})();

/** Real sheets open with title banners; find the row that IS the header. */
export function findHeaderRow(rows: CellValue[][], scanDepth = 10): number {
  let bestRow = 0;
  let bestScore = 0;
  for (let r = 0; r < Math.min(rows.length, scanDepth); r++) {
    const cells = rows[r].filter((c): c is string => typeof c === "string" && c.trim() !== "");
    if (cells.length < 2) continue;
    let hits = 0;
    for (const cell of cells) {
      const k = foldKey(cell);
      if (ALL_VOCAB.some((v) => v === k || (v.length > 3 && (k.includes(v) || v.includes(k))))) hits++;
    }
    // Favor rows where MOST populated cells look like headers.
    const score = hits >= 2 ? hits + hits / cells.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

// --- Sheet classification -----------------------------------------------------

export type SheetClassification = {
  decision: "matched" | "ambiguous" | "unmatched";
  category?: CategoryKey;
  score: number;
  runnerUp?: { category: CategoryKey; score: number };
  headerRow: number;
  mapping?: ColumnMapping;
};

export function classifySheet(sheetName: string, rows: CellValue[][]): SheetClassification {
  const headerRow = findHeaderRow(rows);
  const headers = (rows[headerRow] ?? []).map((c) => (typeof c === "string" ? c : c === null ? null : String(c)));
  const sampleRows = rows.slice(headerRow + 1, headerRow + 9);
  if (!headers.some((h) => h)) return { decision: "unmatched", score: 0, headerRow };

  type Scored = { category: CategoryKey; score: number; mapping: ColumnMapping };
  const scored: Scored[] = [];
  for (const category of CATEGORY_LIST as readonly CategoryKey[]) {
    const mapping = mapColumns(category, headers, sampleRows);
    const fields = mappableFields(category);
    // Coverage counts only schema-SPECIFIC fields (global spine fields match
    // every category and would flatten the signal).
    const specific = fields.filter((f) => !(f.key in GLOBAL_SYNONYMS));
    let coverage = 0;
    for (const [col, key] of mapping.columns) {
      if (key === "__ignore__" || key === "__owner__" || key in GLOBAL_SYNONYMS) continue;
      const field = specific.find((f) => f.key === key);
      if (!field) continue;
      const required = (ENTRY_SCHEMAS[category].requiredForCommit ?? []).includes(key);
      coverage += (mapping.confidence.get(col) ?? 0) * (required ? 1.6 : 1);
    }
    const denom = Math.max(specific.length, 3);
    const coverageScore = Math.min(coverage / denom, 1);
    const hints = SHEET_NAME_HINTS[category] ?? [];
    let nameBonus = 0;
    for (const hint of hints) nameBonus = Math.max(nameBonus, headerSimilarity(sheetName, hint));
    const total = 0.65 * coverageScore + 0.35 * nameBonus;
    scored.push({ category, score: total, mapping });
  }
  scored.sort((a, b) => b.score - a.score);
  const [top, second] = scored;
  const runnerUp = second ? { category: second.category, score: second.score } : undefined;
  if (!top || top.score < 0.3) return { decision: "unmatched", score: top?.score ?? 0, headerRow };
  if (second && top.score - second.score < 0.06) {
    return { decision: "ambiguous", category: top.category, score: top.score, runnerUp, headerRow, mapping: top.mapping };
  }
  return { decision: "matched", category: top.category, score: top.score, runnerUp, headerRow, mapping: top.mapping };
}
