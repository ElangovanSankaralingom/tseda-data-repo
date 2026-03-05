import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { getCategorySchema } from "@/data/categoryRegistry";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import {
  normalizeEntryStatus,
  type EntryStateLike,
} from "@/lib/entryStateMachine";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  CATEGORY_STORE_SCHEMA_VERSION,
  ENTRY_SCHEMA_VERSION,
  migrateCategoryStore,
  type CategoryStoreV2,
  migrateEntry,
} from "@/lib/migrations";
import { logger } from "@/lib/logger";
import { normalizeEntry } from "@/lib/normalize";
import type { Entry } from "@/lib/types/entry";
import { getDataRoot, getUserCategoryStoreFile } from "@/lib/userStore";

export type EntryEngineRecord = Entry;

export type DataStoreEntry = EntryEngineRecord & {
  attachments?: unknown;
  status?: unknown;
  confirmationStatus?: unknown;
  schemaVersion?: unknown;
};

type StoreLookupOptions = {
  persistMigration?: boolean;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCategoryStoreV2(value: unknown): value is CategoryStoreV2 {
  if (!isPlainRecord(value)) return false;
  if (Number(value.version) !== CATEGORY_STORE_SCHEMA_VERSION) return false;
  if (!isPlainRecord(value.byId)) return false;
  if (!Array.isArray(value.order)) return false;
  return true;
}

function normalizeEntryId(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeDataStoreEntry(
  entry: unknown,
  category?: CategoryKey
): EntryEngineRecord | null {
  const migrated = migrateEntry(entry);
  if (!migrated.ok) return null;
  if (!isPlainRecord(migrated.data)) return null;

  const next = normalizeEntry(
    { ...migrated.data } as Entry,
    category ? getCategorySchema(category) : undefined
  ) as DataStoreEntry;
  next.confirmationStatus = normalizeEntryStatus(next as EntryStateLike);

  if (typeof next.status !== "string" || !next.status.trim()) {
    next.status = "draft";
  }

  if (!Array.isArray(next.attachments)) {
    next.attachments = [];
  }
  next.schemaVersion = ENTRY_SCHEMA_VERSION;

  return next as EntryEngineRecord;
}

export class DataStore {
  private readonly dataRoot: string;

  constructor(options?: { dataRoot?: string }) {
    this.dataRoot = options?.dataRoot?.trim() || getDataRoot();
  }

  categoryFilePath(email: string, category: CategoryKey) {
    return getUserCategoryStoreFile(
      normalizeEmail(email),
      CATEGORY_STORE_FILES[category],
      this.dataRoot
    );
  }

  private createEmptyCategoryStore(): CategoryStoreV2 {
    return {
      version: CATEGORY_STORE_SCHEMA_VERSION,
      byId: {},
      order: [],
    };
  }

  private async writeCategoryStore(
    filePath: string,
    store: CategoryStoreV2,
    meta?: { userEmail: string; category: CategoryKey; source: string }
  ) {
    const payload = JSON.stringify(store, null, 2);
    await fs.writeFile(filePath, payload, "utf8");
    if (meta) {
      logger.info({
        event: "datastore.category.write",
        userEmail: meta.userEmail,
        category: meta.category,
        count: store.order.length,
        sizeBytes: Buffer.byteLength(payload),
        source: meta.source,
      });
    }
  }

  private toStoreFromEntries(entries: EntryEngineRecord[], category: CategoryKey): CategoryStoreV2 {
    const byId: CategoryStoreV2["byId"] = {};
    const order: string[] = [];

    for (const value of entries) {
      const normalized = normalizeDataStoreEntry(value, category);
      if (!normalized) continue;

      const id = normalizeEntryId(normalized.id);
      if (!id) continue;

      const entry = { ...normalized, id } as EntryEngineRecord;
      byId[id] = entry;
      if (!order.includes(id)) {
        order.push(id);
      }
    }

    return {
      version: CATEGORY_STORE_SCHEMA_VERSION,
      byId,
      order,
    };
  }

  private toEntries(store: CategoryStoreV2, category: CategoryKey): EntryEngineRecord[] {
    const entries = new Array<EntryEngineRecord>();
    for (const id of store.order) {
      const key = normalizeEntryId(id);
      if (!key) continue;
      const value = store.byId[key];
      if (!value) continue;

      const normalized = normalizeDataStoreEntry(value, category);
      if (!normalized) continue;

      entries.push(normalized);
    }
    return entries;
  }

  private async readCategoryStore(
    email: string,
    category: CategoryKey,
    options?: StoreLookupOptions
  ): Promise<{ filePath: string; store: CategoryStoreV2 }> {
    const filePath = this.categoryFilePath(email, category);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let parsed: unknown = null;
    let shouldWrite = false;
    let fileExists = true;

    try {
      const raw = await fs.readFile(filePath, "utf8");
      parsed = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      fileExists = false;
      parsed = null;
    }

    if (!fileExists || parsed === null) {
      shouldWrite = true;
      parsed = [];
    }

    const migrated = migrateCategoryStore(parsed);
    const store = migrated.ok ? migrated.data : this.createEmptyCategoryStore();
    if (!isCategoryStoreV2(parsed)) {
      shouldWrite = true;
    }

    if ((options?.persistMigration ?? true) && shouldWrite) {
      await this.writeCategoryStore(filePath, store, {
        userEmail: normalizeEmail(email),
        category,
        source: "readCategoryStore.migration",
      });
    }

    return { filePath, store };
  }

  async readCategory(
    email: string,
    category: CategoryKey
  ): Promise<EntryEngineRecord[]> {
    const { store } = await this.readCategoryStore(email, category, {
      persistMigration: true,
    });
    const entries = this.toEntries(store, category);
    logger.debug({
      event: "datastore.category.read",
      userEmail: normalizeEmail(email),
      category,
      count: entries.length,
    });
    return entries;
  }

  async writeCategory(
    email: string,
    category: CategoryKey,
    entries: EntryEngineRecord[]
  ) {
    const filePath = this.categoryFilePath(email, category);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const store = this.toStoreFromEntries(entries, category);
    await this.writeCategoryStore(filePath, store, {
      userEmail: normalizeEmail(email),
      category,
      source: "writeCategory",
    });
  }

  async readEntryById(
    email: string,
    category: CategoryKey,
    entryId: string
  ): Promise<EntryEngineRecord | null> {
    const id = normalizeEntryId(entryId);
    if (!id) return null;

    const { store } = await this.readCategoryStore(email, category, {
      persistMigration: true,
    });
    const raw = store.byId[id];
    if (!raw) return null;
    const normalized = normalizeDataStoreEntry(raw, category);
    if (!normalized) return null;
    logger.debug({
      event: "datastore.entry.read",
      userEmail: normalizeEmail(email),
      category,
      entryId: id,
    });
    return normalized;
  }

  async upsertCategoryEntry(
    email: string,
    category: CategoryKey,
    entry: EntryEngineRecord,
    options?: { insertPosition?: "start" | "end" }
  ): Promise<EntryEngineRecord> {
    const normalized = normalizeDataStoreEntry(entry, category);
    if (!normalized) {
      throw new Error("Invalid entry payload");
    }

    const id = normalizeEntryId(normalized.id);
    if (!id) {
      throw new Error("Entry ID is required");
    }

    const { filePath, store } = await this.readCategoryStore(email, category, {
      persistMigration: true,
    });
    const exists = !!store.byId[id];

    store.byId[id] = { ...normalized, id } as EntryEngineRecord;
    if (!exists) {
      if (options?.insertPosition === "end") {
        store.order.push(id);
      } else {
        store.order.unshift(id);
      }
    }

    await this.writeCategoryStore(filePath, store, {
      userEmail: normalizeEmail(email),
      category,
      source: "upsertCategoryEntry",
    });
    logger.info({
      event: exists ? "datastore.entry.update" : "datastore.entry.create",
      userEmail: normalizeEmail(email),
      category,
      entryId: id,
      count: store.order.length,
    });
    return store.byId[id] as EntryEngineRecord;
  }

  async deleteCategoryEntry(
    email: string,
    category: CategoryKey,
    entryId: string
  ): Promise<EntryEngineRecord | null> {
    const id = normalizeEntryId(entryId);
    if (!id) return null;

    const { filePath, store } = await this.readCategoryStore(email, category, {
      persistMigration: true,
    });
    const existing = store.byId[id];
    if (!existing) return null;

    delete store.byId[id];
    store.order = store.order.filter((value) => normalizeEntryId(value) !== id);
    await this.writeCategoryStore(filePath, store, {
      userEmail: normalizeEmail(email),
      category,
      source: "deleteCategoryEntry",
    });
    logger.info({
      event: "datastore.entry.delete",
      userEmail: normalizeEmail(email),
      category,
      entryId: id,
      count: store.order.length,
    });

    const normalized = normalizeDataStoreEntry(existing, category);
    return normalized ?? null;
  }
}

export async function readCategoryEntries(
  email: string,
  category: CategoryKey
): Promise<EntryEngineRecord[]> {
  return new DataStore().readCategory(email, category);
}

export async function writeCategoryEntries(
  email: string,
  category: CategoryKey,
  entries: EntryEngineRecord[]
) {
  return new DataStore().writeCategory(email, category, entries);
}

export async function readCategoryEntryById(
  email: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return new DataStore().readEntryById(email, category, entryId);
}

export async function upsertCategoryEntry(
  email: string,
  category: CategoryKey,
  entry: EntryEngineRecord,
  options?: { insertPosition?: "start" | "end" }
): Promise<EntryEngineRecord> {
  return new DataStore().upsertCategoryEntry(email, category, entry, options);
}

export async function deleteCategoryEntry(
  email: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return new DataStore().deleteCategoryEntry(email, category, entryId);
}
