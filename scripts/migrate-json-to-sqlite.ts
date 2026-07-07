/**
 * JSON → SQLite migration (docs/SQLITE-MIGRATION.md phases 3–4).
 *
 * Run with the app STOPPED:
 *   npm run migrate:sqlite
 *
 * - Reads every user's category stores + index.json from the JSON tree.
 * - Writes the phase-1 schema into `<privateDataRoot()>/tseda.db`
 *   (positions from the JSON `order` array; user_index from index.json).
 * - IDEMPOTENT: rebuilds the tables fresh each run. JSON files are NEVER
 *   modified — rollback is always `DATA_LAYER=json`.
 * - VERIFIES loudly: per user × category count match, per-entry deep
 *   equality of NORMALIZED output across both backends, order identity,
 *   and pdf-hash stability. Exits non-zero on ANY mismatch.
 *
 * Reverse (post-cutover rollback with data written on sqlite):
 *   npm run migrate:sqlite:reverse   (scripts/export-sqlite-to-json.ts)
 */

import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { CATEGORY_LIST } from "../data/categoryRegistry.ts";
import { DataStore, normalizeDataStoreEntry } from "../lib/dataStore.ts";
import { hashPrePdfFields } from "../lib/pdfSnapshot.ts";
import { privateDataRoot } from "../lib/config/storagePaths.ts";
import { getUsersRootDir } from "../lib/userStore.ts";
import { normalizeEmail } from "../lib/facultyDirectory.ts";
import type { CategoryKey } from "../lib/entries/types.ts";

const DB_FILE = path.join(privateDataRoot(), "tseda.db");

function stable(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

async function listJsonUsers(): Promise<string[]> {
  try {
    const dirs = await fs.readdir(getUsersRootDir(), { withFileTypes: true });
    return dirs.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

async function main() {
  console.log("═══ JSON → SQLite migration ═══");
  console.log(`db: ${DB_FILE}`);
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });

  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    DROP TABLE IF EXISTS entries;
    DROP TABLE IF EXISTS user_index;
    CREATE TABLE entries (
      email TEXT NOT NULL, category TEXT NOT NULL, id TEXT NOT NULL,
      position INTEGER NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (email, category, id)
    );
    CREATE INDEX idx_entries_list ON entries (email, category, position);
    CREATE TABLE user_index (email TEXT PRIMARY KEY, data TEXT NOT NULL);
  `);

  const insertEntry = db.prepare(
    "INSERT INTO entries (email, category, id, position, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertIndex = db.prepare("INSERT INTO user_index (email, data) VALUES (?, ?)");
  const jsonStore = new DataStore();

  let userCount = 0;
  let entryCount = 0;
  let mismatches = 0;

  for (const dir of await listJsonUsers()) {
    const email = normalizeEmail(dir.replace(/_at_/, "@"));
    if (!email.includes("@")) continue;
    userCount += 1;

    for (const category of CATEGORY_LIST) {
      // Source of truth: the JSON primitive with its own normalization.
      const jsonEntries = await jsonStore.readCategory(email, category);
      if (jsonEntries.length === 0) continue;

      const run = db.transaction(() => {
        jsonEntries.forEach((entry, position) => {
          const record = entry as Record<string, unknown>;
          insertEntry.run(
            email,
            category,
            String(record.id),
            position,
            JSON.stringify(entry),
            typeof record.updatedAt === "string" ? record.updatedAt : "",
          );
        });
      });
      run();

      // VERIFY: count, order, deep equality of normalized output, pdf hash.
      const rows = db
        .prepare("SELECT data FROM entries WHERE email = ? AND category = ? ORDER BY position")
        .all(email, category) as Array<{ data: string }>;
      if (rows.length !== jsonEntries.length) {
        console.error(`✗ ${email}/${category}: count json=${jsonEntries.length} sqlite=${rows.length}`);
        mismatches += 1;
        continue;
      }
      rows.forEach((row, i) => {
        const fromDb = normalizeDataStoreEntry(JSON.parse(row.data), category as CategoryKey);
        const fromJson = jsonEntries[i];
        if (!fromDb || stable(fromDb) !== stable(fromJson)) {
          console.error(`✗ ${email}/${category}[${i}]: normalized entries differ`);
          mismatches += 1;
          return;
        }
        const hashDb = hashPrePdfFields(fromDb, category as CategoryKey);
        const hashJson = hashPrePdfFields(fromJson, category as CategoryKey);
        if (hashDb !== hashJson) {
          console.error(`✗ ${email}/${category}[${i}]: pdf hash drift (would stale documents)`);
          mismatches += 1;
        }
      });
      entryCount += jsonEntries.length;
      console.log(`  ${email} ${category}: ${jsonEntries.length} entries ✓`);
    }

    // Index blob: imported for continuity; phase-4 rule says rebuild from
    // sqlite after cutover anyway (npm run migrate:sqlite prints the hint).
    try {
      const raw = await fs.readFile(path.join(getUsersRootDir(), dir, "index.json"), "utf8");
      insertIndex.run(email, raw.trim());
    } catch {
      // no index yet — the read-heal rebuilds on first load
    }
  }

  db.close();

  if (mismatches > 0) {
    console.error(`═══ FAILED: ${mismatches} mismatches — DO NOT CUT OVER ═══`);
    process.exit(1);
  }
  console.log(`═══ MIGRATED ${entryCount} entries across ${userCount} users — all verified ═══`);
  console.log("Next: set DATA_LAYER=sqlite in .env.local, start the app, smoke test per the playbook.");
  console.log("Rollback at any time: DATA_LAYER=json (JSON files were never touched).");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
