# Deployment Architecture — Today, and What Breaks at Scale

> Written 2026-07. Two parts: (1) the CORRECT way to run T'SEDA today
> (single instance — this is the supported topology), and (2) the exact
> inventory of single-instance assumptions and the ORDER to fix them if the
> app ever needs more than one server process. Do not attempt multi-instance
> before working through part 2 — it will corrupt data quietly.

## Part 1 — The supported topology (single instance)

One Node process (Docker or systemd) behind one reverse proxy (nginx),
serving all of TCE. This is not a limitation to apologize for: file-backed
stores + in-process locks are simple, debuggable, and comfortably handle a
department's traffic.

Checklist for a correct production install:

1. **Env (.env.local):** GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET (openssl
   rand -base64 32), NEXTAUTH_URL (the public https URL), CRON_SECRET (set
   it — boot logs a loud warning in production if missing and nightly
   maintenance stays OFF).
2. **Reverse proxy:** terminate TLS at nginx; the app trusts forwarding
   headers by default (rightmost x-forwarded-for). If you ever expose the
   app WITHOUT a proxy, set `TRUST_PROXY=false` or rate-limit keys become
   client-forgeable.
3. **Nightly cron:** one system cron entry calling
   `POST /api/cron/nightly` with header `x-cron-secret: $CRON_SECRET`,
   ~02:30 IST. This runs auto-finalise/auto-delete (quarantine), timer
   warnings, WAL compaction, backup, integrity checks. It must fire from
   exactly ONE place — never register it twice.
4. **Data durability:** everything lives under `.data/` (gitignored).
   Nightly backup zips land under the backup root — copy them OFF the
   machine (rsync/cloud) on a schedule; a backup on the same disk is not a
   backup. Test a restore once per semester (admin → backups → restore into
   a scratch DATA_ROOT).
5. **Uploads:** under `.data/entry-uploads/`, served only via the authed
   `/api/entry-file` route. Never place user content under `public/`.
6. **Logs:** structured JSON on stdout — let systemd/Docker handle rotation.
7. **Upgrades:** `git pull && npm ci && npm run lint && npx tsc --noEmit &&
   npm test && npm run build`, then restart. The gates are the deploy check.

## Part 2 — Single-instance assumptions (what breaks at 2+ processes)

Inventory of every place the code assumes ONE process. Severity = what
happens if you ignore it and run two instances anyway.

| # | Assumption | Where | If violated |
|---|-----------|-------|-------------|
| 1 | Entry writes serialized by in-process lock chains | `lib/data/locks.ts` (Map of promise tails) | **DATA LOSS.** Two processes read-modify-write the same JSON file; last writer silently drops the other's entries. This is the hard blocker. |
| 2 | Atomic file writes are per-process temp+rename | `lib/data/fileAtomic.ts` | Cross-process interleaving → torn category stores possible under contention. Same blocker as #1. |
| 3 | Rate-limit buckets in memory | `lib/security/rateLimit.ts` | Limits become per-instance (N× looser). Degradation, not corruption. |
| 4 | Settings/analytics caches + `revalidateTag` are per-process | `lib/settings/store.ts`, `lib/analytics/cache.ts`, `revalidateDashboardSummary` | Self-hosted Next cache invalidation does NOT propagate across instances — one instance serves stale dashboards/settings after another writes. |
| 5 | Nightly job assumes sole ownership | `app/api/cron/nightly` | Two instances both cron'd → double warnings; auto-actions are idempotent (tested) but backups/compaction race. Point cron at ONE instance only. |
| 6 | Uploads + PDFs on local disk | `lib/config/storagePaths.ts` | Instance B can't serve files uploaded via instance A. Needs shared disk (NFS) or object storage behind the same `resolveEntryUploadPath` seam. |
| 7 | Feed/notification/registry JSON stores share the same lock assumption | `lib/feed/feedStore.ts`, notification/registry stores | Same class as #1, lower volume. |

Sessions are the one thing already multi-instance-safe: NextAuth JWT
strategy is stateless (any instance can validate any session).

## The fix order (do not reorder)

1. **SQLite first** (`docs/SQLITE-MIGRATION.md`). WAL mode + busy_timeout
   gives cross-process write safety for entries — it converts blocker #1/#2
   into a solved problem for the highest-volume store. Do not scale before
   this.
2. **Pin the cron** to one instance (#5) — an ops decision, zero code.
3. **Shared storage for uploads** (#6): mount shared disk or implement an
   object-storage variant behind `resolveEntryUploadPath`/`entryFileUrl` —
   the ONLY two functions that know where files live.
4. **Move remaining shared-write JSON stores** (#7) into SQLite tables
   (feed, notifications, registry, settings) — mechanical once phase 1 of
   the migration exists.
5. **Externalize cache invalidation** (#4): either accept short staleness
   (dashboard summaries already carry max-age ≤ 60s semantics) or move the
   settings/analytics caches into SQLite with a version row each instance
   checks. Avoid introducing Redis for this app's scale unless something
   else already demands it.
6. **Rate limits** (#3): accept per-instance limits (documented), or back
   buckets with SQLite if enforcement must be exact.

Realistically, T'SEDA at TCE scale never needs step 5-6; steps 1-3 are the
complete story for "two instances behind nginx". The document exists so that
whoever feels scaling pressure knows the walls are load-bearing BEFORE they
knock one down.
