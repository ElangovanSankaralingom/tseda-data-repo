import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
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

export function normalizeDataStoreEntry(entry: unknown): EntryEngineRecord | null {
  const migrated = migrateEntry(entry);
  if (!migrated.ok) return null;
  if (!isPlainRecord(migrated.data)) return null;

  const next = { ...migrated.data } as DataStoreEntry;
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

  private async writeCategoryStore(filePath: string, store: CategoryStoreV2) {
    await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
  }

  private toStoreFromEntries(entries: EntryEngineRecord[]): CategoryStoreV2 {
    const byId: CategoryStoreV2["byId"] = {};
    const order: string[] = [];

    for (const value of entries) {
      const normalized = normalizeDataStoreEntry(value);
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

  private toEntries(store: CategoryStoreV2): EntryEngineRecord[] {
    const entries = new Array<EntryEngineRecord>();
    for (const id of store.order) {
      const key = normalizeEntryId(id);
      if (!key) continue;
      const value = store.byId[key];
      if (!value) continue;

      const normalized = normalizeDataStoreEntry(value);
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
      await this.writeCategoryStore(filePath, store);
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
    return this.toEntries(store);
  }

  async writeCategory(
    email: string,
    category: CategoryKey,
    entries: EntryEngineRecord[]
  ) {
    const filePath = this.categoryFilePath(email, category);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const store = this.toStoreFromEntries(entries);
    await this.writeCategoryStore(filePath, store);
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
    const normalized = normalizeDataStoreEntry(raw);
    if (!normalized) return null;
    return normalized;
  }

  async upsertCategoryEntry(
    email: string,
    category: CategoryKey,
    entry: EntryEngineRecord,
    options?: { insertPosition?: "start" | "end" }
  ): Promise<EntryEngineRecord> {
    const normalized = normalizeDataStoreEntry(entry);
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

    await this.writeCategoryStore(filePath, store);
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
    await this.writeCategoryStore(filePath, store);

    const normalized = normalizeDataStoreEntry(existing);
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
