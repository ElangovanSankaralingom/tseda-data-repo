# SQLite Migration — Execution Playbook

> **Status: PLANNED, not started.** This is the authoritative, step-by-step
> playbook for moving ENTRY storage from JSON files to SQLite. It supersedes
> the overview in `/DATABASE-MIGRATION.md` (kept for background). Written
> 2026-07 so a future session (any model) can execute it without re-deriving
> the reasoning. Follow it IN ORDER; every phase ends with a gate.

## Scope — read this twice

**IN scope (phase 1):** exactly what the `DataLayer` interface
(`lib/data/dataLayer.ts`) covers — per-user category entry stores and the
per-user summary index. Nothing else.

**OUT of scope (deliberately, phase 1):** WAL audit log (`events.log` stays a
file — append-only, low-volume, migrating it buys nothing), feed store,
notifications, settings, faculty registry, profiles, quarantine bundles,
action history, uploaded files. All are low-volume JSON with their own
modules. Migrate them only if/when they hurt — the second-consumer rule.

**Why entries first:** they are the only stores with per-request
read-modify-write volume, the only ones that grow with faculty × categories ×
years, and the only ones already behind an abstraction.

## Ground truth (verified 2026-07)

- `lib/data/dataLayer.ts` — 9-method interface; all entry access flows
  through it (2026-07 audit confirmed zero bypasses).
- `lib/data/createDataLayer.ts` — singleton factory, `DATA_LAYER` env var
  (`"json"` default | `"sqlite"`).
- `lib/data/sqliteDataLayer.ts` — stub; every method throws.
- `scripts/migrate-to-sqlite.ts` — data import script (JSON → `tseda.db`),
  idempotent, does NOT modify JSON files. Review before use; it predates the
  collaboration fields (they're schema-less JSON columns, so no change
  expected — verify anyway).
- JSON v2 store format per user/category: `{ version, byId, order }` +
  `index.json` + `events.log` under `.data/users/<email>/`.

## Phase 0 — Preconditions (gate: all true)

1. All 519+ tests green on `main`; clean working tree; fresh backup zip
   downloaded OFF the machine.
2. `npm install better-sqlite3 @types/better-sqlite3` (exact versions pinned
   in package.json).
3. **Next.js bundling trap:** add `serverExternalPackages:
   ["better-sqlite3"]` to `next.config.ts` — native modules must not be
   bundled by Turbopack. Verify `npm run build` still passes BEFORE writing
   any implementation code.

## Phase 1 — Schema

One database file: `<privateDataRoot()>/tseda.db` (respects the
`PRIVATE_DATA_ROOT` test sandbox override — tests must NEVER touch a live db;
reuse the `createTestDataRoot` pattern).

```sql
PRAGMA journal_mode = WAL;        -- concurrent readers + single writer
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS entries (
  email      TEXT NOT NULL,       -- normalized owner email
  category   TEXT NOT NULL,       -- CategoryKey slug
  id         TEXT NOT NULL,       -- entry id
  position   INTEGER NOT NULL,    -- replaces the JSON `order` array
  data       TEXT NOT NULL,       -- full entry JSON (schema-less by design)
  updated_at TEXT NOT NULL,       -- mirror of data.updatedAt for cheap sorts
  PRIMARY KEY (email, category, id)
);
CREATE INDEX IF NOT EXISTS idx_entries_list
  ON entries (email, category, position);

CREATE TABLE IF NOT EXISTS user_index (
  email TEXT PRIMARY KEY,
  data  TEXT NOT NULL              -- UserIndex JSON blob
);
```

Entries stay a JSON blob on purpose: the app is schema-driven
(`data/schemas/*`), hydration/normalization happens in code
(`hydrateEntry`/`normalizeEntry`), and column-per-field would create a second
schema to keep in sync — the exact disease the correlation audit cured. Do
NOT normalize fields into columns in phase 1.

## Phase 2 — Implement `SqliteDataLayer`

Contract per method (all reads return entries through the SAME normalization
the JSON layer applies — check `JsonDataLayer` and mirror it):

- `listEntries` — `SELECT data FROM entries WHERE email=? AND category=?
  ORDER BY position` → parse → normalize.
- `getEntry` — single-row select by PK → parse → normalize → null if absent.
- `saveEntry` — in ONE transaction: if row exists, UPDATE keeping position;
  else INSERT with `position = MIN(position)-1` when
  `options.insertPosition === "start"` (default) or `MAX+1` for `"end"` —
  this reproduces the JSON layer's order-array semantics exactly.
- `replaceEntries` — transaction: DELETE all rows for (email, category), then
  INSERT in array order with position = array index.
- `deleteEntry` — transaction: SELECT then DELETE; return the parsed row or
  null.
- `listUsers` — `SELECT DISTINCT email FROM entries` UNION emails present in
  `user_index`.
- `getUserIndex`/`saveUserIndex` — blob read/write on `user_index`.
- `withLock` — DELEGATE to the existing in-process lock
  (`lib/data/locks.ts`), unchanged. SQLite transactions give crash-atomicity;
  the process lock preserves the read-modify-write serialization the engine
  relies on. (Cross-PROCESS safety comes free from SQLite's file locking +
  busy_timeout — see docs/DEPLOYMENT.md.)

better-sqlite3 is synchronous — wrap results in resolved promises; do NOT
introduce a worker thread in phase 1.

**Gate:** the existing test suite runs against BOTH backends. Add a CI-able
switch: `DATA_LAYER=sqlite npm test`. The dataStore/engine/concurrency/
nightly-idempotency/collab tests must pass unmodified on sqlite (they use
`createTestDataRoot`; ensure the factory re-reads `DATA_LAYER` + roots per
test sandbox rather than caching a stale singleton across env changes — if
the singleton caches, add a test-only reset hook).

## Phase 3 — Migrate data

1. Review + update `scripts/migrate-to-sqlite.ts` to the phase-1 schema
   above (positions from the `order` array; `user_index` from `index.json`).
2. Announce a freeze window to faculty (evening, 30 min). Stop the app.
3. Run the backup job once more; copy `.data/` aside (`cp -r .data
   .data.pre-sqlite`).
4. Run the migration script. It must print, per user × category: JSON count,
   inserted count, and FAIL LOUDLY on any mismatch.

## Phase 4 — Verify (gate: all pass, else do not cut over)

1. **Counts:** script-reported counts match `find`-based JSON counts.
2. **Deep equality:** verification script loads every entry from BOTH
   backends and deep-compares normalized output (reuse `stableStringify`
   from `lib/pdfSnapshot.ts`); zero diffs allowed.
3. **Order:** `listEntries` order identical per user × category.
4. **Hash stability:** `hashPrePdfFields` identical per entry across
   backends — guarantees no false "Document outdated" after cutover.
5. **Derived stores:** rebuild every user index from SQLite
   (`rebuildUserIndex`) rather than trusting the imported blob; then
   `DATA_LAYER=sqlite npm test` one final time.

## Phase 5 — Cutover + rollback

1. Set `DATA_LAYER=sqlite` in `.env.local`. Start the app. Smoke test:
   sign in → list entries → create → generate (fan-out to a collaborator!) →
   upload → finalise → dashboard counts → admin confirmations → nightly
   endpoint (with CRON_SECRET) → analytics.
2. Watch logs for one full day (especially `entry.mutation.*` and nightly).
3. **Rollback at ANY point:** set `DATA_LAYER=json`, restart. JSON files
   were never modified. Entries created while on sqlite are exported back by
   running the migration script in reverse mode — write `scripts/
   export-sqlite-to-json.ts` BEFORE cutover (same verification gates), so
   rollback never loses post-cutover writes.
4. After 2 quiet weeks: archive `.data.pre-sqlite`, update CLAUDE.md Stack +
   Current State, add `tseda.db*` to backup + integrity + reset tooling
   (grep for `users/` directory walkers: integrity checker, orphan scan,
   backup service, reset route — each needs a sqlite-aware path or an
   explicit "json-only, superseded" note).

## Known traps (learned from this codebase, do not rediscover)

- `PRIVATE_DATA_ROOT`/`DATA_ROOT` are TWO different roots (storage audit,
  2026-07). The db lives under the private root; honor both env overrides.
- The nightly job, integrity checker, backup service and reset route walk
  `.data/users/` DIRECTLY in places — they bypass DataLayer by design for
  file-level work. Phase 5 step 4 lists them; audit each against sqlite.
- `withUserDataLock` keys are normalized emails; keep lock keys identical
  across backends or concurrent-mutation tests will interleave differently.
- Feed/notifications/settings remain JSON — do not "helpfully" migrate them.
