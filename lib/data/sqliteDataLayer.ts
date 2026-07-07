import "server-only";

/**
 * SQLite implementation of the DataLayer (2026-07 migration, phase 2 of
 * docs/SQLITE-MIGRATION.md — implemented per the playbook, with two
 * corrections discovered during execution and documented there):
 *
 *  1. UNIVERSE FORK: the playbook said `<privateDataRoot()>/tseda.db`; the
 *     db actually lives under `universePrivateDataRoot()` so DEMO MODE gets
 *     its own database under `/demo`, wiped with the demo universe — the
 *     same isolation rule every other store follows. The path is resolved
 *     PER CALL (never pinned at construction) for exactly that reason.
 *  2. STORE REVISION: the JSON layer bumps the per-user revision inside its
 *     write choke point; here every write method bumps it, so the
 *     continuous-sync read-heal works identically on both backends.
 *
 * better-sqlite3 is synchronous — methods return resolved promises; no
 * worker thread in phase 1 (playbook rule). Crash-atomicity comes from
 * SQLite transactions + WAL; read-modify-write serialization stays with the
 * in-process lock (lib/data/locks.ts), identical lock keys to JSON.
 */

import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { universePrivateDataRoot } from "@/lib/config/storagePaths";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { withLock } from "@/lib/data/locks";
import { bumpStoreRevision } from "@/lib/data/storeRevision";
import { normalizeDataStoreEntry } from "@/lib/dataStore";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import type { CategoryKey } from "@/lib/entries/types";
import type { UserIndex } from "@/lib/data/indexStoreInternal";
import type { DataLayer, DataLayerEntry, UpsertOptions } from "@/lib/data/dataLayer";

const DB_FILENAME = "tseda.db";

/** One connection per resolved db path — the path changes per universe
 *  (real vs demo) and per test sandbox (PRIVATE_DATA_ROOT override). */
const connections = new Map<string, Database.Database>();

function dbPath(): string {
  return path.join(universePrivateDataRoot(), DB_FILENAME);
}

function open(): Database.Database {
  const file = dbPath();
  const existing = connections.get(file);
  if (existing && existing.open) return existing;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      email      TEXT NOT NULL,
      category   TEXT NOT NULL,
      id         TEXT NOT NULL,
      position   INTEGER NOT NULL,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (email, category, id)
    );
    CREATE INDEX IF NOT EXISTS idx_entries_list
      ON entries (email, category, position);
    CREATE TABLE IF NOT EXISTS user_index (
      email TEXT PRIMARY KEY,
      data  TEXT NOT NULL
    );
  `);
  connections.set(file, db);
  return db;
}

/**
 * DEMO-WIPE INTEGRATION (playbook phase-5 trap list): the demo universe's
 * entries live in `<private>/demo/tseda.db`. The wipe module calls these so
 * exit-wipes work identically on the sqlite backend:
 *  - removing ONE user's demo data must delete their rows;
 *  - removing the WHOLE demo tree must close the open handle first, or the
 *    recursive rm fails / a stale handle serves a deleted file.
 * Both are safe no-ops when the db file does not exist (json-only setups).
 */
export function deleteUserFromDbFile(dbFile: string, email: string): void {
  if (!fs.existsSync(dbFile)) return;
  const db = connections.get(dbFile) ?? new Database(dbFile);
  try {
    const normalized = normalizeEmail(email);
    db.prepare("DELETE FROM entries WHERE email = ?").run(normalized);
    db.prepare("DELETE FROM user_index WHERE email = ?").run(normalized);
  } finally {
    if (!connections.has(dbFile)) db.close();
  }
}

export function closeSqliteConnectionsUnder(rootPath: string): void {
  const resolvedRoot = path.resolve(rootPath);
  for (const [file, db] of connections) {
    if (path.resolve(file).startsWith(resolvedRoot + path.sep) || path.resolve(file) === resolvedRoot) {
      try {
        db.close();
      } catch {
        // already closed
      }
      connections.delete(file);
    }
  }
}

/** Test hook: close every cached connection (sandbox roots come and go). */
export function resetSqliteConnections(): void {
  for (const db of connections.values()) {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
  connections.clear();
}

function parseRow(raw: string, category: CategoryKey): DataLayerEntry | null {
  try {
    return normalizeDataStoreEntry(JSON.parse(raw), category);
  } catch {
    return null;
  }
}

function updatedAtOf(entry: DataLayerEntry): string {
  const value = (entry as Record<string, unknown>).updatedAt;
  return typeof value === "string" && value ? value : new Date().toISOString();
}

export class SqliteDataLayer implements DataLayer {
  async listEntries(email: string, category: CategoryKey): Promise<DataLayerEntry[]> {
    const db = open();
    const rows = db
      .prepare("SELECT data FROM entries WHERE email = ? AND category = ? ORDER BY position")
      .all(normalizeEmail(email), category) as Array<{ data: string }>;
    const entries: DataLayerEntry[] = [];
    for (const row of rows) {
      const parsed = parseRow(row.data, category);
      if (parsed) entries.push(parsed);
    }
    return entries;
  }

  async getEntry(email: string, category: CategoryKey, id: string): Promise<DataLayerEntry | null> {
    const db = open();
    const row = db
      .prepare("SELECT data FROM entries WHERE email = ? AND category = ? AND id = ?")
      .get(normalizeEmail(email), category, String(id ?? "").trim()) as { data: string } | undefined;
    return row ? parseRow(row.data, category) : null;
  }

  async saveEntry(
    email: string,
    category: CategoryKey,
    entry: DataLayerEntry,
    options?: UpsertOptions,
  ): Promise<DataLayerEntry> {
    const normalizedEmail = normalizeEmail(email);
    // Persist the NORMALIZED entry — mirrors the JSON writer, which runs
    // every entry through normalizeDataStoreEntry before storing.
    const normalized = normalizeDataStoreEntry(entry, category);
    if (!normalized) {
      throw new Error("saveEntry: entry failed normalization");
    }
    const id = String(normalized.id ?? "").trim();
    if (!id) throw new Error("saveEntry: entry id required");

    const db = open();
    const run = db.transaction(() => {
      const existing = db
        .prepare("SELECT position FROM entries WHERE email = ? AND category = ? AND id = ?")
        .get(normalizedEmail, category, id) as { position: number } | undefined;

      if (existing) {
        db.prepare(
          "UPDATE entries SET data = ?, updated_at = ? WHERE email = ? AND category = ? AND id = ?",
        ).run(JSON.stringify(normalized), updatedAtOf(normalized), normalizedEmail, category, id);
        return;
      }

      // Reproduce the JSON order-array semantics: new entries go to the
      // FRONT by default ("start"), or the end for "end".
      const bounds = db
        .prepare(
          "SELECT MIN(position) AS min, MAX(position) AS max FROM entries WHERE email = ? AND category = ?",
        )
        .get(normalizedEmail, category) as { min: number | null; max: number | null };
      const position =
        options?.insertPosition === "end"
          ? (bounds.max ?? -1) + 1
          : (bounds.min ?? 1) - 1;

      db.prepare(
        "INSERT INTO entries (email, category, id, position, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(normalizedEmail, category, id, position, JSON.stringify(normalized), updatedAtOf(normalized));
    });
    run();

    await bumpStoreRevision(normalizedEmail);
    return normalized;
  }

  async replaceEntries(email: string, category: CategoryKey, entries: DataLayerEntry[]): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const db = open();
    const run = db.transaction(() => {
      db.prepare("DELETE FROM entries WHERE email = ? AND category = ?").run(normalizedEmail, category);
      const insert = db.prepare(
        "INSERT INTO entries (email, category, id, position, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      );
      let position = 0;
      const seen = new Set<string>();
      for (const raw of entries) {
        const normalized = normalizeDataStoreEntry(raw, category);
        if (!normalized) continue;
        const id = String(normalized.id ?? "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        insert.run(normalizedEmail, category, id, position, JSON.stringify(normalized), updatedAtOf(normalized));
        position += 1;
      }
    });
    run();
    await bumpStoreRevision(normalizedEmail);
  }

  async deleteEntry(email: string, category: CategoryKey, id: string): Promise<DataLayerEntry | null> {
    const normalizedEmail = normalizeEmail(email);
    const targetId = String(id ?? "").trim();
    const db = open();
    let removed: DataLayerEntry | null = null;
    const run = db.transaction(() => {
      const row = db
        .prepare("SELECT data FROM entries WHERE email = ? AND category = ? AND id = ?")
        .get(normalizedEmail, category, targetId) as { data: string } | undefined;
      if (!row) return;
      removed = parseRow(row.data, category);
      db.prepare("DELETE FROM entries WHERE email = ? AND category = ? AND id = ?").run(
        normalizedEmail,
        category,
        targetId,
      );
    });
    run();
    if (removed) await bumpStoreRevision(normalizedEmail);
    return removed;
  }

  async listUsers(): Promise<string[]> {
    const db = open();
    const rows = db
      .prepare("SELECT email FROM entries UNION SELECT email FROM user_index")
      .all() as Array<{ email: string }>;
    return rows
      .map((row) => normalizeEmail(row.email))
      .filter((email) => email.endsWith(ALLOWED_EMAIL_SUFFIX))
      .sort((left, right) => left.localeCompare(right));
  }

  async getUserIndex(email: string): Promise<UserIndex | null> {
    const db = open();
    const row = db
      .prepare("SELECT data FROM user_index WHERE email = ?")
      .get(normalizeEmail(email)) as { data: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.data) as UserIndex;
    } catch {
      return null;
    }
  }

  async saveUserIndex(email: string, index: UserIndex): Promise<void> {
    const db = open();
    db.prepare(
      "INSERT INTO user_index (email, data) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET data = excluded.data",
    ).run(normalizeEmail(email), JSON.stringify(index));
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Identical lock keys and semantics to the JSON backend (playbook rule):
    // SQLite gives crash-atomicity; the in-process lock preserves the
    // engine's read-modify-write serialization.
    return withLock(key, fn);
  }
}
