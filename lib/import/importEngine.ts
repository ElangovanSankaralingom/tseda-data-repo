import "server-only";
import crypto from "node:crypto";
import { ENTRY_SCHEMAS } from "@/data/schemas";
import { getCategoryEntryScope } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";
import type { SchemaFieldDefinition } from "@/data/schemas/types";
import type { Workbook, CellValue } from "@/lib/import/xlsxReader";
import { classifySheet, type SheetClassification } from "@/lib/import/sheetMatcher";
import {
  cleanText, normalizeDate, normalizeEnum, normalizeAmount, normalizeBoolean,
  normalizeNumber, normalizeAcademicYear, normalizeSemesterType,
  academicYearFromISO, semesterFromISO,
} from "@/lib/import/normalize";
import { resolveName, resolveNameList, type RegistryFaculty, type NameResolution } from "@/lib/import/facultyResolver";

/**
 * The importer's orchestration: workbook → per-row plans → (apply) drafts.
 *
 * INVARIANTS HONORED (docs/INVARIANTS.md):
 * - I-W1: apply creates entries ONLY through the injected engine createEntry
 *   (lib/entries/lifecycle) — never a store write. Index/summary refresh and
 *   revision bumps come free.
 * - Drafts by ruling (2026-07-07, Elan): imported rows land as prefilled
 *   DRAFTS owned by the resolved faculty. Drafts have earned nothing, so the
 *   feed stays silent by construction (I-F2 needs no suppression machinery).
 * - Create-mode validation tolerates ABSENT keys: unmapped/empty/unparseable
 *   values are omitted, never fabricated. requiredForCommit gaps are
 *   reported for the faculty to fill before submit.
 *
 * Idempotency: every planned row carries a content hash; the ledger maps
 * hash → created entry id. Re-running an import skips ledgered rows, so a
 * crashed apply resumes safely and a re-run after faculty edits never
 * clobbers or duplicates.
 */

export type RowIssue = { severity: "info" | "attention"; message: string };

export type RowPlan = {
  sheetName: string;
  /** 1-based workbook row number (as a user sees it in Excel). */
  rowNumber: number;
  category: CategoryKey;
  outcome: "ready" | "attention" | "duplicate" | "empty";
  owner?: { email: string; name: string };
  payload: Record<string, unknown>;
  issues: RowIssue[];
  /** requiredForCommit fields still missing (informational — drafts tolerate). */
  missingForCommit: string[];
  dedupHash: string;
};

export type SheetPlan = {
  sheetName: string;
  classification: SheetClassification;
  headers: (string | null)[];
  rows: RowPlan[];
};

export type ImportPlan = {
  sheets: SheetPlan[];
  summary: {
    sheetsMatched: number;
    sheetsAmbiguous: number;
    sheetsUnmatched: number;
    rowsReady: number;
    rowsAttention: number;
    rowsDuplicate: number;
    unresolvedNames: Map<string, { count: number; suggestion?: { email: string; name: string } }>;
  };
};

export type ImportLedger = Record<string, { entryId: string; category: CategoryKey; owner: string; at: string }>;

export type ImportDeps = {
  registry: readonly RegistryFaculty[];
  ledger: ImportLedger;
  /** Owner for rows in dlc-scoped categories (student sheets) that carry no
   *  faculty name — typically the DLC coordinator running the import.
   *  NEVER applied to faculty-scoped categories. */
  dlcOwner?: { email: string; name: string };
};

const OWNERISH_FIELD_KEYS = new Set(["teacherName", "facultyName", "recipient", "coordinator"]);

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function fieldByKey(category: CategoryKey, key: string): SchemaFieldDefinition | undefined {
  return ENTRY_SCHEMAS[category].fields.find((f) => f.key === key);
}

function collabFieldOf(category: CategoryKey): SchemaFieldDefinition | undefined {
  return ENTRY_SCHEMAS[category].fields.find(
    (f) => (f as unknown as { collaborates?: boolean }).collaborates,
  );
}

/** Normalize one cell for one schema field; null = omit (with note when lossy). */
function normalizeCell(
  field: SchemaFieldDefinition,
  raw: CellValue,
  issues: RowIssue[],
): unknown {
  if (raw === null || raw === "" || raw === undefined) return null;
  if (field.key === "academicYear") {
    const ay = normalizeAcademicYear(raw);
    if (!ay) issues.push({ severity: "info", message: `academicYear "${cleanText(raw)}" unparseable — left for faculty` });
    return ay?.value ?? null;
  }
  if (field.key === "semesterType") {
    const st = normalizeSemesterType(raw);
    return st?.value ?? null;
  }
  if (field.kind === "date") {
    const d = normalizeDate(raw);
    if (!d) {
      issues.push({ severity: "info", message: `${field.label}: "${cleanText(raw)}" not a readable date — left blank` });
      return null;
    }
    if (d.inferred) issues.push({ severity: "info", message: `${field.label}: ${d.inferred}` });
    return d.value;
  }
  if (field.enumValues?.length) {
    const e = normalizeEnum(raw, field.enumValues);
    if (!e) {
      issues.push({ severity: "info", message: `${field.label}: "${cleanText(raw)}" matches no option — left blank` });
      return null;
    }
    if (e.inferred) issues.push({ severity: "info", message: `${field.label}: ${e.inferred}` });
    return e.value;
  }
  if (field.kind === "number") {
    const n = field.format === "currency" ? normalizeAmount(raw) : normalizeNumber(raw);
    if (!n) {
      issues.push({ severity: "info", message: `${field.label}: "${cleanText(raw)}" not numeric — left blank` });
      return null;
    }
    if (n.inferred) issues.push({ severity: "info", message: `${field.label}: ${n.inferred}` });
    // Unit repair: the workbook's salary columns are rupees ("3,00,000");
    // packageLpa wants lakhs per annum. Anything ≥ 1000 is clearly rupees.
    if (field.key === "packageLpa" && n.value >= 1000) {
      const lpa = Math.round((n.value / 1e5) * 100) / 100;
      issues.push({ severity: "info", message: `${field.label}: ₹${n.value.toLocaleString("en-IN")} read as ${lpa} LPA` });
      return lpa;
    }
    return n.value;
  }
  if (field.kind === "boolean") {
    return normalizeBoolean(raw)?.value ?? null;
  }
  // A raw NUMBER in the Excel date-serial range landing in a string field is
  // almost always a cell Excel silently date-converted ("7/2025" → 45848).
  // Keep what the sheet says, but flag it for the faculty pass.
  if (typeof raw === "number" && raw >= 36526 && raw <= 73415) {
    const d = normalizeDate(raw);
    issues.push({
      severity: "info",
      message: `${field.label}: cell holds ${raw} — likely an Excel-converted date (${d?.value ?? "?"}); verify the original text`,
    });
  }
  const text = cleanText(raw);
  if (field.maxLength && text.length > field.maxLength) {
    issues.push({ severity: "info", message: `${field.label}: trimmed to ${field.maxLength} chars` });
    return text.slice(0, field.maxLength);
  }
  return text || null;
}

function planRow(
  category: CategoryKey,
  sheetName: string,
  rowNumber: number,
  headers: (string | null)[],
  columns: Map<number, string>,
  row: CellValue[],
  deps: ImportDeps,
  batchHashes: Set<string>,
  unresolved: ImportPlan["summary"]["unresolvedNames"],
): RowPlan {
  const issues: RowIssue[] = [];
  const payload: Record<string, unknown> = {};
  const schema = ENTRY_SCHEMAS[category];
  const collabField = collabFieldOf(category);
  let ownerCellValue: string | null = null;
  const externalLeftovers: string[] = [];

  const populated = row.some((c) => c !== null && c !== "" && c !== undefined);
  if (!populated) {
    return {
      sheetName, rowNumber, category, outcome: "empty",
      payload: {}, issues: [], missingForCommit: [], dedupHash: "",
    };
  }
  // Repeated-header echo: departmental sheets restate their header row at
  // section breaks (per semester). If most populated cells reproduce the
  // header cells verbatim, this is furniture, not data.
  {
    const nonEmpty = row.filter((c) => c !== null && c !== "" && c !== undefined);
    const headerSet = new Set(headers.filter((h): h is string => !!h).map((h) => cleanText(h).toLowerCase()));
    const echo = nonEmpty.filter((c) => headerSet.has(cleanText(c).toLowerCase())).length;
    if (nonEmpty.length >= 2 && echo / nonEmpty.length >= 0.6) {
      return {
        sheetName, rowNumber, category, outcome: "empty",
        payload: {}, issues: [], missingForCommit: [], dedupHash: "",
      };
    }
  }

  for (const [col, key] of columns) {
    const raw = row[col] ?? null;
    if (key === "__ignore__") continue;
    if (key === "__owner__") {
      if (raw !== null && raw !== "") ownerCellValue = cleanText(raw);
      continue;
    }
    const field = fieldByKey(category, key);
    if (!field) continue;
    if (collabField && key === collabField.key) {
      if (raw === null || raw === "") continue;
      const parts = resolveNameList(String(raw), deps.registry);
      const rows: { email: string; name: string; isLocked: true }[] = [];
      for (const part of parts) {
        const r: NameResolution = part.resolution;
        if (r.kind === "resolved") {
          rows.push({ email: r.email, name: r.name, isLocked: true });
        } else {
          if (r.kind === "suggested") {
            issues.push({ severity: "attention", message: `"${part.raw}" — closest faculty is ${r.name} <${r.email}> (${(r.score * 100).toFixed(0)}%); confirm or treat as external` });
          }
          externalLeftovers.push(part.raw);
          const entry = unresolved.get(part.raw) ?? { count: 0, suggestion: r.kind === "suggested" ? { email: r.email, name: r.name } : undefined };
          entry.count++;
          unresolved.set(part.raw, entry);
        }
      }
      if (rows.length) payload[collabField.key] = rows;
      continue;
    }
    const value = normalizeCell(field, raw, issues);
    if (value !== null) payload[key] = value;
  }

  // Owner resolution: explicit owner column → collab list head → attention.
  let owner: { email: string; name: string } | undefined;
  if (ownerCellValue) {
    const r = resolveName(ownerCellValue, deps.registry);
    if (r.kind === "resolved") owner = { email: r.email, name: r.name };
    else {
      if (r.kind === "suggested") {
        issues.push({ severity: "attention", message: `Owner "${ownerCellValue}" — closest faculty is ${r.name} <${r.email}> (${(r.score * 100).toFixed(0)}%); confirm before import` });
      } else {
        issues.push({ severity: "attention", message: `Owner "${ownerCellValue}" matches no registered faculty` });
      }
      const entry = unresolved.get(ownerCellValue) ?? { count: 0, suggestion: r.kind === "suggested" ? { email: r.email, name: r.name } : undefined };
      entry.count++;
      unresolved.set(ownerCellValue, entry);
    }
  }
  if (!owner && collabField) {
    const rows = payload[collabField.key] as { email: string; name: string }[] | undefined;
    if (rows?.length) {
      owner = { email: rows[0].email, name: rows[0].name };
      // The owner is the entry-holder, not their own collaborator: engineShare
      // swaps the origin owner back in on fan-out copies.
      const rest = rows.slice(1);
      if (rest.length) payload[collabField.key] = rest;
      else delete payload[collabField.key];
    }
  }
  // Ownerish plain fields (teacherName etc.) resolve as a last resort.
  if (!owner) {
    for (const key of Object.keys(payload)) {
      if (!OWNERISH_FIELD_KEYS.has(key)) continue;
      const r = resolveName(String(payload[key]), deps.registry);
      if (r.kind === "resolved") {
        owner = { email: r.email, name: r.name };
        break;
      }
    }
  }
  if (!owner && deps.dlcOwner && getCategoryEntryScope(category) === "dlc") {
    owner = deps.dlcOwner;
    issues.push({ severity: "info", message: `Owner defaulted to DLC coordinator ${deps.dlcOwner.name} (dlc-scoped category)` });
  }
  if (!owner) {
    issues.push({ severity: "attention", message: "No owner could be resolved for this row" });
  }

  // External authors: leftovers from the collab cell join any mapped value.
  if (externalLeftovers.length) {
    const extField = schema.fields.find((f) => f.key === "externalAuthors");
    if (extField) {
      const existing = typeof payload.externalAuthors === "string" ? payload.externalAuthors + "; " : "";
      payload.externalAuthors = existing + externalLeftovers.join("; ");
    } else {
      issues.push({ severity: "info", message: `External names kept out (no field): ${externalLeftovers.join("; ")}` });
    }
  }

  // Spine inference: derive academicYear/semesterType from the row's best date.
  const dateKeys = schema.fields.filter((f) => f.kind === "date").map((f) => f.key);
  const firstDate = dateKeys.map((k) => payload[k]).find((v): v is string => typeof v === "string");
  if (!payload.academicYear && firstDate) {
    const ay = academicYearFromISO(firstDate);
    if (ay) {
      payload.academicYear = ay.value;
      issues.push({ severity: "info", message: ay.inferred! });
    }
  }
  if (!payload.semesterType && firstDate) {
    const st = semesterFromISO(firstDate);
    if (st) {
      payload.semesterType = st.value;
      issues.push({ severity: "info", message: st.inferred! });
    }
  }

  // Pre-flight validation (create mode). Present-but-invalid fields are
  // dropped with a note so the draft still lands; a second failure skips.
  let errors = schema.validate(payload, "create");
  if (errors.length) {
    for (const err of errors) {
      if (err.field in payload) {
        issues.push({ severity: "info", message: `${err.field}: ${err.message} — value dropped for faculty to re-enter` });
        delete payload[err.field];
      }
    }
    errors = schema.validate(payload, "create");
  }

  // Payload truth only: the sheet-level mapping gaps stay in the sheet
  // section; spine inference may have filled fields no column carried.
  const required = schema.requiredForCommit ?? [];
  const missingForCommit = required.filter((k) => !(k in payload) && k !== "id");

  // Content hash over category + owner + stage-1 scalars (stable order).
  const hashable = Object.entries(payload)
    .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("|");
  const dedupHash = sha256(`${category}|${owner?.email ?? "?"}|${hashable}`);

  let outcome: RowPlan["outcome"];
  if (errors.length || !owner) outcome = "attention";
  else if (deps.ledger[dedupHash] || batchHashes.has(dedupHash)) outcome = "duplicate";
  else outcome = "ready";
  if (outcome === "ready") batchHashes.add(dedupHash);
  if (outcome === "duplicate" && deps.ledger[dedupHash]) {
    issues.push({ severity: "info", message: `Already imported as entry ${deps.ledger[dedupHash].entryId}` });
  }

  return { sheetName, rowNumber, category, outcome, owner, payload, issues, missingForCommit, dedupHash };
}

export function planImport(workbook: Workbook, deps: ImportDeps, opts?: { sheetFilter?: string }): ImportPlan {
  const sheets: SheetPlan[] = [];
  const unresolvedNames: ImportPlan["summary"]["unresolvedNames"] = new Map();
  const batchHashes = new Set<string>();
  for (const sheet of workbook.sheets) {
    if (opts?.sheetFilter && sheet.name !== opts.sheetFilter) continue;
    const classification = classifySheet(sheet.name, sheet.rows);
    const headers = (sheet.rows[classification.headerRow] ?? []).map((c) => (c === null ? null : String(c)));
    const plan: SheetPlan = { sheetName: sheet.name, classification, headers, rows: [] };
    if (classification.decision === "matched" && classification.category && classification.mapping) {
      for (let r = classification.headerRow + 1; r < sheet.rows.length; r++) {
        const rowPlan = planRow(
          classification.category, sheet.name, r + 1, headers,
          classification.mapping.columns, sheet.rows[r], deps,
          batchHashes, unresolvedNames,
        );
        if (rowPlan.outcome !== "empty") plan.rows.push(rowPlan);
      }
    }
    sheets.push(plan);
  }
  const all = sheets.flatMap((s) => s.rows);
  return {
    sheets,
    summary: {
      sheetsMatched: sheets.filter((s) => s.classification.decision === "matched").length,
      sheetsAmbiguous: sheets.filter((s) => s.classification.decision === "ambiguous").length,
      sheetsUnmatched: sheets.filter((s) => s.classification.decision === "unmatched").length,
      rowsReady: all.filter((r) => r.outcome === "ready").length,
      rowsAttention: all.filter((r) => r.outcome === "attention").length,
      rowsDuplicate: all.filter((r) => r.outcome === "duplicate").length,
      unresolvedNames,
    },
  };
}

export type ApplyResult = {
  created: { sheetName: string; rowNumber: number; category: CategoryKey; owner: string; entryId: string }[];
  skipped: number;
  failed: { sheetName: string; rowNumber: number; error: string }[];
  ledger: ImportLedger;
};

/** Apply READY rows as drafts through the engine. Ledger returned for persist. */
export async function applyImport(
  plan: ImportPlan,
  deps: ImportDeps & {
    createEntry: (owner: string, category: CategoryKey, payload: Record<string, unknown>) => Promise<{ id?: unknown }>;
  },
): Promise<ApplyResult> {
  const result: ApplyResult = { created: [], skipped: 0, failed: [], ledger: { ...deps.ledger } };
  for (const sheet of plan.sheets) {
    for (const row of sheet.rows) {
      if (row.outcome !== "ready" || !row.owner) {
        result.skipped++;
        continue;
      }
      if (result.ledger[row.dedupHash]) {
        result.skipped++;
        continue;
      }
      try {
        const created = await deps.createEntry(row.owner.email, row.category, row.payload);
        const entryId = String(created?.id ?? "");
        result.created.push({ sheetName: sheet.sheetName, rowNumber: row.rowNumber, category: row.category, owner: row.owner.email, entryId });
        result.ledger[row.dedupHash] = { entryId, category: row.category, owner: row.owner.email, at: new Date().toISOString() };
      } catch (error) {
        result.failed.push({ sheetName: sheet.sheetName, rowNumber: row.rowNumber, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return result;
}
