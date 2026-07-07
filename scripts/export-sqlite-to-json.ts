/**
 * SQLite → JSON reverse export (docs/SQLITE-MIGRATION.md phase 5 rollback).
 *
 * Written BEFORE cutover, per the playbook, so rolling back never loses
 * entries created while running on sqlite. Run with the app STOPPED:
 *   npm run migrate:sqlite:reverse
 *
 * Writes every user × category from tseda.db into the JSON v2 store files
 * (through the JSON primitive, so normalization and atomic writes apply),
 * then verifies counts + normalized deep-equality. The db is not modified.
 */

import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { CATEGORY_LIST } from "../data/categoryRegistry.ts";
import { DataStore, normalizeDataStoreEntry } from "../lib/dataStore.ts";
import { privateDataRoot } from "../lib/config/storagePaths.ts";
import type { CategoryKey } from "../lib/entries/types.ts";
import type { Entry } from "../lib/types/entry.ts";

const DB_FILE = path.join(privateDataRoot(), "tseda.db");

function stable(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

async function main() {
  console.log("═══ SQLite → JSON reverse export ═══");
  if (!fs.existsSync(DB_FILE)) {
    console.error(`✗ no database at ${DB_FILE}`);
    process.exit(1);
  }
  const db = new Database(DB_FILE, { readonly: true });
  const jsonStore = new DataStore();

  const users = (db.prepare("SELECT DISTINCT email FROM entries").all() as Array<{ email: string }>).map(
    (r) => r.email,
  );

  let entryCount = 0;
  let mismatches = 0;
  for (const email of users) {
    for (const category of CATEGORY_LIST) {
      const rows = db
        .prepare("SELECT data FROM entries WHERE email = ? AND category = ? ORDER BY position")
        .all(email, category) as Array<{ data: string }>;
      if (rows.length === 0) continue;

      const entries = rows
        .map((row) => normalizeDataStoreEntry(JSON.parse(row.data), category as CategoryKey))
        .filter((entry): entry is Entry => entry !== null);
      await jsonStore.writeCategory(email, category as CategoryKey, entries);

      const readBack = await jsonStore.readCategory(email, category as CategoryKey);
      if (readBack.length !== entries.length || stable(readBack) !== stable(entries)) {
        console.error(`✗ ${email}/${category}: JSON write-back differs`);
        mismatches += 1;
        continue;
      }
      entryCount += entries.length;
      console.log(`  ${email} ${category}: ${entries.length} entries ✓`);
    }
  }
  db.close();

  if (mismatches > 0) {
    console.error(`═══ FAILED: ${mismatches} mismatches ═══`);
    process.exit(1);
  }
  console.log(`═══ EXPORTED ${entryCount} entries for ${users.length} users — verified ═══`);
  console.log("Set DATA_LAYER=json (or remove it) and restart. Rebuild indexes on first load (read-heal).");
}

main().catch((error) => {
  console.error("Reverse export failed:", error);
  process.exit(1);
});
