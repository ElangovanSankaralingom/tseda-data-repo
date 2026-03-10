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

let instance: DataLayer | null = null;

/**
 * Get or create the singleton DataLayer instance.
 *
 * @returns The configured DataLayer implementation
 */
export function createDataLayer(): DataLayer {
  if (instance) return instance;

  const backend = process.env.DATA_LAYER || "json";

  if (backend === "sqlite") {
    // Lazy import to avoid loading better-sqlite3 when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SqliteDataLayer } = require("@/lib/data/sqliteDataLayer") as typeof import("@/lib/data/sqliteDataLayer");
    instance = new SqliteDataLayer();
  } else {
    instance = new JsonDataLayer();
  }

  return instance;
}
