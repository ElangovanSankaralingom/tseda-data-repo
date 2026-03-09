# TSEDA CODEBASE OVERHAUL — COMPLETE STRATEGY
## Production Readiness Plan
## Generated: March 9, 2026

---

# EXECUTIVE SUMMARY

TSEDA has a working prototype with significant architectural debt. The core data entry flow works, but the codebase has grown organically with duplicated logic, bypassed layers, missing modules, and inconsistent patterns. This document defines a phased overhaul to make the codebase robust, scalable, and production-ready.

**Current state**: ~500 files, ~200 TypeScript source files, build currently broken (missing `lib/users/service.ts`).

**Goal**: Every file communicates correctly with every other file. A change in one place propagates correctly everywhere. The system thinks as a network, not as isolated files.

---

# PART 1: DEEP ANALYSIS — WHAT'S ACTUALLY WRONG

## 1.1 THE FUNDAMENTAL ARCHITECTURAL PROBLEM

The app has a well-designed engine layer (`lib/entries/internal/engine.ts`) that correctly handles status transitions, edit windows, streak fields, and finalization. But the **5 category API routes bypass it entirely** and save directly to JSON files. This creates a shadow architecture where:

- Fields that engine.ts would set (editWindowExpiresAt, streakEligible, pdfGenerated) are missing from entries saved via routes
- `postSave.ts` was created as a band-aid to normalize at read-time
- Every bug fix has to be applied in **6 places** (engine.ts + 5 routes) instead of 1
- The dashboard reads data and has to re-normalize it because routes didn't save it correctly

**Root cause**: The routes were written first, then engine.ts was designed later. The routes were never refactored to use the engine.

**Impact**: This is the #1 source of bugs (items 1-8 in the bug list). Every future feature will hit this same wall.

## 1.2 THE FIVE-ROUTE DUPLICATION

Files involved:
- `app/api/me/fdp-attended/route.ts` (~1000 lines)
- `app/api/me/fdp-conducted/route.ts` (~1000 lines)
- `app/api/me/guest-lectures/route.ts` (~1000 lines)
- `app/api/me/case-studies/route.ts` (~1000 lines)
- `app/api/me/workshops/route.ts` (~1000 lines)

That's ~5000 lines of nearly identical code. Changes must be applied to all 5, and history shows they drift (one route gets a fix, another doesn't).

**What differs between routes**: Only the category key, field names, and validation schema. The CRUD operations, status transitions, PDF handling, streak logic, and response shapes are identical.

**Industry standard**: A single generic route handler parameterized by category, with category-specific logic delegated to the schema/registry.

## 1.3 THE FIVE-ADAPTER DUPLICATION

Same problem on the client side:
- `components/data-entry/adapters/fdp-attended.tsx`
- `components/data-entry/adapters/fdp-conducted.tsx`
- `components/data-entry/adapters/guest-lectures.tsx`
- `components/data-entry/adapters/case-studies.tsx`
- `components/data-entry/adapters/workshops.tsx`

These share 90%+ of their logic. Only field rendering differs.

## 1.4 GOD COMPONENTS

- `app/(protected)/account/page.tsx` — **74KB** (one file). This is likely rendering the entire account page with all sections, forms, and logic in a single component. Industry standard: max 300-500 lines per component.
- `app/ShellClient.tsx` — **23KB**. The app shell should delegate to smaller components.
- `components/admin/UserManagement.tsx` — Large enough to define its own types inline.

## 1.5 MISSING MODULE (BUILD BROKEN)

`lib/users/service.ts` does not exist. The admin users page imports `listAllUsers` and `getUserStats` from it. Build fails.

## 1.6 DATA IN VERSION CONTROL

The `.data/` directory contains runtime user data and is committed to git:
- `.data/users/*/` — actual user entries (JSON files with real faculty data)
- `.data/telemetry/events.log` — **2.4MB** telemetry log
- `.data/telemetry/summary.json` — **49KB** telemetry summary
- `.data/maintenance/` — maintenance logs and integrity history
- `.data/admin/` — admin user lists and notifications
- `.bak` files — backup files from data migrations

This violates basic security practices (user data in public repo), bloats the repo, and creates merge conflicts.

## 1.7 TYPE SYSTEM GAPS

From workflow.ts analysis:
- `EntryStateLike` uses `unknown` for every field — no type safety
- Transitions cast to `Record<string, unknown>` to set fields — bypasses TypeScript
- No single canonical `Entry` type that all layers agree on
- The component types (in UserManagement.tsx) define their own types inline instead of importing shared ones

## 1.8 STATUS MODEL CONFUSION

workflow.ts defines 6 statuses correctly: DRAFT, GENERATED, EDIT_REQUESTED, DELETE_REQUESTED, EDIT_GRANTED, ARCHIVED.

But the legacy migration path still handles:
- `PENDING_CONFIRMATION` → maps to GENERATED
- `APPROVED` → maps to GENERATED  
- `REJECTED` → maps to DRAFT
- Lowercase variants: `draft`, `final`, `pending`

Multiple normalization paths exist: `normalizeEntryStatus()` in workflow.ts, `mapLegacyStatus()` in types/entry.ts, and `postSave.ts` normalization. It's unclear which runs when.

## 1.9 TWO-STAGE FIELD MODEL NOT ENFORCED

The concept (Stage 1 = data fields affecting PDF, Stage 2 = uploads not affecting PDF) exists in developer knowledge but is not codified:
- No TypeScript types distinguish Stage 1 from Stage 2 fields
- `getHashPayload` in pdfSnapshot.ts manually excludes upload fields — if a new upload field is added, someone must remember to exclude it
- No schema-level annotation marks which fields are Stage 1 vs Stage 2

## 1.10 SECURITY GAPS (from AUDIT.md)

- `/api/faculty` — **completely unauthenticated** (anyone can read/write the faculty directory)
- `getServerSession()` called without `authOptions` in 4 files
- Entry creation routes have no rate limiting
- No CSRF protection beyond NextAuth defaults
- In-memory rate limiting lost on restart, not shared across processes

## 1.11 TESTING GAPS

Test files exist in `tests/entries/` but coverage is unclear. Key untested areas:
- The 5 category routes (the most bug-prone code) have no route-level tests
- Streak activation/win conditions across the full stack
- PDF staleness computation
- Timer expiration and auto-archive
- Request edit/delete flow end-to-end

## 1.12 CRON / BACKGROUND JOBS NOT IMPLEMENTED

The context handoff lists these as pending:
- Auto-archive (timer expired, no valid PDF)
- 24-hour warnings before timer expiry
- Edit grant expiry
- WAL compaction
- Telemetry cleanup

`app/api/cron/nightly/route.ts` exists but its implementation scope is unclear.

## 1.13 CLIENT-SERVER FIELD CONTRACT

When a route saves an entry and returns it to the client, the client spreads the response into form state. If the server omits a field, the client won't have it. This has caused bugs (items 5, 6, 7 in bug list). There's no shared contract (TypeScript type or Zod schema) that guarantees what the server returns.

---

# PART 2: THE OVERHAUL STRATEGY

## GUIDING PRINCIPLES

1. **Single source of truth** — Every concept lives in exactly one place
2. **Change propagation** — Edit one file, and the system stays consistent
3. **Type safety end-to-end** — Server response shape matches client expectations, enforced by TypeScript
4. **Fail fast** — Missing fields, wrong statuses, and invalid transitions crash loudly in dev, not silently in production
5. **Incremental delivery** — Each phase produces a working, deployable app

---

## PHASE 0: EMERGENCY FIXES (Day 1)
### Goal: App builds and runs

**P0.1 — Create `lib/users/service.ts`** (build is broken)
- Implement `listAllUsers()` and `getUserStats()`
- Read from `.data/users/` directory + profile data
- Match the types in `UserManagement.tsx`
- Estimated: 1 prompt, ~100 lines

**P0.2 — Gitignore `.data/` and telemetry**
- Add `.data/` to `.gitignore`
- Remove tracked `.data/` files from git: `git rm -r --cached .data/`
- Remove `.bak` files from repo
- Estimated: 1 prompt, ~10 lines

**P0.3 — Secure `/api/faculty`**
- Add `getServerSession(authOptions)` check
- Add admin guard for write operations
- Estimated: 1 prompt, ~20 lines

### Verification:
```bash
npm run build  # must pass
git status     # .data/ not tracked
curl -X GET localhost:3000/api/faculty  # returns 401 without auth
```

---

## PHASE 1: CANONICAL TYPE SYSTEM (Days 2-3)
### Goal: One Entry type to rule them all

**P1.1 — Define the canonical Entry type**

Create `lib/types/entry.ts` (or enhance existing) with:

```typescript
// Stage 1: Data fields (affect PDF hash)
interface EntryDataFields {
  programName: string;
  startDate: string;
  endDate: string;
  organisingBody: string;
  supportAmount?: number;
  academicYear: string;
  // ... category-specific fields via generics
}

// Stage 2: Upload fields (do NOT affect PDF hash)
interface EntryUploadFields {
  permissionLetter?: string;
  completionCertificate?: string;
}

// Lifecycle fields (managed by engine, not user-editable)
interface EntryLifecycleFields {
  id: string;
  category: CategoryKey;
  ownerEmail: string;
  confirmationStatus: EntryStatus;
  createdAt: string;
  updatedAt: string;
  committedAtISO?: string;
  editWindowExpiresAt?: string;
  generatedAt?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string;
  pdfUrl?: string;
  pdfSourceHash?: string;
  pdfStale?: boolean;
  streakEligible?: boolean;
  streakPermanentlyRemoved?: boolean;
  permanentlyLocked?: boolean;
  // Request fields
  editRequestedAt?: string;
  editRequestMessage?: string;
  editGrantedAt?: string;
  editGrantedBy?: string;
  editGrantedDays?: number;
  deleteRequestedAt?: string;
  requestType?: 'edit' | 'delete';
  requestCount?: number;
  archivedAt?: string;
  archiveReason?: string;
}

type Entry = EntryDataFields & EntryUploadFields & EntryLifecycleFields;
```

**P1.2 — Define the API response contract**

```typescript
// What the server MUST return after any mutation
type EntryApiResponse = Entry & {
  // Computed fields the client needs
  isEditable: boolean;
  isFinalized: boolean;
  editTimeRemaining: EditTimeRemaining;
};
```

**P1.3 — Annotate Stage 1 vs Stage 2 in schemas**

In each category schema (`data/schemas/*.ts`), add:
```typescript
{
  fieldName: 'permissionLetter',
  stage: 2,  // Does not affect PDF hash
  kind: 'file',
}
```

Then `getHashPayload` reads from the schema instead of hardcoding exclusions.

### Verification:
```bash
npm run typecheck  # zero errors
```

---

## PHASE 2: UNIFIED ROUTE HANDLER (Days 4-7)
### Goal: Eliminate the 5-route duplication — THE single biggest improvement

**P2.1 — Create `app/api/me/[category]/route.ts`**

A single dynamic route that handles ALL categories:

```typescript
// app/api/me/[category]/route.ts
export async function GET(req, { params }) {
  const category = validateCategory(params.category);
  const session = await requireAuth(req);
  return handleListEntries(session.user.email, category);
}

export async function POST(req, { params }) {
  const category = validateCategory(params.category);
  const session = await requireAuth(req);
  const body = await req.json();
  const schema = getCategorySchema(category);
  const validated = schema.validate(body);
  return handleCreateEntry(session.user.email, category, validated);
}

// PATCH, DELETE similarly
```

The key functions (`handleCreateEntry`, `handleUpdateEntry`, etc.) live in a new `lib/api/entryHandlers.ts` that:
- Calls `engine.ts` for all mutations (no more bypass)
- Returns the canonical `EntryApiResponse` type
- Handles PDF generation, streak computation, postSave normalization in one place

**P2.2 — Migrate each old route to the unified handler**

Do this one category at a time:
1. Make fdp-attended use the unified handler
2. Test thoroughly
3. Migrate fdp-conducted
4. ... and so on
5. Delete the 5 old route files

**P2.3 — Create `components/data-entry/adapters/GenericAdapter.tsx`**

A single adapter component that renders category-specific fields based on the schema:

```typescript
function GenericAdapter({ category, entryId }) {
  const schema = getCategorySchema(category);
  return (
    <EntryEditor category={category} entryId={entryId}>
      {schema.fields.map(field => (
        <FieldRenderer key={field.name} field={field} />
      ))}
    </EntryEditor>
  );
}
```

### Verification:
```bash
npm run build
# Test each category: create → edit → generate → finalise → request edit → view
# Dashboard streak counts still correct
```

---

## PHASE 3: ENGINE AS SINGLE ENTRY POINT (Days 8-10)
### Goal: All mutations flow through engine.ts — no more bypass

**P3.1 — Remove direct JSON writes from route handlers**

Currently routes do:
```typescript
// BAD (current): route reads JSON, modifies, writes back
const store = JSON.parse(await fs.readFile(path));
store.byId[id] = { ...store.byId[id], ...updates };
await atomicWrite(path, JSON.stringify(store));
```

After unification:
```typescript
// GOOD (target): route calls engine, engine handles persistence
const result = await engine.updateEntry(email, category, id, updates);
return NextResponse.json(result);
```

**P3.2 — Engine returns complete EntryApiResponse**

Engine computes all derived fields before returning:
- `isEditable` from workflow.ts
- `isFinalized` from workflow.ts
- `editTimeRemaining` from workflow.ts
- `pdfStale` from pdfSnapshot.ts
- Streak fields from postSave normalization

This means the client ALWAYS gets a complete, correct entry. No more missing fields.

**P3.3 — Remove postSave.ts read-time normalization**

Once all mutations go through the engine, entries are saved correctly. postSave.ts becomes unnecessary. Remove it.

### Verification:
```bash
# Create entry via each category
# Check .data/users/senarch@tce.edu/*.json — all fields present
# grep -c "postSave" lib/ app/ — should be zero (or deprecated only)
```

---

## PHASE 4: BREAK UP GOD COMPONENTS (Days 11-13)
### Goal: No file exceeds 500 lines

**P4.1 — Split `account/page.tsx` (74KB)**

Extract into:
- `components/account/ProfileSection.tsx`
- `components/account/SecuritySection.tsx`
- `components/account/DataSection.tsx`
- `components/account/ExperienceSection.tsx`
- `components/account/AccountPageShell.tsx`

**P4.2 — Split `ShellClient.tsx` (23KB)**

Extract into:
- `components/shell/Navigation.tsx`
- `components/shell/Sidebar.tsx`
- `components/shell/NotificationBell.tsx`
- `components/shell/UserMenu.tsx`
- `components/shell/SearchBar.tsx`

**P4.3 — Split `UserManagement.tsx`**

Types → `lib/types/admin.ts`
Filters → `components/admin/UserFilters.tsx`
User card → `components/admin/UserCard.tsx`
Stats → `components/admin/UserStatsGrid.tsx`

### Verification:
```bash
wc -l components/**/*.tsx | sort -rn | head -20
# No file exceeds 500 lines
```

---

## PHASE 5: SECURITY HARDENING (Days 14-15)
### Goal: Production-safe auth and input validation

**P5.1 — Fix all auth gaps**
- Add `authOptions` to all `getServerSession()` calls (4 files identified in audit)
- Add auth + admin guard to `/api/faculty` (all methods)
- Add rate limiting to entry creation routes

**P5.2 — Add CSRF protection**
- Add `origin` header validation for state-changing requests
- Or upgrade to NextAuth v5 which has better built-in CSRF

**P5.3 — Input validation on all routes**
- Ensure all POST/PATCH routes validate with Zod schemas
- Add payload size limits to any routes missing them
- Sanitize all user input before storage

**P5.4 — Remove `.data/` from git history**
```bash
git filter-branch --tree-filter 'rm -rf .data' HEAD
# Or use BFG Repo Cleaner for speed
```

### Verification:
```bash
# Attempt unauthenticated access to all routes — all return 401
# Attempt oversized payloads — all return 413
# .data/ not in any git commit
```

---

## PHASE 6: BACKGROUND JOBS & CRON (Days 16-18)
### Goal: Automated lifecycle management

**P6.1 — Implement cron/nightly tasks**
- Auto-archive: entries where timer expired + no valid PDF
- 24-hour warning: entries expiring within 24 hours → user notification
- Edit grant expiry: EDIT_GRANTED entries past their window → revert to GENERATED
- WAL compaction: truncate WAL files older than 30 days

**P6.2 — Implement notification system**
- User notifications (entry about to expire, edit granted, etc.)
- Admin notifications (new edit/delete requests, entries archived)
- Bell icon in shell with unread count

**P6.3 — Implement proper error recovery**
- WAL replay on startup (detect incomplete writes)
- Index rebuild on corruption detection
- Graceful handling of missing/corrupt JSON files

### Verification:
```bash
# Trigger nightly cron
# Check entries with expired timers are archived
# Check notifications created
```

---

## PHASE 7: TESTING (Days 19-22)
### Goal: 80%+ coverage on critical paths

**P7.1 — Route-level integration tests**
- Test the unified route handler with each category
- Test all status transitions end-to-end
- Test streak activation and win conditions
- Test PDF generation and staleness

**P7.2 — Engine unit tests**
- Every function in engine.ts has a test
- Every transition in workflow.ts has a test
- Edge cases: timer exactly at boundary, concurrent requests, corrupt data

**P7.3 — Client-server contract tests**
- Verify API response matches EntryApiResponse type
- Verify client correctly handles all status states
- Verify button enablement matches server-side rules

### Verification:
```bash
npm test
# All tests pass
# Coverage report shows 80%+ on lib/entries/, lib/streakProgress.ts, lib/pdfSnapshot.ts
```

---

## PHASE 8: PERFORMANCE & OBSERVABILITY (Days 23-25)
### Goal: Fast, measurable, debuggable

**P8.1 — Eliminate redundant reads**
- Dashboard currently reads ALL 5 category files per user per load
- Add proper index-based reads (read index.json first, only read category files if needed)
- Cache dashboard computation per-user with proper invalidation

**P8.2 — Reduce streak computation cost**
- Currently recomputes ALL entries every time
- Move to incremental: on mutation, update only the affected entry's streak state
- Store streak snapshot in index.json (already exists but may be stale)

**P8.3 — Add structured logging**
- Replace `console.log` with structured logger
- Log every mutation with: user, category, entryId, action, timestamp
- Add request timing to API routes

**P8.4 — Add health check endpoint**
```typescript
// app/api/health/route.ts
// Returns: storage accessible, entry count, last mutation time
```

---

## PHASE 9: FINAL POLISH (Days 26-28)
### Goal: Clean, documented, deployable

**P9.1 — Dead code removal**
- Remove deprecated wrappers: `lib/entries/stateMachine.ts`, `lib/entries/engine.ts` (the old one), `lib/gamification.ts`
- Remove unused exports
- Remove commented-out code

**P9.2 — Documentation sync**
- Run `upmd` to update all MDs
- Ensure CLAUDE.md reflects final architecture
- Update API.md with unified route

**P9.3 — Deployment prep**
- Create production `.env` template
- Add proper NODE_ENV checks
- Verify build output is clean
- Create deployment runbook

---

# PART 3: DEPENDENCY MAP — HOW FILES CONNECT

## The Critical Chain (change any of these → ripple everywhere)

```
lib/types/entry.ts (Entry type, EntryStatus)
    ↓ imported by
lib/entries/workflow.ts (transitions, editability, finalization)
    ↓ imported by
lib/entries/internal/engine.ts (persistence, validation)
    ↓ imported by
lib/entries/lifecycle.ts (public API)
    ↓ imported by
app/api/me/[category]/route.ts (HTTP layer)
    ↓ returns JSON to
hooks/useEntryEditor.ts (client form state)
    ↓ feeds data to
components/entry/EntryActionsBar.tsx (button rendering)
```

If you change the Entry type → you must verify every link in this chain.

## The Streak Chain

```
lib/streakProgress.ts (business rules)
    ↓ reads from
lib/entries/postSave.ts (normalization)
    ↓ called by
lib/dashboard/getDashboardSummary.ts (dashboard data)
    ↓ displayed by
app/(protected)/dashboard/page.tsx (UI)
```

## The PDF Chain

```
lib/pdfSnapshot.ts (hash computation, staleness)
    ↓ used by
lib/pdf/pdfService.ts (generation, persistence)
    ↓ called by
app/api/me/entry/generate/route.ts (HTTP trigger)
    ↓ result consumed by
hooks/useEntryEditor.ts (pdfState in form)
    ↓ drives
components/entry/EntryActionsBar.tsx (Generate/Finalise button visibility)
```

## The Category Chain

```
data/categoryRegistry.ts (category definitions)
    ↓ read by
data/schemas/*.ts (field definitions, validation)
    ↓ used by
app/api/me/[category]/route.ts (validation, storage)
    ↓ and by
components/data-entry/adapters/*.tsx (field rendering)
    ↓ and by
lib/entryCategorization.ts (entry grouping)
    ↓ and by
lib/export/exportService.ts (export columns)
```

---

# PART 4: PROMPT DELIVERY PLAN

Each phase will be broken into Claude Code prompts following the Prompt Engineering Framework:

| Phase | # Prompts | Lines/Prompt | Risk |
|-------|-----------|-------------|------|
| P0: Emergency | 3 | 50-80 | Low |
| P1: Types | 3 | 80-150 | Low |
| P2: Unified Route | 6 | 100-200 | HIGH (most impactful) |
| P3: Engine Unification | 4 | 100-150 | HIGH |
| P4: Component Split | 4 | 80-120 | Medium |
| P5: Security | 4 | 50-100 | Medium |
| P6: Cron & Notifications | 5 | 80-150 | Medium |
| P7: Testing | 5 | 100-200 | Low |
| P8: Performance | 3 | 80-120 | Low |
| P9: Polish | 3 | 50-80 | Low |
| **TOTAL** | **~40 prompts** | | |

Each prompt will follow the framework: Task Type, Priority, Context, Read First, Implementation, Associations, Scope, Verification.

---

# PART 5: SUCCESS METRICS

After the overhaul, these must all be true:

1. **`npm run build`** passes with zero warnings
2. **`npm run typecheck`** passes — no `any` types in critical paths
3. **No file exceeds 500 lines** (excluding generated code)
4. **Category routes**: exactly 1 route file handles all 5 categories
5. **Category adapters**: exactly 1 adapter or <5 thin wrappers around a shared core
6. **All mutations flow through engine.ts** — grep for direct JSON writes returns zero hits outside engine
7. **postSave.ts read-time normalization removed** — fields are correct at write-time
8. **`.data/` not in git** — `git ls-files .data/` returns nothing
9. **All API routes authenticated** — no unauthenticated endpoints except auth itself
10. **Test coverage 80%+** on `lib/entries/`, `lib/streakProgress.ts`, `lib/pdfSnapshot.ts`
11. **Dashboard loads in <500ms** for a user with 50 entries
12. **Zero `Record<string, unknown>` casts** in workflow transitions

---

# NEXT STEP

Say **"phase 0"** and I'll generate the 3 Claude Code prompts for the emergency fixes.

Say **"phase N"** for any specific phase.

Say **"all prompts"** and I'll generate every prompt for the full overhaul sequentially.
