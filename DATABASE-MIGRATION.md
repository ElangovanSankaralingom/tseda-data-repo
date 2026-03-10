# Database Migration Plan: JSON Files → SQLite

## Current Architecture

T'SEDA uses **file-based JSON storage** with no external database dependency:

```
.data/users/<email>/
  fdp-attended.json     # Category store (v2 format: {version, byId, order})
  fdp-conducted.json
  case-studies.json
  guest-lectures.json
  workshops.json
  index.json            # Pre-built user summary index
  events.log            # Write-ahead log (WAL) for audit trail
```

Each category store file contains a `byId` map of entries keyed by ID, plus an `order` array for insertion ordering. User-level file locks (`lib/data/locks.ts`) prevent concurrent writes, and atomic file operations (`lib/data/fileAtomic.ts`) prevent partial writes on crash.

## Why Migrate

| Concern | JSON Files | SQLite |
|---------|-----------|--------|
| Concurrent access | User-level in-memory locks (single process only) | WAL mode supports concurrent readers + one writer |
| Multi-process | Not safe without external coordination | Safe — file-level locking is built in |
| Query performance | Full file read + parse on every access | Indexed queries, no full-file parse |
| Data integrity | Atomic writes per file, no cross-file transactions | ACID transactions across all tables |
| Scalability | Performance degrades with file count | Handles millions of rows efficiently |
| Backup | Copy directory tree | Single file copy or `.backup` API |
| Storage efficiency | JSON overhead (keys repeated per entry) | Binary format, ~40-60% smaller |

## Data Layer Abstraction

A `DataLayer` interface (`lib/data/dataLayer.ts`) abstracts all storage operations:

```typescript
interface DataLayer {
  listEntries(email, category): Promise<Entry[]>;
  getEntry(email, category, id): Promise<Entry | null>;
  saveEntry(email, category, entry, options?): Promise<Entry>;
  replaceEntries(email, category, entries): Promise<void>;
  deleteEntry(email, category, id): Promise<Entry | null>;
  getUserIndex(email): Promise<UserIndex | null>;
  saveUserIndex(email, index): Promise<void>;
  withLock<T>(key, fn): Promise<T>;
}
```

Two implementations exist:
- `JsonDataLayer` — wraps the current file-based storage (active by default)
- `SqliteDataLayer` — stub, ready for implementation

The engine (`lib/entries/internal/engineHelpers.ts`) uses `createDataLayer()` to get the active backend, controlled by the `DATA_LAYER` environment variable.

## Migration Steps

### 1. Install SQLite dependency

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

### 2. Run the migration script

```bash
node --experimental-strip-types scripts/migrate-to-sqlite.ts
```

This reads all JSON files and creates `.data/tseda.db` with equivalent data. The original JSON files are **not modified or deleted**.

The script:
- Creates the SQLite schema (entries, user_indexes, migration_log tables)
- Migrates all entries from all users and categories
- Migrates user index files
- Verifies entry counts match
- Logs the migration in `migration_log` table

### 3. Implement SqliteDataLayer methods

Complete the stub in `lib/data/sqliteDataLayer.ts`. Each method maps to straightforward SQL:

| DataLayer method | SQL |
|-----------------|-----|
| `listEntries` | `SELECT data FROM entries WHERE user_email=? AND category=? ORDER BY sort_order` |
| `getEntry` | `SELECT data FROM entries WHERE user_email=? AND category=? AND id=?` |
| `saveEntry` | `INSERT OR REPLACE INTO entries ...` |
| `replaceEntries` | `DELETE` + batch `INSERT` in a transaction |
| `deleteEntry` | `DELETE FROM entries WHERE ... RETURNING data` |
| `getUserIndex` | `SELECT data FROM user_indexes WHERE user_email=?` |
| `saveUserIndex` | `INSERT OR REPLACE INTO user_indexes ...` |
| `withLock` | SQLite's built-in WAL locking (no-op wrapper) |

### 4. Activate SQLite

```bash
# In .env.local or .env.production
DATA_LAYER=sqlite
```

### 5. Verify

```bash
npm run build
npm run dev
# Test: create, edit, generate, delete entries
# Test: admin operations
# Test: dashboard loads correctly
```

## Rollback Plan

If issues are discovered after switching to SQLite:

1. **Immediate rollback**: Remove `DATA_LAYER=sqlite` from environment → app reverts to JSON files
2. **Data is preserved**: JSON files are never modified by the migration
3. **SQLite → JSON export**: If data was created in SQLite after migration, a reverse export script would be needed (not yet built)

## Schema

```sql
CREATE TABLE entries (
  id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL,
  data JSON NOT NULL,          -- Full entry as JSON blob
  sort_order INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (user_email, category, id)
);

CREATE TABLE user_indexes (
  user_email TEXT PRIMARY KEY,
  data JSON NOT NULL,          -- Full UserIndex as JSON blob
  updated_at TEXT NOT NULL
);

CREATE TABLE migration_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migrated_at TEXT NOT NULL,
  user_count INTEGER NOT NULL,
  entry_count INTEGER NOT NULL,
  source TEXT DEFAULT 'json'
);
```

## Performance Estimates

For a deployment with ~100 faculty and ~50 entries each (5,000 total entries):

| Operation | JSON Files | SQLite (estimated) |
|-----------|-----------|-------------------|
| List entries (1 category) | ~5-15ms (read + parse file) | ~1-3ms (indexed query) |
| Get single entry | ~5-15ms (read + parse + find) | <1ms (primary key lookup) |
| Save entry | ~10-20ms (read + modify + atomic write) | ~2-5ms (single INSERT) |
| Dashboard summary | ~50-200ms (read all category files) | ~5-15ms (aggregate query) |
| Full rebuild index | ~100-500ms (read all files) | ~20-50ms (table scan) |

SQLite becomes increasingly advantageous as the number of users and entries grows. The JSON approach reads entire files for any operation, while SQLite uses indexed access.
