import "server-only";

import { getCategoryConfig, getCategorySchema, getCategoryTitle } from "@/data/categoryRegistry";
import type { SchemaFieldDefinition } from "@/data/schemas/types";
import type { CategoryKey } from "@/lib/entries/types";
import type { Entry } from "@/lib/types/entry";

export type PrintablePdfField = {
  label: string;
  value: string;
};

export type EntryPdfData = {
  categoryName: string;
  fileNameBase: string;
  fields: PrintablePdfField[];
};

/** System/lifecycle fields that never appear in the PDF (universal, not per-schema) */
const SYSTEM_OMIT_FROM_PDF = new Set([
  "id", "status", "confirmationStatus", "confirmationRejectedReason",
  "sentForConfirmationAtISO", "confirmedAtISO", "confirmedBy",
  "createdAt", "updatedAt", "attachments", "uploads",
  "pdfMeta", "pdfSourceHash", "pdfStale", "streak",
]);

/** Cache of per-category omit sets (system fields + schema upload fields) */
const omitFromPdfCache = new Map<string, Set<string>>();

function getOmitFromPdfSet(category: CategoryKey): Set<string> {
  let cached = omitFromPdfCache.get(category);
  if (cached) return cached;

  const schema = getCategorySchema(category);
  cached = new Set(SYSTEM_OMIT_FROM_PDF);
  for (const field of schema.fields) {
    if (field.upload === true || field.exportable === false) {
      cached.add(field.key);
    }
  }
  omitFromPdfCache.set(category, cached);
  return cached;
}

function trimText(value: unknown) {
  return String(value ?? "").trim();
}

function formatDateText(value: unknown) {
  const text = trimText(value);
  if (!text) return "";
  const parsed = Date.parse(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatNumberText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return String(parsed);
  }
  return "";
}

function formatBooleanText(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return "";
}

function formatFacultyRecord(value: Record<string, unknown>) {
  const name = trimText(value.name);
  const email = trimText(value.email);
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return "";
}

function formatObjectText(fieldKey: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;

  if (fieldKey === "coordinator") {
    return formatFacultyRecord(record);
  }

  const fileName = trimText(record.fileName);
  if (fileName) return fileName;
  const storedPath = trimText(record.storedPath);
  if (storedPath) return storedPath;
  const url = trimText(record.url);
  if (url) return url;
  return "";
}

function isFacultyRowArray(value: unknown[]): boolean {
  const first = value[0];
  return !!first && typeof first === "object" && !Array.isArray(first) &&
    ("id" in (first as Record<string, unknown>) || "email" in (first as Record<string, unknown>));
}

function formatArrayText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "";
  if (isFacultyRowArray(value)) {
    const formatted = value
      .map((item) => (item && typeof item === "object" ? formatFacultyRecord(item as Record<string, unknown>) : ""))
      .map((item) => item.trim())
      .filter(Boolean);
    return formatted.join(", ");
  }

  const formatted = value
    .map((item) => trimText(item))
    .map((item) => item.trim())
    .filter(Boolean);
  return formatted.join(", ");
}

function formatFieldValue(field: SchemaFieldDefinition, entry: Record<string, unknown>) {
  const value = entry[field.key];

  if (field.kind === "string") return trimText(value);
  if (field.kind === "date") return formatDateText(value);
  if (field.kind === "number") {
    const numericText = formatNumberText(value);
    if (!numericText) return "";
    if (field.format === "currency") {
      const num = Number(numericText);
      return Number.isFinite(num) ? `Rs. ${num.toLocaleString("en-IN")}` : numericText;
    }
    return numericText;
  }
  if (field.kind === "boolean") return formatBooleanText(value);
  if (field.kind === "object") return formatObjectText(field.key, value);
  if (field.kind === "array") return formatArrayText(value);
  return trimText(value);
}

function computeInclusiveDays(entry: Record<string, unknown>) {
  const startDate = trimText(entry.startDate);
  const endDate = trimText(entry.endDate);
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / 86400000) + 1;
}

function buildFileNameBase(category: CategoryKey, entryId: string, title: string) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeTitle = title || "entry";
  return `TSEDA_${category}_${entryId || "entry"}_${datePart}_${safeTitle}`;
}

export function buildEntryPdfData(category: CategoryKey, entryLike: Entry): EntryPdfData {
  const entry = (entryLike ?? {}) as Record<string, unknown>;
  const config = getCategoryConfig(category);
  const schema = getCategorySchema(category);
  const entryId = trimText(entry.id);
  const title = getCategoryTitle(entry, category);
  const inclusiveDays = computeInclusiveDays(entry);

  const omitKeys = getOmitFromPdfSet(category);
  const fields: PrintablePdfField[] = [];
  for (const field of schema.fields) {
    if (omitKeys.has(field.key)) continue;
    const value = formatFieldValue(field, entry);
    if (!value) continue;
    fields.push({ label: field.label, value });
    if (field.key === "endDate" && inclusiveDays !== null) {
      fields.push({ label: "Number of Days", value: String(inclusiveDays) });
    }
  }

  if (fields.length === 0) {
    fields.push({ label: "Entry ID", value: entryId || "-" });
  }

  return {
    categoryName: config.label,
    fileNameBase: buildFileNameBase(category, entryId, title),
    fields,
  };
}
