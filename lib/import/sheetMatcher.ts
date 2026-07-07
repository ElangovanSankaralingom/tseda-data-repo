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
const IGNORED_HEADERS = [
  "s no", "sl no", "s no.", "sno", "serial no", "serial number", "sr no",
  // Departmental tracking columns present on nearly every sheet (2025-26 workbook).
  "verified y n", "remarks", "target date", "proof", "proofs", "proof link",
  "proofs link", "proof link as pdf", "links proof as pdf", "proofs required",
  "proof as pdf", "dlc",
];

/** Columns naming the OWNING faculty (drives draft ownership). */
const OWNER_HEADERS = [
  "teacher name", "name of the teacher", "faculty name", "name of the faculty",
  "name of faculty member", "faculty involved", "staff name", "staff accompanying",
  "name of the staff", "coordinator", "project coordinator", "recipient", "faculty",
  "name of teacher", "name of the teacher",
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
    coAuthors: ["authors", "author names", "name of the authors", "faculty authors"],
    externalAuthors: ["external authors", "other authors"],
  },
  "conference-publications": {
    paperTitle: ["paper title", "title of paper", "title of the paper", "title"],
    conferenceName: ["conference name", "name of the conference", "conference"],
    issnIsbn: ["issn", "isbn", "issn isbn", "issn no"],
    level: ["international national", "national international", "level", "intl natl"],
    publicationDate: ["month year", "month and year", "date", "date of conference"],
    pageNumbers: ["pages", "page numbers", "page nos"],
    organizedBy: ["organisers", "organizers", "organized by", "organised by"],
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
    agencyOrClient: ["sponsoring agency", "funding agency", "agency", "client", "name of the client", "sponsored by"],
    amountInr: ["amount inr", "amount", "revenue generated", "sanctioned amount", "grant amount", "amount in rs"],
    sanctionDate: ["sanction date", "date of sanction", "sanctioned on"],
    durationText: ["duration", "project duration", "period"],
    investigators: ["project coordinator", "investigators", "pi co pi", "faculty involved", "principal investigator"],
  },
  patents: {
    patentTitle: ["patent title", "title of the patent", "name of the patent", "title"],
    inventors: ["inventors", "name of the inventors", "faculty involved"],
    applicationNumber: ["application no", "application number", "patent no", "patent number"],
    applicationDate: ["application date", "date of application", "filed on"],
    statusDate: ["grant date", "date of grant", "granted on", "status date"],
  },
  "guest-lectures": {
    topicOfLecture: ["name of the event", "event name", "topic", "title of the lecture", "topic of the lecture"],
    guestSpeakerName: ["speaker", "speaker organization detail", "name of the speaker", "resource person"],
    guestSpeakerOrganisation: ["institution industry", "organization", "organisation", "company"],
    startDate: ["date dd mm yy", "date", "date of the event", "event date"],
    coCoordinators: ["organisers", "organizers", "faculty organisers", "faculty coordinators"],
  },
  "fdp-attended": {
    programName: [
      "name of conference workshop attended for which financial support provided",
      "name of conference workshop attended", "conference workshop attended",
      "program name", "programme name", "name of the program", "name of the fdp", "fdp name",
    ],
    organisingBody: ["organizing body", "organising body", "organized by", "organiser", "name of the professional body for which membership fee is provided"],
    fundingAmount: ["amount of support", "support amount", "financial support"],
    startDate: ["from", "start date"],
  },
  "case-studies": {
    placeOfVisit: ["places of visit", "place of visit", "location"],
    purposeOfVisit: ["purpose interactions", "purpose", "purpose of visit"],
    staffAccompanying: ["staff accompanying", "accompanying staff", "faculty accompanying"],
    startDate: ["date", "date of visit"],
  },
  "mentoring-programs": {
    programName: ["event name", "name of the event", "program name"],
    startDate: ["date dd mm yy", "date", "dates"],
    studentsCovered: ["students covered", "no of students"],
  },
  "exhibitions-outreach": {
    eventName: ["event", "event name", "name of the event"],
    venue: ["venue", "location", "place"],
    startDate: ["date", "dates", "date of the event"],
  },
  "online-courses": {
    courseName: ["course name", "name of the course", "course"],
    durationWeeks: ["duration weeks", "no of weeks", "weeks"],
    industryExpert: ["offering organization", "offering organisation", "industry partner"],
  },
  "student-placements": {
    regNo: ["reg no", "register no", "registration no", "reg number"],
    studentName: ["name of the student", "student name"],
    companyName: ["office details", "company name", "employer", "name of the company"],
    packageLpa: ["annual salary", "salary", "package", "ctc"],
    offerDate: ["date of offer", "offer date"],
  },
  "student-higher-studies": {
    regNo: ["reg no", "register no", "registration no"],
    studentName: ["name of the student", "student name"],
    institutionName: ["name of the institution", "institution", "university"],
    courseAdmitted: ["course", "programme admitted", "course admitted"],
  },
  "student-exams": {
    regNo: ["reg no", "register no", "registration no"],
    studentName: ["name of the student", "student name"],
    examName: ["qualifying exam", "exam name", "name of the exam", "exam"],
    examDate: ["date dd mm yy", "date"],
    scoreOrRank: ["score", "rank", "result", "score rank"],
  },
  "student-awards": {
    regNo: ["reg no", "register no", "registration no"],
    studentName: ["student name", "name of the student"],
    awardTitle: ["name of the event participate", "name of the event", "event name"],
    awardedBy: ["organization detail", "organisation detail", "awarded by", "organizer"],
    awardLevel: ["state national international level", "level"],
    awardDate: ["date dd mm yy", "date"],
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
  "fdp-attended": ["fdp", "fdp conference", "fdp conference attended", "attended", "financial support", "qn 38", "qn 39"],
  "fdp-conducted": ["fdp conducted", "training conducted", "fdps workshops training"],
  "case-studies": ["case stud", "site visit"],
  "mentoring-programs": ["fast learner", "slow learner", "mentoring", "qn 6", "qn 7"],
  "student-placements": ["placement", "qn 32"],
  "student-higher-studies": ["higher studies", "qn 33"],
  "student-exams": ["competitive exam", "qn 34"],
  "student-awards": ["student award", "nss ncc", "qn 35"],
  "conferences-organized": ["conference organized", "conference organised", "conference conducted"],
  "editorial-roles": ["editor", "editorial"],
  "design-competitions": ["design competition", "competition", "design expos and medals", "design expo", "expos", "medals", "medal", "nasa"],
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
  // Containment: generous, but only when the shorter side is substantial —
  // a bare 4-char "name" must not claim "student name" (the WDC/visiting-
  // faculty false-pull class from the real workbook).
  if ((h.includes(v) || v.includes(h)) && Math.min(h.length, v.length) >= 6) {
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

  type Scored = { category: CategoryKey; score: number; mapping: ColumnMapping; mappedSpecific: number; nameBonus: number };
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
    let coverageScore = Math.min(coverage / denom, 1);
    // Student-record categories (schema carries regNo + studentName) demand a
    // student column: dept event sheets (WDC, associations) share the generic
    // event template and would otherwise false-match on event/date/organizer.
    const hasStudentFields = fields.some((f) => f.key === "studentName") && fields.some((f) => f.key === "regNo");
    if (hasStudentFields) {
      const mappedKeys = new Set(mapping.columns.values());
      if (!mappedKeys.has("studentName") && !mappedKeys.has("regNo")) coverageScore *= 0.25;
    }
    const hints = SHEET_NAME_HINTS[category] ?? [];
    // Banner text above the header row often names the real subject better
    // than the sheet tab ("Career Guidance - ..." tabs with a "Placement"
    // banner). Scan both, take the best hint hit.
    const bannerText = rows
      .slice(0, headerRow)
      .flat()
      .filter((c): c is string => typeof c === "string")
      .join(" ")
      .slice(0, 400);
    let nameBonus = 0;
    for (const hint of hints) {
      nameBonus = Math.max(nameBonus, headerSimilarity(sheetName, hint));
      if (bannerText) nameBonus = Math.max(nameBonus, 0.9 * headerSimilarity(bannerText, hint));
    }
    const total = 0.65 * coverageScore + 0.35 * nameBonus;
    let mappedSpecific = 0;
    for (const key of mapping.columns.values()) {
      if (key !== "__ignore__" && key !== "__owner__" && !(key in GLOBAL_SYNONYMS)) mappedSpecific++;
    }
    scored.push({ category, score: total, mapping, mappedSpecific, nameBonus });
  }
  scored.sort((a, b) => b.score - a.score);
  const [top, second] = scored;
  const runnerUp = second ? { category: second.category, score: second.score } : undefined;
  if (!top || top.score < 0.3) return { decision: "unmatched", score: top?.score ?? 0, headerRow };
  // Corroboration floor: two shared event-template columns (event name +
  // date) score surprisingly well on several categories. A match needs
  // BREADTH (3+ schema-specific columns) or an independent hint from the
  // sheet name/banner — otherwise the generic dept event sheets (WDC,
  // associations, SIG) false-attach to whichever category shares their
  // template. Real sheets always have one or the other.
  if (top.mappedSpecific < 3 && top.nameBonus < 0.3) {
    return { decision: "unmatched", score: top.score, headerRow };
  }
  if (second && top.score - second.score < 0.06) {
    return { decision: "ambiguous", category: top.category, score: top.score, runnerUp, headerRow, mapping: top.mapping };
  }
  return { decision: "matched", category: top.category, score: top.score, runnerUp, headerRow, mapping: top.mapping };
}
