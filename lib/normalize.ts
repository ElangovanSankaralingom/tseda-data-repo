import type { EntrySchema } from "@/data/schemas/types";
import type { Entry } from "@/lib/types/entry";

export type NormalizedPayload = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toIsoTimestamp(value: string): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function toIsoDateOnly(value: string): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function isTimestampKey(key: string): boolean {
  return /At(ISO)?$/.test(key) || key === "ts" || key === "timestamp";
}

function isDateOnlyKey(key: string): boolean {
  return key === "date" || key === "startDate" || key === "endDate" || key.endsWith("Date");
}

function getSchemaDateFieldKeys(schema?: EntrySchema): Set<string> {
  if (!schema) return new Set<string>();
  return new Set(
    schema.fields
      .filter((field) => field.kind === "date")
      .map((field) => field.key.split(".").at(-1) ?? field.key)
  );
}

function normalizeValue(
  value: unknown,
  key: string | null,
  schemaDateKeys: Set<string>
): unknown {
  const keyName = key ?? "";

  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    if (schemaDateKeys.has(keyName) || isDateOnlyKey(keyName)) {
      return value.toISOString().slice(0, 10);
    }
    return value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const shouldUseDateOnly = schemaDateKeys.has(keyName) || isDateOnlyKey(keyName);
    if (shouldUseDateOnly) {
      return toIsoDateOnly(trimmed) ?? trimmed;
    }

    if (isTimestampKey(keyName)) {
      return toIsoTimestamp(trimmed) ?? trimmed;
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeValue(item, key, schemaDateKeys))
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const normalizedChild = normalizeValue(childValue, childKey, schemaDateKeys);
      if (normalizedChild !== undefined) {
        next[childKey] = normalizedChild;
      }
    }
    return next;
  }

  return value;
}

function normalizeRecordWithSchema(
  record: Record<string, unknown>,
  schema?: EntrySchema
): Record<string, unknown> {
  const schemaDateKeys = getSchemaDateFieldKeys(schema);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const normalizedValue = normalizeValue(value, key, schemaDateKeys);
    if (normalizedValue !== undefined) {
      next[key] = normalizedValue;
    }
  }
  return next;
}

function normalizeTimestamps(entry: Entry) {
  const next = { ...entry };
  const nowISO = new Date().toISOString();

  const createdAt =
    typeof next.createdAt === "string" ? toIsoTimestamp(next.createdAt) : null;
  const updatedAt =
    typeof next.updatedAt === "string" ? toIsoTimestamp(next.updatedAt) : null;

  next.createdAt = createdAt ?? nowISO;
  next.updatedAt = updatedAt ?? next.createdAt;
  return next;
}

export function normalizePayload(
  payload: Record<string, unknown>,
  schema: EntrySchema
): NormalizedPayload {
  const normalized = normalizeRecordWithSchema(payload, schema);

  if (Object.prototype.hasOwnProperty.call(normalized, "attachments")) {
    if (!Array.isArray(normalized.attachments)) {
      normalized.attachments = [];
    }
  }

  return normalized;
}

export function normalizeEntry(
  entry: Entry | Record<string, unknown>,
  schema?: EntrySchema
): Entry {
  const normalized = normalizeRecordWithSchema(entry as Record<string, unknown>, schema) as Entry;
  const withTimestamps = normalizeTimestamps(normalized);
  if (!Array.isArray(withTimestamps.attachments)) {
    withTimestamps.attachments = [];
  }
  return withTimestamps;
}
