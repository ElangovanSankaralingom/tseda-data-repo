# AUDIT.md

Comprehensive codebase audit for production readiness.
Performed 2026-03-07 against the `claude/hopeful-booth` branch.

---

## 1. Storage Migration Assessment

### Current Architecture

**Data format:** Per-user JSON files on the local filesystem at `.data/users/<email>/`.

- **Category stores:** One JSON file per category per user (e.g., `fdp-attended.json`). Uses a v2 envelope: `{ version, byId: {}, order: [] }`.
- **User index:** `index.json` per user. Pre-computed aggregates (counts by status, streak snapshots, search index). Rebuilt from category stores when invalid.
- **WAL (event log):** `events.log` per user. Append-only JSONL file recording every mutation with before/after snapshots.

### Read/Write Mechanisms

| Operation | Mechanism | File |
|-----------|-----------|------|
| Read category | `fs.readFile` + `JSON.parse` | `lib/dataStore.ts:176` |
| Write category | `atomicWriteTextFile` (write temp + `fs.rename`) | `lib/data/fileAtomic.ts` |
| Read index | `fs.readFile` + `JSON.parse` | `lib/data/indexStore.ts:384` |
| Write index | `atomicWriteTextFile` | `lib/data/indexStore.ts:373` |
| WAL append | `fs.appendFile` | `lib/data/wal.ts:241` |

### Atomicity & Crash Safety

**Writes are atomic** thanks to `atomicWriteTextFile`: it writes to a temp file with a unique name (`{file}.tmp.{pid}.{ts}.{uuid}`) then does `fs.rename`. On POSIX systems (macOS/Linux), rename is atomic within the same filesystem. This is solid.

**WAL is NOT crash-safe.** `fs.appendFile` is not guaranteed to be atomic on all systems. A crash mid-append could leave a partial JSON line. The WAL reader (`readEvents`) silently skips unparseable lines, which is a reasonable mitigation. However, the WAL is append-only and never truncated, so it grows unbounded.

### Locking & Concurrency

**In-process locking** exists via `lib/data/locks.ts`. It uses a promise-chain pattern (`lockTails` Map) with `AsyncLocalStorage` for re-entrant lock detection. This serializes all operations for a given user email within the same Node.js process.

**Critical limitation:** This is an in-memory lock. It does NOT protect against:
- Multiple Node.js processes (e.g., multiple serverless function instances)
- Multiple server instances behind a load balancer
- Dev server hot-reload creating new process contexts

For a single-server deployment with `next start`, this is adequate. For Vercel or any multi-instance deployment, it provides zero protection.

### Race Condition Analysis

- **Same user, same process:** Safe. The promise-chain lock serializes operations.
- **Same user, different processes:** UNSAFE. Two processes can read the same JSON, both modify, and the last write wins (lost update).
- **Different users:** Safe. User data is isolated by directory and lock key.
- **WAL append by two processes:** Potentially corrupted. `fs.appendFile` from different processes can interleave bytes.

### Performance Estimates

- **Read**: Each category read parses the entire JSON file. For 100 entries per category, this is ~50-200KB of JSON. Fast enough.
- **Write**: Each upsert reads the full category store, modifies in memory, serializes, and writes. Same cost.
- **Dashboard**: Reads ALL categories (5 files) + computes streaks. ~5 file reads per dashboard load.
- **Index rebuild**: Reads ALL categories, computes streaks, search index. Expensive but cached via `unstable_cache`.
- **Degradation point**: Estimated at ~500 entries per category per user (JSON files >5MB). At TCE scale (2000 users x 5 categories), the total dataset is manageable, but WAL files grow unbounded.

### Migration Recommendations

| Option | Effort | Pros | Cons |
|--------|--------|------|------|
| **SQLite via better-sqlite3** | Medium | Stays file-based, ACID, single-file DB, synchronous reads. Existing lock code can be removed. | Single-server only. Not compatible with Vercel/serverless. |
| **Turso (libSQL)** | Medium-Large | Cloud-hosted SQLite, scales beyond single server, edge replicas. | New dependency, network latency, vendor lock-in. |
| **PostgreSQL via Prisma + Supabase** | Large | Full ACID, scales arbitrarily, rich query capabilities. | Highest effort, external service dependency, schema migration tooling needed. |

**Recommendation for TCE scale:** SQLite via `better-sqlite3` if deploying on a single VPS/VM (the most likely scenario). It eliminates all race conditions, provides ACID guarantees, and requires no external services. If Vercel deployment is required, Turso is the next best option.

**Files affected by migration:** `lib/dataStore.ts`, `lib/data/indexStore.ts`, `lib/data/fileAtomic.ts`, `lib/data/locks.ts`, `lib/data/wal.ts`, `lib/entries/internal/engine.ts`, `lib/storage.ts`, `lib/userStore.ts`, all test files in `tests/entries/`.

---

## 2. Authentication Assessment

### Configuration

- **Provider:** Google OAuth only (`lib/auth.ts`)
- **Session strategy:** JWT (no database sessions)
- **Domain restriction:** Only `@tce.edu` emails that exist in the faculty directory can sign in (`callbacks.signIn`)
- **Pages:** Custom sign-in page at `/signin`

### Session Access Patterns

- **Server components:** `getServerSession(authOptions)` — used correctly in page components
- **Client components:** `useSession()` from `next-auth/react` — used in `ShellClient.tsx`
- **API routes:** `getServerSession(authOptions)` — used in most routes
- **Middleware:** `getToken({ req: request })` — used for admin route protection

### Role-Based Access Control

- **Master admin:** Hardcoded email `senarch@tce.edu` in `lib/admin.ts`
- **Admin capabilities:** Extended via `lib/admin/roles.ts` and the `/api/me/admin-capabilities` endpoint
- **Middleware protection:** Only covers `/admin/*` and `/api/admin/*` routes
- **Engine-level:** `canApproveConfirmations()` checked in `engine.ts` for approval actions

### Security Gaps

1. **`/api/faculty` is completely unauthenticated.** No session check. Anyone can GET the full faculty list, POST new entries, PUT updates, or DELETE records. This is a **critical vulnerability**.

2. **`getServerSession()` called without `authOptions`** in 4 files: `app/api/me/avatar/route.ts`, `app/api/me/certificate/route.ts`, `app/api/file/route.ts`, `app/api/me/experience/certificate/route.ts`. Without `authOptions`, NextAuth may return the session but won't use the custom callbacks. This could be benign but is inconsistent and risky.

3. **No CSRF protection** beyond what NextAuth provides for its own routes. NextAuth v4 with JWT strategy has limited CSRF protection. API routes that accept POST/PUT/DELETE are potentially vulnerable to CSRF from other origins.

4. **No `.env.example`** exists. Required environment variables are undocumented. Based on code analysis, required vars are:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`

### Auth.js v5 Migration

Not urgent. NextAuth v4 works with App Router. Migration would involve:
- Changing import paths (`next-auth` -> `next-auth/next`)
- Using the new `auth()` helper instead of `getServerSession(authOptions)`
- Updating middleware to use `auth` wrapper
- Effort: Medium. ~20 files to update.

---

## 3. API Security Assessment

### Rate Limiting Coverage

Rate limiting exists (`lib/security/rateLimit.ts`) using an in-memory sliding window. Applied to **13 of 38 API routes**:

**Rate-limited:** File upload routes, entry commit, confirmation, telemetry, admin confirmations, admin export, file operations.

**NOT rate-limited:**
- `POST /api/me/fdp-attended` (create entry)
- `POST /api/me/fdp-conducted` (create entry)
- `POST /api/me/guest-lectures` (create entry)
- `POST /api/me/case-studies` (create entry)
- `POST /api/me/workshops` (create entry)
- `POST /api/me/reset` (account reset)
- `GET/PUT /api/me` (profile read/update)
- All `/api/faculty` endpoints (unauthenticated)
- `GET /api/debug/session` (session info)
- PDF generation routes

**Critical gap:** Entry creation routes have no rate limit. A user could flood the system with entries.

**In-memory limitation:** Rate limit state is lost on server restart and not shared across processes/instances.

### Input Validation

- **Payload size limits:** Enforced via `assertEntryMutationInput` (200KB max) and `assertActionPayload` (32KB max) in `lib/security/limits.ts`.
- **String length limits:** 5,000 chars per field, recursively checked.
- **Attachment limits:** Max 10 per entry.
- **Schema validation:** Category-specific Zod schemas exist in `data/schemas/`.
- **Gap:** The `/api/faculty` route does zero validation beyond checking 4 required fields. No size limits, no sanitization.

### Authorization (User Isolation)

All `/api/me/*` routes extract the email from `getServerSession()` and use it to scope file operations. Users cannot access other users' data through these routes because the email is derived from the JWT, not from request parameters.

**Exception:** Admin routes in `/api/admin/*` intentionally access other users' data but are protected by middleware.

### Streak Gaming

A user could potentially game the streak system by:
1. Creating entries rapidly (no rate limit on creation)
2. Manipulating `startDate`/`endDate` fields to trigger streak activation
3. However, streaks require `committedAtISO` (workflow commitment) which requires the entry to be complete, so the gaming surface is limited.

### Error Response Sanitization

Errors are normalized through `toUserMessage()` which strips internal details. Error codes are exposed (e.g., `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`) which is appropriate. Stack traces are not leaked.

---

## 4. Performance Assessment

### Dashboard Computation

The dashboard summary is computed via `getDashboardSummary()` in `lib/dashboard/getDashboardSummary.ts`.

**Caching:** Uses `unstable_cache` from Next.js with a per-user cache tag (`dashboard:<email>`). This means the first load computes, subsequent loads serve from cache until the tag is invalidated.

**Computation cost:** Reads ALL 5 category files, iterates every entry to compute status counts, streak snapshots, and recent entries. For a user with 50 entries across categories, this is ~5 file reads + O(n) iteration. Acceptable.

**Cache invalidation:** Tags are invalidated via `revalidateTag(getDashboardTag(email))` called after entry mutations in `engine.ts`.

### Streak Computation

Streaks are **fully recomputed** each time via `computeCanonicalStreakSnapshot()`. This iterates all entries and checks `isEntryCommitted` status. Not incremental.

**Double computation:** `updateIndexForEntryMutation` in `indexStore.ts:718` calls `buildStreakSnapshotFromStore` which reads ALL categories again (even though the entry mutation already has access to the data). This means every entry save triggers a full re-read of all categories just for streak computation.

### Index Store

The `indexStore` is a **persisted cache** (JSON file) that stores pre-computed aggregates. It is:
- Read from disk on access (`readIndexRaw`)
- Rebuilt from category stores if invalid or missing (`buildUserIndex`)
- Updated incrementally for simple count changes (`updateIndexForEntryMutation`)
- Fully rebuilt when counts go negative or edge cases are hit

**Not an in-memory cache.** Every access reads from disk. No module-level memoization.

### N+1 Patterns

- `buildStreakSnapshotFromStore` (indexStore.ts:244-256): Loops through ALL categories, reading each category store separately. 5 sequential file reads.
- `buildUserIndex` (indexStore.ts:400-447): Same pattern. 5 sequential file reads.
- `computeDashboardSummary` (getDashboardSummary.ts:180): Same pattern via `listEntriesForCategory`.

These are inherent to the file-based storage model. With SQLite, these would become single queries.

### Where Caching Would Help Most

1. **In-memory LRU for hot user indices** — avoid re-reading index.json on every API call
2. **Batch category reads** — read all 5 category files in parallel instead of sequentially
3. **Incremental streak computation** — avoid re-reading all categories on every mutation
4. **ISR for dashboard page** — the page is already using `unstable_cache`, but ISR would add a TTL

---

## 5. Frontend Architecture Assessment

### Server vs Client Components

**Server components (majority):**
- All page.tsx files in `app/(protected)/` except `account/page.tsx`
- Dashboard, data entry listing, help pages, admin pages

**Client components:**
- `app/signin/page.tsx` — needs form interaction
- `app/(protected)/account/page.tsx` — needs form interaction
- `app/ShellClient.tsx` — drawer, auth state, toast
- All adapter components in `components/data-entry/adapters/*.tsx` — form state management

**Split is reasonable.** The adapters are necessarily client-side due to complex form state. Pages correctly use server components for data fetching.

### Unnecessary "use client" Boundaries

- `app/(protected)/shell.tsx` has `"use client"` but is essentially a legacy file that duplicates `ShellClient.tsx`. Could be dead code.

### Code Splitting / Dynamic Imports

**None found.** No use of `next/dynamic` or `React.lazy`. The adapter components are large (~500-700 lines each) and could benefit from dynamic imports since only one is loaded per category page.

### Error Boundaries

**Present:**
- `app/error.tsx` — global error boundary (works)
- `app/(protected)/error.tsx` — protected routes error boundary
- `app/(protected)/admin/error.tsx` — admin error boundary

**Missing:**
- No error boundary for individual data entry forms. A crash in one adapter crashes the entire page.

### Loading States

**No `loading.tsx` files exist anywhere.** This means route transitions show no loading indicator. For server-component pages that do file I/O, this creates a poor UX.

**Recommended locations:**
- `app/(protected)/dashboard/loading.tsx`
- `app/(protected)/data-entry/loading.tsx`
- `app/(protected)/data-entry/[category]/loading.tsx`
- `app/(protected)/admin/loading.tsx`

### Client-Side State

Toast state in `ShellClient.tsx` and form state in adapters are appropriate client state. No issues found.

---

## 6. Testing Gap Analysis

### Coverage

14 test files, 73 tests total. All use Node.js built-in test runner.

| Module | Test File | Coverage |
|--------|-----------|----------|
| DataStore (read/write/upsert/delete) | `dataStore.test.ts` | Good |
| IndexStore (build/ensure/delta/mutation) | `indexStore.test.ts` | Good |
| State machine (status transitions) | `stateMachine.test.ts` | Good |
| Confirmation state machine | `confirmationStateMachine.test.ts` | Good |
| Entry lifecycle (create/update/delete/commit) | `lifecycle.test.ts` | Good |
| Streak progress | `streakProgress.test.ts` | Good |
| Streak state | `streak.test.ts` | Good |
| Normalization | `normalize.test.ts` | Good |
| Migrations | `migrations.test.ts` | Good |
| WAL events | `wal.test.ts` | Good |
| Search index | `searchIndex.test.ts` | Good |
| Backup service | `backupService.test.ts` | Good |
| Export service | `exportService.test.ts` | Good |
| Workflow smoke (end-to-end) | `workflowSmoke.test.ts` | Good |

### Gaps

- **No API route tests.** None of the 38 API routes have integration tests.
- **No UI/component tests.** No React component testing (no testing-library, no Playwright/Cypress).
- **No security tests.** No tests for rate limiting, payload validation, or authorization checks.
- **No CI pipeline.** No `.github/workflows/` directory exists. Tests only run locally.
- **Test helpers:** `tests/helpers/testDataRoot.ts` provides isolated tmp directories — well designed.

### Recommended CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
      - run: npm test
```

---

## 7. Deployment Readiness

### Vercel Compatibility

**The app CANNOT deploy to Vercel as-is.** Critical blockers:

1. **File-based storage is incompatible with serverless.** Vercel functions are stateless and ephemeral. The `.data/` directory would be wiped between invocations. All user data would be lost.

2. **In-memory rate limiting resets per invocation.** Each serverless function gets a fresh memory space. Rate limits provide zero protection.

3. **In-memory locks are useless.** The promise-chain lock in `locks.ts` only works within a single process. Serverless functions are independent processes.

4. **`unstable_cache` behavior differs.** On Vercel, `unstable_cache` uses the Vercel data cache, which works. But it depends on the data being readable, which fails without persistent storage.

### Minimum Viable Deployment Change

**For a single VPS (recommended for TCE):**
- Install Node.js 22+ on a Linux VM
- Run `npm run build && npm start`
- Use a reverse proxy (nginx/Caddy) for HTTPS
- Ensure `.data/` directory is on a persistent volume
- Set environment variables
- Everything works as-is

**For Vercel:**
- Migrate storage to SQLite (Turso) or PostgreSQL (Supabase) — Large effort
- Migrate rate limiting to Redis or Vercel KV — Medium effort
- Remove file-based locking — Small effort (done automatically with DB migration)

### Missing .env.example

No `.env.example` exists. Required variables:

```env
GOOGLE_CLIENT_ID=          # Google OAuth client ID
GOOGLE_CLIENT_SECRET=      # Google OAuth client secret
NEXTAUTH_SECRET=           # Random secret for JWT signing
NEXTAUTH_URL=              # Base URL (e.g., https://tseda.tce.edu)
```

---

## 8. Prioritized Action Plan

### Phase 0 - Blockers (must fix before ANY deployment)

| # | Action | Files | Effort | Risk if Skipped |
|---|--------|-------|--------|-----------------|
| 0.1 | **Authenticate `/api/faculty` route.** Currently fully open — anyone can read, create, update, or delete faculty records. Add `getServerSession(authOptions)` check + admin-only guard. | `app/api/faculty/route.ts` | Small | **Critical.** Data tampering, unauthorized access to faculty directory. |
| 0.2 | **Fix `getServerSession()` calls missing `authOptions`.** 4 routes call `getServerSession()` without passing `authOptions`, which may not apply custom callbacks. | `app/api/me/avatar/route.ts`, `app/api/me/certificate/route.ts`, `app/api/file/route.ts`, `app/api/me/experience/certificate/route.ts` | Small | **High.** Could allow non-@tce.edu users to access these endpoints if session validation differs. |
| 0.3 | **Create `.env.example`.** Document all required environment variables so deployment doesn't fail due to missing config. | `.env.example` (new) | Small | **High.** Deployment failure, leaked secrets if vars are guessed wrong. |
| 0.4 | **Remove or protect `/api/debug/session`.** Exposes session details. Should be disabled in production or admin-only. | `app/api/debug/session/route.ts` | Small | **Medium.** Information disclosure. |

### Phase 1 - Foundation (before adding features)

| # | Action | Files | Effort | Risk if Skipped |
|---|--------|-------|--------|-----------------|
| 1.1 | **Add rate limiting to entry creation routes.** The 5 category POST endpoints have no rate limit. Use existing `enforceRateLimitForRequest` with `RATE_LIMIT_PRESETS.entryMutations`. | `app/api/me/fdp-attended/route.ts`, `fdp-conducted/route.ts`, `guest-lectures/route.ts`, `case-studies/route.ts`, `workshops/route.ts` | Small | **Medium.** Users can flood the system with entries, growing files unboundedly. |
| 1.2 | **Add `loading.tsx` to key route segments.** Dashboard, data-entry, and admin routes do file I/O and show no loading state during navigation. | `app/(protected)/dashboard/loading.tsx`, `app/(protected)/data-entry/loading.tsx`, `app/(protected)/admin/loading.tsx` (new files) | Small | **Low.** Poor UX during navigation, blank screens. |
| 1.3 | **Set up CI pipeline (GitHub Actions).** Run `npm run build` and `npm test` on push/PR. | `.github/workflows/ci.yml` (new) | Small | **Medium.** Regressions can reach production undetected. |
| 1.4 | **Parallelize category file reads.** `buildUserIndex` and `computeDashboardSummary` read 5 category files sequentially. Use `Promise.all` to read in parallel. | `lib/data/indexStore.ts:405`, `lib/dashboard/getDashboardSummary.ts:180` | Small | **Low.** 5x slower than necessary for dashboard/index computation. |
| 1.5 | **Eliminate redundant streak rebuild.** `updateIndexForEntryMutation` calls `buildStreakSnapshotFromStore` which re-reads ALL categories. Instead, pass the already-known entries or skip streak recomputation for non-streak-affecting changes. | `lib/data/indexStore.ts:718` | Medium | **Low.** Wasted I/O on every entry mutation. |

### Phase 2 - Optimization (before scaling to full TCE)

| # | Action | Files | Effort | Risk if Skipped |
|---|--------|-------|--------|-----------------|
| 2.1 | **Migrate storage to SQLite.** Replace file-based JSON storage with `better-sqlite3`. Eliminates race conditions, enables proper queries, and removes the need for the index store as a cache layer. | `lib/dataStore.ts`, `lib/data/indexStore.ts`, `lib/data/fileAtomic.ts`, `lib/data/locks.ts`, `lib/data/wal.ts`, `lib/userStore.ts`, `lib/storage.ts`, all test files | Large | **High at scale.** File-based storage with in-memory locks will corrupt data under concurrent access from multiple processes. |
| 2.2 | **Add WAL rotation/compaction.** The WAL (`events.log`) grows unbounded. Add rotation (e.g., daily files) or compaction after reaching a size threshold. | `lib/data/wal.ts` | Medium | **Medium.** WAL files will grow to hundreds of MB per active user over time. |
| 2.3 | **Add API integration tests.** Test auth enforcement, rate limiting, input validation, and authorization for all API routes. | `tests/api/` (new directory) | Medium | **Medium.** Security regressions go undetected. |
| 2.4 | **Add CSRF protection.** API routes accepting mutations should validate `Origin` or `Referer` headers, or use a CSRF token pattern. | `lib/security/csrf.ts` (new), API routes | Medium | **Medium.** Cross-site request forgery attacks possible. |
| 2.5 | **Persistent rate limiting.** Replace in-memory rate limit buckets with a durable store (SQLite table or Redis) so limits survive restarts and work across processes. | `lib/security/rateLimit.ts` | Medium | **Low for single-server.** Rate limits reset on restart. |

### Phase 3 - Enhancement (can do alongside feature development)

| # | Action | Files | Effort | Risk if Skipped |
|---|--------|-------|--------|-----------------|
| 3.1 | **Dynamic imports for adapter components.** Each category adapter is 500-700 lines. Use `next/dynamic` to code-split them since only one loads per page. | `app/(protected)/data-entry/[category]/page.tsx` or parent layout | Small | **Low.** Slightly larger initial bundle. |
| 3.2 | **Migrate to Auth.js v5.** Cleaner API, better App Router integration, `auth()` helper replaces `getServerSession(authOptions)`. | `lib/auth.ts`, all API routes, middleware, providers | Medium | **None immediately.** NextAuth v4 works fine. |
| 3.3 | **Add component tests.** Set up Vitest + Testing Library for critical UI components (StatusBadge, EntryShell, form fields). | `vitest.config.ts`, `tests/components/` (new) | Medium | **Low.** UI regressions caught late. |
| 3.4 | **Clean up legacy shell.** `app/(protected)/shell.tsx` appears to be a legacy duplicate of `ShellClient.tsx`. Verify it's unused and remove. | `app/(protected)/shell.tsx` | Small | **None.** Dead code. |
| 3.5 | **Dark mode preparation.** Replace remaining hardcoded color values (e.g., `bg-white`, `text-slate-900`) with CSS variables or Tailwind semantic tokens. | Various component files | Medium | **None.** Cosmetic only. |
| 3.6 | **Add Playwright E2E tests.** Cover critical user flows: sign-in, create entry, submit for confirmation, admin approval. | `e2e/` (new directory), `playwright.config.ts` | Large | **Low.** Confidence gap for full user workflows. |

---

## Summary

The codebase has a solid internal architecture with good separation of concerns, canonical ownership patterns, and thorough unit test coverage for core modules. The most critical issues are:

1. **Security:** Unauthenticated `/api/faculty` endpoint, inconsistent `getServerSession()` usage
2. **Storage:** File-based storage with in-memory locks is a ticking time bomb for multi-process deployments
3. **Missing infrastructure:** No CI, no `.env.example`, no loading states, no rate limits on entry creation

For a single-VPS deployment serving TCE, fixing Phase 0 items is sufficient to go live safely. Phase 1 items should follow within the first week. Phase 2 (especially SQLite migration) should be completed before scaling beyond a single server process.
