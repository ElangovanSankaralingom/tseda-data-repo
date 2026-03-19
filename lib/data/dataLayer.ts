/**
 * DataLayer — Abstract data access interface.
 *
 * Current implementation: JsonDataLayer (file-based JSON storage)
 * Future implementation: SqliteDataLayer (stub exists at lib/data/sqliteDataLayer.ts)
 *
 * To migrate to SQLite:
 * 1. Install: npm install better-sqlite3 @types/better-sqlite3
 * 2. Implement all methods in lib/data/sqliteDataLayer.ts
 * 3. Set DATA_LAYER=sqlite in .env.local
 * 4. Run migration script to import JSON data into SQLite
 * 5. No other code changes needed — all access goes through this interface.
 *
 * Factory: lib/data/createDataLayer.ts (singleton, env-var driven)
 *
 * Benefits of SQLite:
 * - Process-safe locking (no in-memory lock chains)
 * - Built-in pagination (LIMIT/OFFSET)
 * - Concurrent read access
 * - Atomic transactions
 *
 * All implementations must guarantee:
 * - Atomic writes (no partial state on crash)
 * - User-level concurrency safety (locking)
 * - Entry normalization on read
 */

import type { CategoryKey } from "@/lib/entries/types";
import type { Entry } from "@/lib/types/entry";
import type { UserIndex } from "@/lib/data/indexStoreInternal";

/** Record type used by the data layer for entry storage. */
export type DataLayerEntry = Entry;

/** Options for entry insertion. */
export type UpsertOptions = {
  /** Where to insert new entries in the ordered list. */
  insertPosition?: "start" | "end";
};

/**
 * Abstract data access interface.
 *
 * Each method is user-scoped (by email) and category-scoped where applicable.
 * Implementations handle their own locking and atomicity guarantees.
 */
export interface DataLayer {
  // ── Entries ──────────────────────────────────────────────────────────────

  /** List all entries for a user in a category, ordered by the store's order array. */
  listEntries(email: string, category: CategoryKey): Promise<DataLayerEntry[]>;

  /** Get a single entry by ID, or null if not found. */
  getEntry(email: string, category: CategoryKey, id: string): Promise<DataLayerEntry | null>;

  /** Create or update an entry. Returns the persisted entry. */
  saveEntry(email: string, category: CategoryKey, entry: DataLayerEntry, options?: UpsertOptions): Promise<DataLayerEntry>;

  /** Replace the entire entry list for a category. Used by bulk operations (e.g., admin restore). */
  replaceEntries(email: string, category: CategoryKey, entries: DataLayerEntry[]): Promise<void>;

  /** Delete an entry by ID. Returns the deleted entry or null if not found. */
  deleteEntry(email: string, category: CategoryKey, id: string): Promise<DataLayerEntry | null>;

  // ── Users ──────────────────────────────────────────────────────────────

  /** List all registered user emails. */
  listUsers(): Promise<string[]>;

  // ── User Index ───────────────────────────────────────────────────────────

  /** Read the user's pre-built summary index, or null if not yet built. */
  getUserIndex(email: string): Promise<UserIndex | null>;

  /** Persist a user's summary index. */
  saveUserIndex(email: string, index: UserIndex): Promise<void>;

  // ── Locking ──────────────────────────────────────────────────────────────

  /** Execute a function under a user-scoped lock. */
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
}
