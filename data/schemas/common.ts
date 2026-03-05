import type {
  SchemaFieldDefinition,
  SchemaValidationError,
  SchemaValidationMode,
} from "@/data/schemas/types";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPlainObject(value: unknown) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMissing(value: unknown) {
  return value === null || value === undefined || value === "";
}

function validateFieldKind(
  field: SchemaFieldDefinition,
  value: unknown
): string | null {
  if (isMissing(value)) {
    return null;
  }

  if (field.kind === "unknown") {
    return null;
  }

  if (field.kind === "string" && typeof value !== "string") {
    return `${field.label} must be a string`;
  }

  if (field.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `${field.label} must be a number`;
    }
  }

  if (field.kind === "boolean" && typeof value !== "boolean") {
    return `${field.label} must be a boolean`;
  }

  if (field.kind === "array" && !Array.isArray(value)) {
    return `${field.label} must be an array`;
  }

  if (field.kind === "object" && !isPlainObject(value)) {
    return `${field.label} must be an object`;
  }

  if (field.kind === "date") {
    if (typeof value !== "string" || !isIsoDate(value.trim())) {
      return `${field.label} must be a YYYY-MM-DD date`;
    }
  }

  return null;
}

export function validateByFieldDefinitions(
  payload: Record<string, unknown>,
  mode: SchemaValidationMode,
  fields: readonly SchemaFieldDefinition[]
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];

  for (const field of fields) {
    const hasKey = Object.prototype.hasOwnProperty.call(payload, field.key);
    const value = payload[field.key];

    if (field.required && mode === "create" && hasKey && isMissing(value)) {
      errors.push({
        field: field.key,
        message: `${field.label} is required`,
      });
      continue;
    }

    if (!hasKey) {
      continue;
    }

    const kindError = validateFieldKind(field, value);
    if (kindError) {
      errors.push({
        field: field.key,
        message: kindError,
      });
    }
  }

  return errors;
}
