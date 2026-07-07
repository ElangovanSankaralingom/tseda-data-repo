import "server-only";

/**
 * Data layer factory.
 *
 * Returns a singleton DataLayer instance based on the DATA_LAYER env var.
 * Default is "json" (file-based JSON storage).
 *
 * Supported backends:
 * - "json" (default) — file-based JSON via dataStore.ts
 * - "sqlite" — SQLite via better-sqlite3 (stub, not yet implemented)
 */

import type { DataLayer } from "@/lib/data/dataLayer";
import { JsonDataLayer } from "@/lib/data/jsonDataLayer";
// Static import (2026-07): the old lazy require() crashed under the ESM
// test runner (no require in module scope), and better-sqlite3 is a pinned
// dependency now — loading it is milliseconds. serverExternalPackages in
// next.config.ts keeps the native module out of the bundle.
import { SqliteDataLayer } from "@/lib/data/sqliteDataLayer";

let instance: DataLayer | null = null;

/**
 * Get or create the singleton DataLayer instance.
 *
 * @returns The configured DataLayer implementation
 */
export function createDataLayer(): DataLayer {
  if (instance) return instance;
  const backend = process.env.DATA_LAYER || "json";
  instance = backend === "sqlite" ? new SqliteDataLayer() : new JsonDataLayer();
  return instance;
}
