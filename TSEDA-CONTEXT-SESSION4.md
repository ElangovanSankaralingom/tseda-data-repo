# TSEDA PROJECT — CONTEXT HANDOFF (Session 3 → Session 4)
## Upload this file at the start of the new chat
## Last updated: March 10, 2026

---

## PROJECT

**TSEDA** = Gamified faculty data collection app for TCE (Thiagarajar College of Engineering), Madurai.
Faculty log professional activities (FDPs attended/conducted, guest lectures, case studies, workshops).
Gamified with streak system to encourage timely submissions.

**Current state: Production-ready. Audit score 8.8/10. UX redesign in progress.**

---

## REPO & SETUP

- **GitHub**: https://github.com/ElangovanSankaralingom/tseda-data-repo
- **Branch**: `main` only (no worktrees, no dev branch)
- **Working dir**: `/Users/thya/tseda-data-repo`
- **Stack**: Next.js 16.1.6 (Turbopack), React 19, Tailwind CSS 4, shadcn/ui, NextAuth.js 4 (Google OAuth @tce.edu), TypeScript 5, file-based JSON storage, pdf-lib
- **Master admin**: senarch@tce.edu
- **Tests**: 352 tests, 0 failures, 21 test files
- **Docker**: Dockerfile + docker-compose.yml ready
- **CI/CD**: GitHub Actions (ci.yml + release.yml)

### Repo Access URLs (paste at start of new chat)
```
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/PROMPT-ENGINEERING-FRAMEWORK.md
https://api.github.com/repos/ElangovanSankaralingom/tseda-data-repo/git/trees/main?recursive=1
```
Read any file: `https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/<filepath>`

---

## TWO-STAGE FIELD MODEL (CRITICAL — must understand)

### Stage 1 — Primary Fields (Before Generate)
- Data fields: program name, dates, organising body, academic year, semester, etc.
- These go INTO the PDF document
- Changing stage 1 after generate → "Document outdated" (pdfStale)
- All required stage 1 fields must be filled before Generate Entry is enabled
- Hash: `pdfSourceHash = hash(stage 1 fields only)`

### Stage 2 — Secondary Fields (After Generate)
- File uploads: permission letter, completion certificate, photos
- NOT part of the PDF
- Visible only AFTER Generate Entry succeeds
- Uploading/deleting stage 2 files NEVER triggers "Document outdated"
- Stage 2 completion required for Finalise and streak "win"

### Progress Bar Behavior
- Before generate: "3 of 7 required fields" (stage 1 only)
- After generate: "7 of 9 fields — upload supporting documents" (stage 1 + stage 2)

### Button States
| State | Save | Generate | Preview/Download | Finalise |
|-------|------|----------|-----------------|----------|
| Empty form | ❌ | ❌ | ❌ | ❌ |
| Stage 1 partial | ✅ | ❌ | ❌ | ❌ |
| Stage 1 complete | ✅ | ✅ | ❌ | ❌ |
| PDF generated, stage 2 empty | ✅ | ❌ | ✅ | ❌ (greyed) |
| PDF generated, all complete | ✅ | ❌ | ✅ | ✅ |
| Stage 1 changed after generate | ✅ | ✅ | ❌ | ❌ |

---

## ENTRY STATUSES (6)

```
DRAFT → GENERATED → EDIT_REQUESTED → EDIT_GRANTED → GENERATED (re-finalized)
                  → DELETE_REQUESTED → ARCHIVED
```

### View Mode Rules
- EDIT_REQUESTED → stays in view mode (read-only) until admin approves
- DELETE_REQUESTED → stays in view mode until admin approves
- EDIT_GRANTED → switches to edit mode
- After finalise (edit window expired) → view mode, Request Action dropdown available

### Request Action Rules (CURRENTLY BEING FIXED)
- User can request edit OR delete (one at a time)
- After request sent → dropdown replaced by "Cancel Request" button immediately
- Cannot send duplicate requests (optimistic UI via requestEditStatus: "pending")
- Request Action dropdown hidden during pending requests
- Finalise button disabled during pending requests

---

## ARCHITECTURE

### Unified Route Handler
`lib/api/categoryRouteHandler.ts` — single shared handler for all 5 categories
- POST = create new entry
- PATCH = update existing entry (also handles action dispatch: generate, finalise, request_edit, etc.)
- 5 route files at `app/api/me/*/route.ts` — 25-line thin wrappers

### Entry Persistence (createPersistProgress)
`lib/entries/adapterOrchestration.ts` — `createPersistProgress`:
- Uses `POST` for new entries (no `createdAt`)
- Uses `PATCH` for existing entries
- After persist, `normalizePersistedEntry` recomputes `pdfSourceHash` from server response to prevent false stale

### Engine (Single Entry Point)
ALL mutations: `lib/entries/internal/engine.ts` (barrel with modules)
Public API: `lib/entries/lifecycle.ts`

### Key Frontend Components
- `components/data-entry/adapters/BaseEntryAdapter.tsx` — shared adapter base
- `components/data-entry/CategoryEntryPageShell.tsx` — page layout
- `components/data-entry/EditorProgressHeader.tsx` — progress bar (simplified)
- `components/data-entry/EditorStatusBanner.tsx` — status strip
- `components/data-entry/EntryDocumentSection.tsx` — compact document bar
- `components/entry/EntryActionsBar.tsx` — action buttons (generate, finalise, save)
- `components/entry/RequestActionDropdown.tsx` — request edit/delete dropdown
- `hooks/useEntryEditor.ts` — form state + pdfState computation
- `hooks/useRequestEdit.ts` — request edit with optimistic UI
- `hooks/useEntrySaveOrchestration.ts` — save orchestration
- `hooks/useEntryGenerateAndFinalise.ts` — generate + finalise
- `hooks/useCategoryEntryPageController.ts` — main controller composing all hooks
- `lib/pdfSnapshot.ts` — hash computation, stage 2 exclusion, staleness
- `lib/generateEntryPipeline.ts` — generate flow (persist draft → call generate API)
- `lib/entries/adapterOrchestration.ts` — createPersistProgress (POST/PATCH logic)

### Security
- CSRF, file validation, sanitization, rate limiting, security headers
- `lib/security/csrf.ts`, `lib/security/fileValidation.ts`, `lib/security/sanitize.ts`

### Schema System
- `data/schemas/*.ts` — field definitions with `stage: 1` / `stage: 2`
- `data/categoryRegistry.ts` — category config
- `lib/validation/schemaValidator.ts` — schema-driven validation

---

## WHAT WAS DONE THIS SESSION

### Overhaul (P0-P9, T1-T9, F1-F4, H1-H5, MEGA-1/2)
Complete codebase overhaul from 5.4 → 8.8 audit score. See repo docs for full history.

### Bug Fixes (this session)
1. ✅ **ESLint**: Fixed all 162 errors/warnings (pre-commit hook was blocking)
2. ✅ **POST vs PATCH**: `createPersistProgress` now uses POST for new entries, PATCH for updates
3. ✅ **DateField null value**: `value={value || ""}` prevents controlled/uncontrolled warnings
4. ✅ **False "Document outdated"**: `normalizePersistedEntry` recomputes `pdfSourceHash` from server response
5. ✅ **Finalise during EDIT_REQUESTED**: `isViewMode` stays true for EDIT_REQUESTED/DELETE_REQUESTED
6. ✅ **Finalise before all fields complete**: Added allFieldsComplete check + disabledReason
7. ✅ **Progress bar extends after generate**: Shows stage 1 count before generate, stage 1+2 after

### UX Redesign (this session)
- Simplified EntryDocumentSection to compact inline bar
- Simplified EditorProgressHeader (removed phase pills, reduced to thin bar)
- Redesigned finalise confirmation dialog (neutral tones, not green)
- Removed lock overlay / blur on locked forms — fields just disabled
- Removed pendingCoreLocked amber banner

### A11y Fixes
- Multiple rounds of axe-core contrast fixes
- Added aria-labels to unlabeled inputs
- Some contrast issues remain (text-slate-500 on bg-slate-100, text-amber-700 on bg-amber-50)

---

## CURRENTLY IN PROGRESS (FIX THESE NEXT)

### 1. Duplicate Request Actions (IMMEDIATE)
**Bug**: After clicking "Request Edit" in view mode, user can click it again causing server error.
**Root cause**: `entryStatus` doesn't update immediately (optimistic `requestEditStatus: "pending"` isn't passed to the dropdown condition).
**Fix needed**: Pass `editRequestPending`/`deleteRequestPending` to HeaderEntryActionsBar → use them in the `hasPendingRequest` check so dropdown hides immediately after request sent.
**Files**: 
- `components/entry/EntryActionsBar.tsx` — pass pending props to condition
- `components/data-entry/adapters/BaseEntryAdapter.tsx` — pass `form.requestEditStatus === "pending"` to header
- `components/entry/entryComponentTypes.ts` — add props to type

### 2. Remaining A11y Issues (LOW PRIORITY)
- text-slate-500/600 on bg-slate-100 (ratio ~4.34, needs 4.5) → darken to text-slate-700
- text-amber-700 on bg-amber-50 (ratio 3.48) → darken to text-amber-900
- 1 unlabeled input somewhere

### 3. Future Date vs Past Date Entry Behavior (NOT YET STARTED)
User wants to define and verify behavior for entries with past dates vs future dates. Haven't started this yet.

---

## PENDING WORK (AFTER FIXES)

### BFG Purge
`.data/` already clean in git history — BFG found "no dirty commits". Verified: `git ls-files .data/` returns 0.

### MEGA Prompts (3-10)
MEGA-3 through MEGA-10 were absorbed into MEGA-1/2. All features present (verified by audit).

### Future Projects
1. SQLite migration — DataLayer abstraction ready
2. PWA / Mobile
3. Multi-instance scaling (Redis, S3, job queue)

---

## HOW TO CONTINUE

1. Start new Claude chat
2. Upload this context file
3. Paste repo access URLs:
   ```
   https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/PROMPT-ENGINEERING-FRAMEWORK.md
   https://api.github.com/repos/ElangovanSankaralingom/tseda-data-repo/git/trees/main?recursive=1
   ```
4. Say: "Fix the duplicate request action bug first, then we'll test the full flow"
5. After each fix: `npm run build && git add -A && git commit -m "description" && git push origin main`

---

## AUDIT SCORES (March 10, 2026)

| Category | Score |
|----------|-------|
| Project Structure | 9.0 |
| Environment & Config | 9.0 |
| Security | 9.0 |
| Error Handling | 9.5 |
| Code Quality | 9.0 |
| Type Safety | 9.5 |
| Async & Concurrency | 9.5 |
| Testing | 9.5 |
| Observability | 9.0 |
| Git | 9.0 |
| CI/CD | 9.0 |
| Dependencies | 9.0 |
| Frontend | 9.0 |
| API Design | 8.5 |
| Storage | 8.5 |
| Third-Party | 8.5 |
| Scalability | 7.0 |
| Mobile | 4.0 |
| **OVERALL** | **8.8** |
