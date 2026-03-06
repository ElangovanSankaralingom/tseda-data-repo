import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import type {
  SchemaFieldDefinition,
  SchemaValidationError,
  SchemaValidationMode,
} from "@/data/schemas/types";
import type { CategoryKey } from "@/lib/entries/types";
import { AppError } from "@/lib/errors";
import { normalizePayload } from "@/lib/normalize";
import { SECURITY_LIMITS } from "@/lib/security/limits";
import { err, ok, type Result } from "@/lib/result";

export type ValidateEntryMode =
  | "create"
  | "update"
  | "commit"
  | "sendForConfirmation";

export type SanitizedPayload = Record<string, unknown>;

const SYSTEM_ALLOWED_KEYS = new Set<string>([
  "id",
  "category",
  "ownerEmail",
  "status",
  "confirmationStatus",
  "createdAt",
  "updatedAt",
  "attachments",
  "data",
  "schemaVersion",
  "v",
  "pdfMeta",
  "pdf",
  "pdfGeneratedAt",
  "pdfSnapshotHash",
  "pdfSourceHash",
  "pdfStale",
  "completionState",
  "streakState",
  "streakActivatedAt",
  "streakCompletedAt",
  "streak",
  "generatedAt",
  "doneAt",
  "stage",
  "uploadsUnlocked",
  "requestEditStatus",
  "requestEditRequestedAtISO",
  "requestEditMessage",
  "editCutoffAt",
  "sentForConfirmationAtISO",
  "confirmedAtISO",
  "confirmedBy",
  "confirmationRejectedReason",
  "committedAtISO",
  "sharedEntryId",
  "sourceEmail",
  "sharedRole",
]);

function toSchemaMode(mode: ValidateEntryMode): SchemaValidationMode {
  return mode === "create" ? "create" : "update";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getValueAtPath(record: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return undefined;

  let current: unknown = record;
  for (const part of parts) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function setValueAtPath(record: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return;

  let current = record;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const next = current[key];
    if (!isPlainObject(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

function toIsoDateOnly(value: string): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function coerceNumber(value: unknown): unknown {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : value;
  }
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return null;
  const next = Number(trimmed);
  return Number.isFinite(next) ? next : value;
}

function coerceBoolean(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
}

function coerceDate(value: unknown): unknown {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return value;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return toIsoDateOnly(trimmed) ?? value;
}

function coerceByFieldKind(
  value: unknown,
  field: SchemaFieldDefinition
): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (field.kind === "number") {
    return coerceNumber(value);
  }
  if (field.kind === "boolean") {
    return coerceBoolean(value);
  }
  if (field.kind === "date") {
    return coerceDate(value);
  }

  return value;
}

function sanitizeBySchema(
  payload: Record<string, unknown>,
  fields: readonly SchemaFieldDefinition[]
) {
  const sanitized: Record<string, unknown> = {};

  for (const field of fields) {
    const rawValue = getValueAtPath(payload, field.key);
    if (rawValue === undefined) continue;
    const coerced = coerceByFieldKind(rawValue, field);
    if (coerced === undefined) continue;
    setValueAtPath(sanitized, field.key, coerced);
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!SYSTEM_ALLOWED_KEYS.has(key)) continue;
    sanitized[key] = value;
  }

  return sanitized;
}

function toFieldErrorMap(errors: SchemaValidationError[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const error of errors) {
    if (map[error.field]) continue;
    map[error.field] = error.message;
  }
  return map;
}

function hasCommittedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) {
    if (typeof value.storedPath === "string" && value.storedPath.trim()) return true;
    if (typeof value.url === "string" && value.url.trim()) return true;
    return Object.keys(value).length > 0;
  }
  return false;
}

function getRequiredFieldsForMode(mode: ValidateEntryMode, schema: (typeof ENTRY_SCHEMAS)[CategoryKey]) {
  if (mode !== "commit" && mode !== "sendForConfirmation") {
    return [] as string[];
  }
  if (Array.isArray(schema.requiredForCommit) && schema.requiredForCommit.length > 0) {
    return [...schema.requiredForCommit];
  }
  return schema.fields.filter((field) => field.required).map((field) => field.key);
}

function assertModeRequiredFields(
  mode: ValidateEntryMode,
  schema: (typeof ENTRY_SCHEMAS)[CategoryKey],
  payload: Record<string, unknown>
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  const requiredFields = getRequiredFieldsForMode(mode, schema);
  for (const fieldKey of requiredFields) {
    const value = getValueAtPath(payload, fieldKey);
    if (hasCommittedValue(value)) continue;
    errors.push({
      field: fieldKey,
      message: `${fieldKey} is required.`,
    });
  }

  if (
    (mode === "commit" || mode === "sendForConfirmation") &&
    typeof schema.minAttachmentsForCommit === "number" &&
    Number.isFinite(schema.minAttachmentsForCommit) &&
    schema.minAttachmentsForCommit > 0
  ) {
    const attachmentsRaw = payload.attachments;
    const attachmentsCount = Array.isArray(attachmentsRaw) ? attachmentsRaw.length : 0;
    if (attachmentsCount < schema.minAttachmentsForCommit) {
      errors.push({
        field: "attachments",
        message: `At least ${schema.minAttachmentsForCommit} attachment(s) are required.`,
      });
    }
  }

  return errors;
}

function assertStringLengthLimits(
  payload: Record<string, unknown>,
  fields: readonly SchemaFieldDefinition[]
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  for (const field of fields) {
    const value = getValueAtPath(payload, field.key);
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string") continue;
    const maxLength = field.maxLength ?? SECURITY_LIMITS.entryMaxStringLength;
    if (value.length <= maxLength) continue;
    errors.push({
      field: field.key,
      message: `${field.label} must be at most ${maxLength} characters.`,
    });
  }
  return errors;
}

export function validateAndSanitize(
  category: CategoryKey,
  payload: Record<string, unknown>,
  mode: ValidateEntryMode
): Result<SanitizedPayload> {
  const schema = ENTRY_SCHEMAS[category];
  const normalized = normalizePayload(payload, schema);
  const sanitized = sanitizeBySchema(normalized, schema.fields);
  const schemaErrors = schema.validate(sanitized, toSchemaMode(mode));
  const modeRequiredErrors = assertModeRequiredFields(mode, schema, sanitized);
  const maxLengthErrors = assertStringLengthLimits(sanitized, schema.fields);
  const allErrors = [...schemaErrors, ...modeRequiredErrors, ...maxLengthErrors];

  if (!allErrors.length) {
    return ok(sanitized);
  }

  const fieldErrors = toFieldErrorMap(allErrors);
  return err(
    new AppError({
      code: "VALIDATION_ERROR",
      message: Object.values(fieldErrors).join("; "),
      details: {
        fieldErrors,
      },
    })
  );
}

export function validateAndSanitizeOrThrow(
  category: CategoryKey,
  payload: Record<string, unknown>,
  mode: ValidateEntryMode
): SanitizedPayload {
  const result = validateAndSanitize(category, payload, mode);
  if (result.ok) return result.data;
  throw result.error;
}
