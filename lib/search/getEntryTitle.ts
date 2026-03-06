import { getCategoryConfig, getCategorySchema } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";
import type { Entry } from "@/lib/types/entry";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getValueAtPath(record: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split(".").filter(Boolean);
  if (!parts.length) return undefined;

  let current: unknown = record;
  for (const part of parts) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function toTitleText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

export function getEntryTitle(entry: Entry | Record<string, unknown>, category: CategoryKey): string {
  const record = entry as Record<string, unknown>;
  const config = getCategoryConfig(category);
  const schema = getCategorySchema(category);

  if (config.entryTitleField) {
    const configuredValue = toTitleText(getValueAtPath(record, config.entryTitleField));
    if (configuredValue) return configuredValue;
  }

  for (const field of schema.fields) {
    if (field.key === "id") continue;
    if (field.kind !== "string") continue;
    const value = toTitleText(getValueAtPath(record, field.key));
    if (value) return value;
  }

  const fallbackId = toTitleText(record.id);
  if (fallbackId) return fallbackId;

  return config.entryTitleFallback ?? `${config.label} Entry`;
}
