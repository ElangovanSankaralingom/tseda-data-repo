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

function getValueAtPath(payload: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return undefined;
  let current: unknown = payload;
  for (const part of parts) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function hasPath(payload: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return false;
  let current: unknown = payload;
  for (const part of parts) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return true;
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

  if (field.kind === "string" && typeof value === "string" && typeof field.maxLength === "number") {
    if (value.length > field.maxLength) {
      return `${field.label} must be at most ${field.maxLength} characters`;
    }
  }

  if (field.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `${field.label} must be a number`;
    }
    if (typeof field.min === "number" && value < field.min) {
      return `${field.label} must be at least ${field.min}`;
    }
    if (typeof field.max === "number" && value > field.max) {
      return `${field.label} must be at most ${field.max}`;
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

  if (Array.isArray(field.enumValues) && field.enumValues.length > 0) {
    if (!field.enumValues.includes(value as string | number | boolean)) {
      return `${field.label} has an invalid value`;
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
    const hasKey = hasPath(payload, field.key);
    const value = getValueAtPath(payload, field.key);

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
