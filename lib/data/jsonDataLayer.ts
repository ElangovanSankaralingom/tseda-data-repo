import "server-only";

/**
 * JSON file-backed implementation of the DataLayer interface.
 *
 * Delegates to the existing dataStore.ts, indexStoreInternal.ts, and locks.ts
 * modules which handle all file I/O, locking, normalization, and migration.
 *
 * This class is a thin adapter — it does not add business logic.
 */

import fs from "node:fs/promises";
import {
  readCategoryEntries,
  writeCategoryEntries,
  readCategoryEntryById,
  upsertCategoryEntry,
  deleteCategoryEntry,
} from "@/lib/dataStore";
import { withLock } from "@/lib/data/locks";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getUsersRootDir } from "@/lib/userStore";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import {
  readIndexRaw,
  writeIndexFile,
  hydrateIndex,
} from "@/lib/data/indexStoreInternal";
import type { UserIndex } from "@/lib/data/indexStoreInternal";
import type { CategoryKey } from "@/lib/entries/types";
import type { DataLayer, DataLayerEntry, UpsertOptions } from "@/lib/data/dataLayer";

export class JsonDataLayer implements DataLayer {
  async listEntries(email: string, category: CategoryKey): Promise<DataLayerEntry[]> {
    return readCategoryEntries(email, category);
  }

  async getEntry(email: string, category: CategoryKey, id: string): Promise<DataLayerEntry | null> {
    return readCategoryEntryById(email, category, id);
  }

  async saveEntry(
    email: string,
    category: CategoryKey,
    entry: DataLayerEntry,
    options?: UpsertOptions,
  ): Promise<DataLayerEntry> {
    return upsertCategoryEntry(email, category, entry, options);
  }

  async replaceEntries(email: string, category: CategoryKey, entries: DataLayerEntry[]): Promise<void> {
    await writeCategoryEntries(email, category, entries);
  }

  async deleteEntry(email: string, category: CategoryKey, id: string): Promise<DataLayerEntry | null> {
    return deleteCategoryEntry(email, category, id);
  }

  async listUsers(): Promise<string[]> {
    const usersRoot = getUsersRootDir();
    try {
      const entries = await fs.readdir(usersRoot, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => normalizeEmail(entry.name))
        .filter((email) => email.endsWith(ALLOWED_EMAIL_SUFFIX))
        .sort((left, right) => left.localeCompare(right));
    } catch {
      return [];
    }
  }

  async getUserIndex(email: string): Promise<UserIndex | null> {
    const raw = await readIndexRaw(email);
    if (!raw) return null;
    const { index, rebuildRequired } = hydrateIndex(raw, email);
    return rebuildRequired ? null : index;
  }

  async saveUserIndex(email: string, index: UserIndex): Promise<void> {
    await writeIndexFile(email, index);
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return withLock(key, fn);
  }
}
