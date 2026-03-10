/**
 * Migration script: JSON files → SQLite database.
 *
 * Reads all user data from .data/users/ and creates a SQLite database
 * with equivalent schema and data.
 *
 * Usage:
 *   node --experimental-strip-types scripts/migrate-to-sqlite.ts
 *
 * Prerequisites:
 *   npm install better-sqlite3
 *
 * This script is idempotent — it creates a fresh database each run.
 * The original JSON files are NOT modified or deleted.
 */

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const DATA_ROOT = process.env.DATA_ROOT || ".data";
const USERS_DIR = path.join(process.cwd(), DATA_ROOT, "users");
const DB_PATH = path.join(process.cwd(), DATA_ROOT, "tseda.db");

const CATEGORY_FILES = [
  "fdp-attended.json",
  "fdp-conducted.json",
  "case-studies.json",
  "guest-lectures.json",
  "workshops.json",
];

type CategoryStore = {
  version?: number;
  byId?: Record<string, Record<string, unknown>>;
  order?: string[];
};

async function main() {
  console.log("=== JSON → SQLite Migration ===\n");

  // ── Step 1: Check prerequisites ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Database: any;
  try {
    Database = await import("better-sqlite3");
    Database = Database.default || Database;
  } catch {
    console.error("ERROR: better-sqlite3 is not installed.");
    console.error("Run: npm install better-sqlite3 @types/better-sqlite3");
    process.exit(1);
  }

  // ── Step 2: Discover users ───────────────────────────────────────────────
  let userDirs: string[];
  try {
    const entries = await fs.readdir(USERS_DIR, { withFileTypes: true });
    userDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    console.error(`ERROR: Cannot read users directory: ${USERS_DIR}`);
    console.error("Make sure .data/users/ exists with user data.");
    process.exit(1);
  }

  console.log(`Found ${userDirs.length} user(s) in ${USERS_DIR}\n`);

  if (userDirs.length === 0) {
    console.log("No users to migrate. Done.");
    process.exit(0);
  }

  // ── Step 3: Create SQLite database ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Database(DB_PATH) as any;

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      category TEXT NOT NULL,
      data JSON NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (user_email, category, id)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user_category
      ON entries (user_email, category);

    CREATE TABLE IF NOT EXISTS user_indexes (
      user_email TEXT PRIMARY KEY,
      data JSON NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS migration_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migrated_at TEXT NOT NULL,
      user_count INTEGER NOT NULL,
      entry_count INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'json'
    );
  `);

  console.log(`Created SQLite database at: ${DB_PATH}\n`);

  // ── Step 4: Migrate data ─────────────────────────────────────────────────
  const insertEntry = db.prepare(`
    INSERT OR REPLACE INTO entries (id, user_email, category, data, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertIndex = db.prepare(`
    INSERT OR REPLACE INTO user_indexes (user_email, data, updated_at)
    VALUES (?, ?, ?)
  `);

  let totalEntries = 0;
  let totalUsers = 0;

  const migrateAll = db.transaction(() => {
    for (const userDir of userDirs) {
      let userEntryCount = 0;

      for (const categoryFile of CATEGORY_FILES) {
        const filePath = path.join(USERS_DIR, userDir, categoryFile);
        const category = categoryFile.replace(".json", "");

        let raw: string;
        try {
          raw = readFileSync(filePath, "utf8");
        } catch {
          continue; // File doesn't exist for this user/category
        }

        let store: CategoryStore;
        try {
          store = JSON.parse(raw) as CategoryStore;
        } catch {
          console.warn(`  WARN: Invalid JSON in ${filePath}, skipping.`);
          continue;
        }

        const byId = store.byId ?? {};
        const order = store.order ?? Object.keys(byId);

        for (let i = 0; i < order.length; i++) {
          const entryId = order[i];
          const entry = byId[entryId];
          if (!entry) continue;

          const createdAt = typeof entry.createdAt === "string" ? entry.createdAt : null;
          const updatedAt = typeof entry.updatedAt === "string" ? entry.updatedAt : null;

          insertEntry.run(
            entryId,
            userDir,
            category,
            JSON.stringify(entry),
            i,
            createdAt,
            updatedAt,
          );

          userEntryCount++;
        }
      }

      // Migrate index if exists
      const indexPath = path.join(USERS_DIR, userDir, "index.json");
      try {
        const indexRaw = readFileSync(indexPath, "utf8");
        const indexData = JSON.parse(indexRaw);
        insertIndex.run(
          userDir,
          JSON.stringify(indexData),
          new Date().toISOString(),
        );
      } catch {
        // Index doesn't exist or is invalid — will be rebuilt on first access
      }

      totalEntries += userEntryCount;
      totalUsers++;
      console.log(`  ${userDir}: ${userEntryCount} entries migrated`);
    }
  });

  migrateAll();

  // ── Step 5: Log migration ────────────────────────────────────────────────
  db.prepare(`
    INSERT INTO migration_log (migrated_at, user_count, entry_count)
    VALUES (?, ?, ?)
  `).run(new Date().toISOString(), totalUsers, totalEntries);

  // ── Step 6: Verify ───────────────────────────────────────────────────────
  const dbEntryCount = (db.prepare("SELECT COUNT(*) as count FROM entries").get() as { count: number }).count;
  const dbUserCount = (db.prepare("SELECT COUNT(DISTINCT user_email) as count FROM entries").get() as { count: number }).count;

  console.log("\n=== Migration Complete ===");
  console.log(`Users migrated:   ${totalUsers}`);
  console.log(`Entries migrated: ${totalEntries}`);
  console.log(`DB entry count:   ${dbEntryCount}`);
  console.log(`DB user count:    ${dbUserCount}`);
  console.log(`Database path:    ${DB_PATH}`);

  if (dbEntryCount !== totalEntries) {
    console.error("\nWARNING: Entry count mismatch! Migration may be incomplete.");
    process.exit(1);
  }

  console.log("\nVerification passed. JSON files are untouched.");
  console.log("To activate SQLite, set DATA_LAYER=sqlite in your .env");

  db.close();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
