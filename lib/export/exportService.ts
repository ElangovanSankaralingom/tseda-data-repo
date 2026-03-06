import "server-only";

import { CATEGORY_LIST, getCategoryConfig, getCategorySchema } from "@/data/categoryRegistry";
import type { SchemaFieldKind } from "@/data/schemas/types";
import { isCategoryKey } from "@/lib/categories";
import { DataStore } from "@/lib/dataStore";
import { AppError, normalizeError } from "@/lib/errors";
import { normalizeEntryStatus } from "@/lib/entries/stateMachine";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { logger } from "@/lib/logger";
import { normalizeEntry } from "@/lib/normalize";
import { err, ok, type Result } from "@/lib/result";
import type { EntryStatus } from "@/lib/types/entry";

export const EXPORT_MAX_ROWS_DEFAULT = 10_000;
export const EXPORT_MAX_FIELDS_DEFAULT = 80;

const BASE_FIELD_DEFS = [
  { key: "category", label: "Category", kind: "string" as const },
  { key: "id", label: "Entry ID", kind: "string" as const },
  { key: "confirmationStatus", label: "Confirmation Status", kind: "string" as const },
  { key: "status", label: "Entry Stage", kind: "string" as const },
  { key: "createdAt", label: "Created At", kind: "string" as const },
  { key: "updatedAt", label: "Updated At", kind: "string" as const },
] as const;

type BaseFieldDef = (typeof BASE_FIELD_DEFS)[number];

export type ExportCategorySelection = CategoryKey | "all";
export type ExportFormat = "xlsx" | "csv";

export type ExportFieldOption = {
  key: string;
  label: string;
  kind: SchemaFieldKind | BaseFieldDef["kind"];
};

export type BuildExportOptions = {
  statuses?: EntryStatus[];
  fromISO?: string;
  toISO?: string;
  maxRows?: number;
};

export type ExportRowsResult = {
  headers: string[];
  rows: Array<Array<string | number | boolean>>;
  usedFieldKeys: string[];
  categoryKeys: CategoryKey[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toTrimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateMs(value: unknown) {
  const text = toTrimmed(value);
  if (!text) return Number.NaN;
  return Date.parse(text);
}

function toDateOnly(value: unknown) {
  const text = toTrimmed(value);
  if (!text) return "";
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toISOString().slice(0, 10);
}

function toIsoTimestamp(value: unknown) {
  const text = toTrimmed(value);
  if (!text) return "";
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toISOString();
}

function getValueAtPath(record: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split(".").filter(Boolean);
  if (parts.length === 0) return undefined;

  let current: unknown = record;
  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }

  return current;
}

function formatArrayCell(value: unknown[]): string {
  return value
    .map((item) => formatUnknownCell(item))
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(" | ");
}

function formatObjectCell(value: Record<string, unknown>): string {
  const fileName = toTrimmed(value.fileName);
  const storedPath = toTrimmed(value.storedPath);
  const url = toTrimmed(value.url);
  if (fileName) return fileName;
  if (storedPath) return storedPath;
  if (url) return url;
  return JSON.stringify(value);
}

function formatUnknownCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (Array.isArray(value)) return formatArrayCell(value);
  if (isRecord(value)) return formatObjectCell(value);
  return String(value);
}

function formatCellValue(
  fieldKey: string,
  kind: SchemaFieldKind | BaseFieldDef["kind"] | "unknown",
  value: unknown
): string | number | boolean {
  if (value === null || value === undefined) return "";

  if (fieldKey === "createdAt" || fieldKey === "updatedAt") {
    return toIsoTimestamp(value);
  }
  if (fieldKey === "confirmationStatus") {
    return toTrimmed(value).toUpperCase();
  }
  if (fieldKey === "status") {
    return toTrimmed(value).toLowerCase();
  }

  if (kind === "date") {
    return toDateOnly(value);
  }
  if (kind === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return "";
  }
  if (kind === "boolean") {
    if (typeof value === "boolean") return value;
    return "";
  }
  if (kind === "array") {
    return Array.isArray(value) ? formatArrayCell(value) : "";
  }
  if (kind === "object") {
    return isRecord(value) ? formatObjectCell(value) : "";
  }

  return formatUnknownCell(value);
}

function resolveCategoryKeys(category: ExportCategorySelection): CategoryKey[] {
  if (category === "all") return [...CATEGORY_LIST];
  return [category];
}

function resolveAllowedStatuses(statuses?: EntryStatus[]) {
  if (!statuses || statuses.length === 0) return null;
  return new Set(statuses);
}

function resolveFieldKinds(
  categoryKeys: CategoryKey[],
  fieldKeys: string[]
): Record<string, SchemaFieldKind | BaseFieldDef["kind"] | "unknown"> {
  const byKey: Record<string, SchemaFieldKind | BaseFieldDef["kind"] | "unknown"> = {};

  for (const baseField of BASE_FIELD_DEFS) {
    byKey[baseField.key] = baseField.kind;
  }

  for (const categoryKey of categoryKeys) {
    const schema = getCategorySchema(categoryKey);
    for (const field of schema.fields) {
      if (!(field.key in byKey)) {
        byKey[field.key] = field.kind;
      }
    }
  }

  return fieldKeys.reduce<Record<string, SchemaFieldKind | BaseFieldDef["kind"] | "unknown">>(
    (next, key) => {
      next[key] = byKey[key] ?? "unknown";
      return next;
    },
    {}
  );
}

function resolveFieldLabels(
  categoryKeys: CategoryKey[],
  fieldKeys: string[]
): Record<string, string> {
  const byKey: Record<string, string> = {};
  for (const baseField of BASE_FIELD_DEFS) {
    byKey[baseField.key] = baseField.label;
  }

  for (const categoryKey of categoryKeys) {
    const schema = getCategorySchema(categoryKey);
    for (const field of schema.fields) {
      if (!(field.key in byKey)) {
        byKey[field.key] = field.label;
      }
    }
  }

  return fieldKeys.reduce<Record<string, string>>((next, key) => {
    next[key] = byKey[key] ?? key;
    return next;
  }, {});
}

function resolveDefaultFieldKeys(categoryKeys: CategoryKey[]) {
  const keys = new Array<string>();
  for (const baseField of BASE_FIELD_DEFS) {
    keys.push(baseField.key);
  }

  const seen = new Set(keys);
  for (const categoryKey of categoryKeys) {
    const schema = getCategorySchema(categoryKey);
    for (const field of schema.fields) {
      if (seen.has(field.key)) continue;
      keys.push(field.key);
      seen.add(field.key);
    }
  }
  return keys;
}

export function getExportableFields(category: ExportCategorySelection): ExportFieldOption[] {
  const categoryKeys = resolveCategoryKeys(category);
  const keys = resolveDefaultFieldKeys(categoryKeys);
  const labels = resolveFieldLabels(categoryKeys, keys);
  const kinds = resolveFieldKinds(categoryKeys, keys);

  return keys.map((key) => ({
    key,
    label: labels[key] ?? key,
    kind: kinds[key] ?? "unknown",
  }));
}

export async function buildExportRows(
  userEmail: string,
  category: ExportCategorySelection,
  fieldKeys: string[],
  options: BuildExportOptions = {}
): Promise<Result<ExportRowsResult>> {
  try {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "User email is required.",
      });
    }

    const categoryKeys = resolveCategoryKeys(category);
    const selectedFieldKeys = Array.from(
      new Set(
        (fieldKeys ?? [])
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      )
    );
    const maxRows = Number.isFinite(options.maxRows)
      ? Math.max(1, Math.min(EXPORT_MAX_ROWS_DEFAULT, Number(options.maxRows)))
      : EXPORT_MAX_ROWS_DEFAULT;

    if (selectedFieldKeys.length > EXPORT_MAX_FIELDS_DEFAULT) {
      throw new AppError({
        code: "PAYLOAD_TOO_LARGE",
        message: `Too many selected fields. Maximum ${EXPORT_MAX_FIELDS_DEFAULT} fields are allowed.`,
      });
    }

    const usedFieldKeys =
      selectedFieldKeys.length > 0 ? selectedFieldKeys : resolveDefaultFieldKeys(categoryKeys);
    const fieldLabels = resolveFieldLabels(categoryKeys, usedFieldKeys);
    const fieldKinds = resolveFieldKinds(categoryKeys, usedFieldKeys);
    const headers = usedFieldKeys.map((key) => fieldLabels[key] ?? key);

    const allowedStatuses = resolveAllowedStatuses(options.statuses);
    const fromMs = options.fromISO ? Date.parse(options.fromISO) : Number.NaN;
    const toMs = options.toISO ? Date.parse(options.toISO) : Number.NaN;
    const store = new DataStore();
    const rows = new Array<Array<string | number | boolean>>();

    for (const categoryKey of categoryKeys) {
      const schema = getCategorySchema(categoryKey);
      const list = await store.readCategory(normalizedEmail, categoryKey);
      for (const rawEntry of list) {
        const entry = normalizeEntry(rawEntry, schema) as Record<string, unknown>;

        const workflowStatus = normalizeEntryStatus(entry);
        if (allowedStatuses && !allowedStatuses.has(workflowStatus)) {
          continue;
        }

        const timestampMs =
          parseDateMs(entry.updatedAt) || parseDateMs(entry.createdAt);
        if (!Number.isNaN(fromMs) && (Number.isNaN(timestampMs) || timestampMs < fromMs)) {
          continue;
        }
        if (!Number.isNaN(toMs) && (Number.isNaN(timestampMs) || timestampMs > toMs)) {
          continue;
        }

        const row = usedFieldKeys.map((fieldKey) => {
          if (fieldKey === "category") {
            return getCategoryConfig(categoryKey).label;
          }
          if (fieldKey === "confirmationStatus") {
            return workflowStatus;
          }
          const value = getValueAtPath(entry, fieldKey);
          const kind = fieldKinds[fieldKey] ?? "unknown";
          return formatCellValue(fieldKey, kind, value);
        });

        rows.push(row);
        if (rows.length > maxRows) {
          throw new AppError({
            code: "PAYLOAD_TOO_LARGE",
            message: `Export exceeds ${maxRows} rows. Narrow filters and retry.`,
          });
        }
      }
    }

    logger.info({
      event: "admin.export.rows",
      userEmail: normalizedEmail,
      category: category === "all" ? "all" : category,
      count: rows.length,
      fields: usedFieldKeys.length,
      statuses: options.statuses?.join(","),
    });

    return ok({
      headers,
      rows,
      usedFieldKeys,
      categoryKeys,
    });
  } catch (error) {
    return err(normalizeError(error));
  }
}

function csvEscape(value: string | number | boolean) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export function generateCsvText(
  headers: string[],
  rows: Array<Array<string | number | boolean>>
): Result<string> {
  try {
    const headerLine = headers.map(csvEscape).join(",");
    const bodyLines = rows.map((row) => row.map(csvEscape).join(","));
    return ok([headerLine, ...bodyLines].join("\n"));
  } catch (error) {
    return err(normalizeError(error));
  }
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let next = index + 1;
  let name = "";
  while (next > 0) {
    const remainder = (next - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    next = Math.floor((next - 1) / 26);
  }
  return name;
}

function buildSheetXml(headers: string[], rows: Array<Array<string | number | boolean>>) {
  const allRows = [headers, ...rows];
  const rowXml = allRows
    .map((row, rowIndex) => {
      const cellXml = row
        .map((cell, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (cell === "" || cell === null || cell === undefined) {
            return `<c r="${ref}"/>`;
          }
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          if (typeof cell === "boolean") {
            return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
          }
          const text = xmlEscape(String(cell));
          return `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cellXml}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function sanitizeSheetName(input: string) {
  const trimmed = input.trim() || "Export";
  const sanitized = trimmed.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim();
  return sanitized.slice(0, 31) || "Export";
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index] ?? 0;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type ZipEntry = {
  name: string;
  data: Buffer;
};

function buildZip(entries: ZipEntry[]) {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const dataBuffer = entry.data;
    const crc = crc32(dataBuffer);
    const size = dataBuffer.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralChunks.push(centralHeader, nameBuffer);
    localOffset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const localData = Buffer.concat(localChunks);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, end]);
}

export function generateXlsxBuffer(
  headers: string[],
  rows: Array<Array<string | number | boolean>>,
  sheetNameInput: string
): Result<Buffer> {
  try {
    const sheetName = sanitizeSheetName(sheetNameInput);
    const sheetXml = buildSheetXml(headers, rows);
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const zip = buildZip([
      { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf8") },
      { name: "_rels/.rels", data: Buffer.from(rootRelsXml, "utf8") },
      { name: "xl/workbook.xml", data: Buffer.from(workbookXml, "utf8") },
      { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml, "utf8") },
      { name: "xl/styles.xml", data: Buffer.from(stylesXml, "utf8") },
      { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml, "utf8") },
    ]);

    return ok(zip);
  } catch (error) {
    return err(normalizeError(error));
  }
}

export function parseExportCategory(value: string): ExportCategorySelection | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "all") return "all";
  return isCategoryKey(normalized) ? normalized : null;
}

export function parseExportStatuses(value: string): EntryStatus[] {
  const parsed = value
    .split(",")
    .map((status) => status.trim().toUpperCase())
    .filter(Boolean);

  const statuses = new Set<EntryStatus>();
  for (const candidate of parsed) {
    if (candidate === "DRAFT") statuses.add("DRAFT");
    if (candidate === "PENDING_CONFIRMATION") statuses.add("PENDING_CONFIRMATION");
    if (candidate === "APPROVED") statuses.add("APPROVED");
    if (candidate === "REJECTED") statuses.add("REJECTED");
  }
  return Array.from(statuses);
}

export function parseExportFieldKeys(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean)
    )
  );
}
