import "server-only";

import { CATEGORY_LIST, getCategoryConfig, getCategorySchema } from "@/data/categoryRegistry";
import {
  BASE_EXPORT_FIELD_DEFS,
  type SchemaExportFieldDefinition,
} from "@/data/schemas/exportConfig";
import type {
  SchemaFieldKind,
} from "@/data/schemas/types";
import { isCategoryKey } from "@/lib/categories";
import { DataStore } from "@/lib/dataStore";
import { AppError, normalizeError } from "@/lib/errors";
import { normalizeEntryStatus } from "@/lib/entries/stateMachine";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { logger } from "@/lib/logger";
import { normalizeEntry } from "@/lib/normalize";
import { err, ok, type Result } from "@/lib/result";
import {
  ENTRY_STATUSES,
  ENTRY_STATUS_LABELS,
  isEntryStatus,
  type EntryStatus,
} from "@/lib/types/entry";

// Re-export generators for consumers
export { generateCsvText, generateXlsxBuffer, generateJsonText } from "./exportGenerators";

export const EXPORT_MAX_ROWS_DEFAULT = 10_000;
export const EXPORT_MAX_FIELDS_DEFAULT = 80;

export type ExportStatusOption = {
  key: EntryStatus;
  label: string;
};

export type ExportCategorySelection = CategoryKey | "all";
export type ExportFormat = "xlsx" | "csv" | "json";

export type ExportFieldOption = {
  key: string;
  label: string;
  kind: SchemaFieldKind;
};

export type ExportCategoryOption = {
  key: ExportCategorySelection;
  label: string;
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
  countsByStatus: Record<EntryStatus, number>;
};

export const EXPORT_CANONICAL_STATUSES: readonly EntryStatus[] = ENTRY_STATUSES;

export const EXPORT_STATUS_OPTIONS: readonly ExportStatusOption[] = ENTRY_STATUSES.map(
  (status) => ({
    key: status,
    label: ENTRY_STATUS_LABELS[status],
  })
);

type ExportFieldDefinition = SchemaExportFieldDefinition;

type CollectedExportEntry = {
  categoryKey: CategoryKey;
  categoryLabel: string;
  workflowStatus: EntryStatus;
  entry: Record<string, unknown>;
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
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value.trim();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (Array.isArray(value)) return formatArrayCell(value);
  if (isRecord(value)) return formatObjectCell(value);
  return String(value);
}

function formatBooleanYesNo(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return "Yes";
    if (normalized === "false") return "No";
  }
  return "";
}

function formatExportValue(
  fieldDef: ExportFieldDefinition,
  value: unknown
): string | number | boolean {
  if (value === null || value === undefined) return "";

  if (fieldDef.exportFormatter === "status") {
    return toTrimmed(value).toUpperCase();
  }
  if (fieldDef.exportFormatter === "datetime") {
    return toIsoTimestamp(value);
  }
  if (fieldDef.exportFormatter === "date") {
    return toDateOnly(value);
  }
  if (fieldDef.exportFormatter === "boolean_yes_no") {
    return formatBooleanYesNo(value);
  }

  if (fieldDef.kind === "date") {
    return toDateOnly(value);
  }
  if (fieldDef.kind === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return "";
  }
  if (fieldDef.kind === "boolean") {
    return formatBooleanYesNo(value);
  }
  if (fieldDef.kind === "array") {
    return Array.isArray(value) ? formatArrayCell(value) : "";
  }
  if (fieldDef.kind === "object") {
    return isRecord(value) ? formatObjectCell(value) : "";
  }

  return formatUnknownCell(value);
}

function resolveCategoryKeys(category: ExportCategorySelection): CategoryKey[] {
  if (category === "all") return [...CATEGORY_LIST];
  return [category];
}

function normalizeSelectedFieldKeys(fieldKeys: string[]) {
  return Array.from(
    new Set(
      (fieldKeys ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function resolveSchemaFieldDefs(categoryKeys: CategoryKey[]): ExportFieldDefinition[] {
  const defs = new Array<ExportFieldDefinition>();
  for (const categoryKey of categoryKeys) {
    const schema = getCategorySchema(categoryKey);
    schema.fields.forEach((field, index) => {
      if (field.exportable === false) return;
      defs.push({
        key: field.key,
        label: field.label,
        kind: field.kind,
        exportOrder: field.exportOrder ?? 1000 + index,
        exportFormatter: field.exportFormatter ?? "auto",
      });
    });
  }
  return defs;
}

function resolveExportFieldDefinitions(categoryKeys: CategoryKey[]): ExportFieldDefinition[] {
  const byKey = new Map<string, ExportFieldDefinition>();
  const candidates = [...BASE_EXPORT_FIELD_DEFS, ...resolveSchemaFieldDefs(categoryKeys)];
  for (const def of candidates) {
    if (byKey.has(def.key)) {
      continue;
    }
    byKey.set(def.key, def);
  }

  return Array.from(byKey.values()).sort(
    (left, right) =>
      left.exportOrder - right.exportOrder || left.label.localeCompare(right.label)
  );
}

function resolveUsedFieldDefinitions(
  allFieldDefs: ExportFieldDefinition[],
  selectedFieldKeys: string[]
) {
  const byKey = new Map(allFieldDefs.map((fieldDef) => [fieldDef.key, fieldDef] as const));
  const selectedDefs = selectedFieldKeys
    .map((key) => byKey.get(key))
    .filter((fieldDef): fieldDef is ExportFieldDefinition => !!fieldDef);

  if (selectedDefs.length > 0) {
    return selectedDefs;
  }

  return allFieldDefs;
}

function isCanonicalExportStatus(value: string): value is EntryStatus {
  return isEntryStatus(value);
}

function resolveAllowedStatuses(statuses?: EntryStatus[]) {
  if (!statuses || statuses.length === 0) return null;

  const allowed = new Set<EntryStatus>();
  for (const status of statuses) {
    const normalized = String(status ?? "").trim().toUpperCase();
    if (isCanonicalExportStatus(normalized)) {
      allowed.add(normalized);
    }
  }
  return allowed.size > 0 ? allowed : null;
}

function resolveFilterBounds(options: BuildExportOptions) {
  const fromMs = options.fromISO ? Date.parse(options.fromISO) : Number.NaN;
  const toMs = options.toISO ? Date.parse(options.toISO) : Number.NaN;
  return {
    fromMs,
    toMs,
  };
}

function resolveTimestampMs(entry: Record<string, unknown>) {
  const updatedAtMs = parseDateMs(entry.updatedAt);
  if (!Number.isNaN(updatedAtMs)) return updatedAtMs;
  const createdAtMs = parseDateMs(entry.createdAt);
  return createdAtMs;
}

function isWithinDateBounds(timestampMs: number, fromMs: number, toMs: number) {
  if (!Number.isNaN(fromMs) && (Number.isNaN(timestampMs) || timestampMs < fromMs)) {
    return false;
  }
  if (!Number.isNaN(toMs) && (Number.isNaN(timestampMs) || timestampMs > toMs)) {
    return false;
  }
  return true;
}

function createEmptyStatusCounts(): Record<EntryStatus, number> {
  const counts = {} as Record<EntryStatus, number>;
  for (const status of EXPORT_CANONICAL_STATUSES) {
    counts[status] = 0;
  }
  return counts;
}

async function collectFilteredEntries(
  normalizedEmail: string,
  categoryKeys: CategoryKey[],
  options: BuildExportOptions
) {
  const allowedStatuses = resolveAllowedStatuses(options.statuses);
  const { fromMs, toMs } = resolveFilterBounds(options);
  const maxRows = Number.isFinite(options.maxRows)
    ? Math.max(1, Math.min(EXPORT_MAX_ROWS_DEFAULT, Number(options.maxRows)))
    : EXPORT_MAX_ROWS_DEFAULT;

  const rows = new Array<CollectedExportEntry>();
  const countsByStatus = createEmptyStatusCounts();
  const store = new DataStore();

  for (const categoryKey of categoryKeys) {
    const categoryConfig = getCategoryConfig(categoryKey);
    const schema = getCategorySchema(categoryKey);
    const list = await store.readCategory(normalizedEmail, categoryKey);

    for (const rawEntry of list) {
      const entry = normalizeEntry(rawEntry, schema) as Record<string, unknown>;
      const workflowStatus = normalizeEntryStatus(entry);
      if (allowedStatuses && !allowedStatuses.has(workflowStatus)) {
        continue;
      }

      const timestampMs = resolveTimestampMs(entry);
      if (!isWithinDateBounds(timestampMs, fromMs, toMs)) {
        continue;
      }

      countsByStatus[workflowStatus] += 1;
      rows.push({
        categoryKey,
        categoryLabel: categoryConfig.label,
        workflowStatus,
        entry,
      });

      if (rows.length > maxRows) {
        throw new AppError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Export exceeds ${maxRows} rows. Narrow filters and retry.`,
        });
      }
    }
  }

  return {
    rows,
    countsByStatus,
  };
}

export function getExportableFields(category: ExportCategorySelection): ExportFieldOption[] {
  const categoryKeys = resolveCategoryKeys(category);
  const fieldDefs = resolveExportFieldDefinitions(categoryKeys);

  return fieldDefs.map((fieldDef) => ({
    key: fieldDef.key,
    label: fieldDef.label,
    kind: fieldDef.kind,
  }));
}

export function getExportCategoryOptions(): ExportCategoryOption[] {
  return [
    { key: "all", label: "All Categories" },
    ...CATEGORY_LIST.map((categoryKey) => ({
      key: categoryKey,
      label: getCategoryConfig(categoryKey).label,
    })),
  ];
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
    const selectedFieldKeys = normalizeSelectedFieldKeys(fieldKeys);

    if (selectedFieldKeys.length > EXPORT_MAX_FIELDS_DEFAULT) {
      throw new AppError({
        code: "PAYLOAD_TOO_LARGE",
        message: `Too many selected fields. Maximum ${EXPORT_MAX_FIELDS_DEFAULT} fields are allowed.`,
      });
    }

    // Exports are schema-driven and canonical-data-driven.
    // Do not duplicate field labels/column lists in page components.
    const allFieldDefs = resolveExportFieldDefinitions(categoryKeys);
    const usedFieldDefs = resolveUsedFieldDefinitions(allFieldDefs, selectedFieldKeys);
    const usedFieldKeys = usedFieldDefs.map((fieldDef) => fieldDef.key);
    const headers = usedFieldDefs.map((fieldDef) => fieldDef.label);

    const collected = await collectFilteredEntries(normalizedEmail, categoryKeys, options);
    const rows = collected.rows.map((item) =>
      usedFieldDefs.map((fieldDef) => {
        if (fieldDef.key === "category") return item.categoryLabel;
        if (fieldDef.key === "confirmationStatus") return item.workflowStatus;
        const value = getValueAtPath(item.entry, fieldDef.key);
        return formatExportValue(fieldDef, value);
      })
    );

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
      countsByStatus: collected.countsByStatus,
    });
  } catch (error) {
    return err(normalizeError(error));
  }
}

export function parseExportCategory(value: string): ExportCategorySelection | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "all") return "all";
  return isCategoryKey(normalized) ? normalized : null;
}

export function getExportStatusOptions(): ExportStatusOption[] {
  return EXPORT_STATUS_OPTIONS.map((option) => ({ ...option }));
}

export function parseExportStatuses(value: string): EntryStatus[] {
  const parsed = value
    .split(",")
    .map((status) => status.trim().toUpperCase())
    .filter(Boolean);

  const statuses = new Set<EntryStatus>();
  for (const candidate of parsed) {
    if (isCanonicalExportStatus(candidate)) {
      statuses.add(candidate);
    }
  }
  return Array.from(statuses);
}

export const CSV_BOM = "\uFEFF";

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
