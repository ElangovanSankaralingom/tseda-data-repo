import { getCategoryConfig, getCategorySchema } from "@/data/categoryRegistry";
import { normalizeEntryStatus } from "@/lib/entryStateMachine";
import type { CategoryKey } from "@/lib/entries/types";
import { getEntryTitle } from "@/lib/search/getEntryTitle";
import type { Entry, EntryStatus } from "@/lib/types/entry";

export type SearchSnapshot = {
  entryId: string;
  categoryKey: CategoryKey;
  title: string;
  text: string;
  status: EntryStatus;
  updatedAtISO: string | null;
  createdAtISO: string | null;
};

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function asSearchText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) {
    return value.map((item) => asSearchText(item)).filter(Boolean).join(" ");
  }
  if (isRecord(value)) {
    const parts = Object.values(value).map((item) => asSearchText(item)).filter(Boolean);
    return parts.join(" ");
  }
  return "";
}

function toOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

export function buildSearchText(entry: Entry | Record<string, unknown>, category: CategoryKey): string {
  const record = entry as Record<string, unknown>;
  const schema = getCategorySchema(category);
  const categoryLabel = getCategoryConfig(category).label;
  const status = normalizeEntryStatus(record);
  const title = getEntryTitle(record, category);

  const parts = new Array<string>();
  parts.push(title);
  parts.push(categoryLabel);
  parts.push(status);

  for (const field of schema.fields) {
    if (field.key === "id") continue;
    if (field.kind !== "string") continue;
    const value = asSearchText(getValueAtPath(record, field.key));
    if (!value) continue;
    parts.push(value);
  }

  return normalizeSearchText(parts.join(" "));
}

export function getSearchSnapshotKey(category: CategoryKey, entryId: string): string {
  return `${category}:${entryId.trim()}`;
}

export function buildSearchSnapshot(
  entry: Entry | Record<string, unknown>,
  category: CategoryKey
): SearchSnapshot | null {
  const record = entry as Record<string, unknown>;
  const entryId = String(record.id ?? "").trim();
  if (!entryId) return null;

  return {
    entryId,
    categoryKey: category,
    title: getEntryTitle(record, category),
    text: buildSearchText(record, category),
    status: normalizeEntryStatus(record),
    updatedAtISO: toOptionalISO(record.updatedAt),
    createdAtISO: toOptionalISO(record.createdAt),
  };
}
