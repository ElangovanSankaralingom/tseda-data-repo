/**
 * SQLite implementation of DataLayer (stub).
 *
 * Uses better-sqlite3 for synchronous, ACID-compliant storage.
 * This is a placeholder — all methods throw "not implemented" errors.
 *
 * TO ACTIVATE:
 * 1. npm install better-sqlite3 @types/better-sqlite3
 * 2. Set environment variable: DATA_LAYER=sqlite
 * 3. Run migration: node --experimental-strip-types scripts/migrate-to-sqlite.ts
 * 4. Implement all methods below
 *
 * See DATABASE-MIGRATION.md for the full migration guide.
 */

import type { CategoryKey } from "@/lib/entries/types";
import type { UserIndex } from "@/lib/data/indexStoreInternal";
import type { DataLayer, DataLayerEntry, UpsertOptions } from "@/lib/data/dataLayer";

function notImplemented(method: string): never {
  throw new Error(`SqliteDataLayer.${method}() is not implemented. See DATABASE-MIGRATION.md for setup instructions.`);
}

export class SqliteDataLayer implements DataLayer {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listEntries(_email: string, _category: CategoryKey): Promise<DataLayerEntry[]> {
    notImplemented("listEntries");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getEntry(_email: string, _category: CategoryKey, _id: string): Promise<DataLayerEntry | null> {
    notImplemented("getEntry");
  }

  async saveEntry(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _email: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _category: CategoryKey,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _entry: DataLayerEntry,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: UpsertOptions,
  ): Promise<DataLayerEntry> {
    notImplemented("saveEntry");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async replaceEntries(_email: string, _category: CategoryKey, _entries: DataLayerEntry[]): Promise<void> {
    notImplemented("replaceEntries");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteEntry(_email: string, _category: CategoryKey, _id: string): Promise<DataLayerEntry | null> {
    notImplemented("deleteEntry");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUserIndex(_email: string): Promise<UserIndex | null> {
    notImplemented("getUserIndex");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async saveUserIndex(_email: string, _index: UserIndex): Promise<void> {
    notImplemented("saveUserIndex");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async withLock<T>(_key: string, _fn: () => Promise<T>): Promise<T> {
    notImplemented("withLock");
  }
}
