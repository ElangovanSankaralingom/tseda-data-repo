import "server-only";
import { normalizeError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";
import type { Entry } from "@/lib/types/entry";
import {
  CATEGORY_STORE_SCHEMA_VERSION,
  isRecord,
  toVersion,
  toTrimmedString,
} from "./migrationHelpers";
import { migrateEntry } from "./entryMigrations";

export type CategoryStoreV2 = {
  version: number;
  byId: Record<string, Entry>;
  order: string[];
};

function buildCategoryStoreFromEntries(rawEntries: unknown[]): CategoryStoreV2 {
  const byId: Record<string, Entry> = {};
  const order: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < rawEntries.length; index += 1) {
    const rawEntry = rawEntries[index];
    const migratedEntry = migrateEntry(rawEntry);
    if (!migratedEntry.ok) continue;

    const entryId = toTrimmedString(migratedEntry.data.id) || `legacy-${index + 1}`;
    const nextEntry = { ...migratedEntry.data, id: entryId };
    byId[entryId] = nextEntry;
    if (!seen.has(entryId)) {
      order.push(entryId);
      seen.add(entryId);
    }
  }

  return {
    version: CATEGORY_STORE_SCHEMA_VERSION,
    byId,
    order,
  };
}

function buildCategoryStoreFromById(
  rawById: Record<string, unknown>,
  rawOrder: unknown
): CategoryStoreV2 {
  const byId: Record<string, Entry> = {};
  const order: string[] = [];
  const seen = new Set<string>();

  const orderedIds = Array.isArray(rawOrder)
    ? rawOrder.map((value) => toTrimmedString(value)).filter(Boolean)
    : [];

  for (const candidateId of orderedIds) {
    if (!candidateId || seen.has(candidateId)) continue;
    const rawEntry = rawById[candidateId];
    if (rawEntry === undefined) continue;

    const migratedEntry = migrateEntry(rawEntry);
    if (!migratedEntry.ok) continue;

    const entryId = toTrimmedString(migratedEntry.data.id) || candidateId;
    const nextEntry = { ...migratedEntry.data, id: entryId };
    byId[entryId] = nextEntry;
    if (!seen.has(entryId)) {
      order.push(entryId);
      seen.add(entryId);
    }
  }

  for (const [candidateId, rawEntry] of Object.entries(rawById)) {
    const fallbackId = toTrimmedString(candidateId);
    if (!fallbackId) continue;

    const migratedEntry = migrateEntry(rawEntry);
    if (!migratedEntry.ok) continue;

    const entryId = toTrimmedString(migratedEntry.data.id) || fallbackId;
    const nextEntry = { ...migratedEntry.data, id: entryId };
    byId[entryId] = nextEntry;
    if (!seen.has(entryId)) {
      order.push(entryId);
      seen.add(entryId);
    }
  }

  return {
    version: CATEGORY_STORE_SCHEMA_VERSION,
    byId,
    order,
  };
}

export function migrateCategoryStore(raw: unknown): Result<CategoryStoreV2> {
  try {
    if (Array.isArray(raw)) {
      return ok(buildCategoryStoreFromEntries(raw));
    }

    if (!isRecord(raw)) {
      return ok(buildCategoryStoreFromEntries([]));
    }

    const byIdRaw = isRecord(raw.byId) ? raw.byId : null;
    if (toVersion(raw.version, 0) === CATEGORY_STORE_SCHEMA_VERSION && byIdRaw) {
      return ok(buildCategoryStoreFromById(byIdRaw, raw.order));
    }

    if (Array.isArray(raw.entries)) {
      return ok(buildCategoryStoreFromEntries(raw.entries));
    }

    return ok(buildCategoryStoreFromEntries([]));
  } catch (error) {
    return err(normalizeError(error));
  }
}
