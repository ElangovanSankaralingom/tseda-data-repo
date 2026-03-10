# TSEDA PROJECT — CONTEXT HANDOFF (Session 4 → Session 5)
## Upload this file at the start of the new chat
## Last updated: March 10, 2026

---

## PROJECT

**TSEDA** = Gamified faculty data collection app for TCE (Thiagarajar College of Engineering), Madurai.
Faculty log professional activities (FDPs attended/conducted, guest lectures, case studies, workshops).
Gamified with streak system to encourage timely submissions.

**Current state: Production-ready. Audit score 8.8/10. UX redesign complete.**

---

## REPO & SETUP

- **GitHub**: https://github.com/ElangovanSankaralingom/tseda-data-repo
- **Branch**: `main` only (no worktrees, no dev branch)
- **Working dir**: `/Users/thya/tseda-data-repo`
- **Stack**: Next.js 16.1.6 (Turbopack), React 19, Tailwind CSS 4, shadcn/ui, NextAuth.js 4 (Google OAuth @tce.edu), TypeScript 5, file-based JSON storage, pdf-lib
- **Master admin**: senarch@tce.edu
- **Tests**: 352 tests, 0 failures, 21 test files (Node built-in test runner, NOT Jest)
- **Docker**: Dockerfile + docker-compose.yml ready
- **CI/CD**: GitHub Actions (ci.yml + release.yml)

### Repo Access URLs (paste at start of new chat)
```
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/PROMPT-ENGINEERING-FRAMEWORK.md
https://api.github.com/repos/ElangovanSankaralingom/tseda-data-repo/git/trees/main?recursive=1
```
Read any file: `https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/<filepath>`

### Commands
```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm test             # All tests
```

---

## TWO-STAGE FIELD MODEL (CRITICAL — must understand)

### Stage 1 — Primary Fields (Before Generate)
- Data fields: program name, dates, organising body, academic year, semester, etc.
- These go INTO the PDF document
- Changing stage 1 after generate → "Document outdated" (pdfStale)
- All required stage 1 fields must be filled before Generate Entry is enabled
- Hash: `pdfSourceHash = hash(stage 1 fields only)` — computed by `hashPrePdfFields()` in `lib/pdfSnapshot.ts`

### Stage 2 — Secondary Fields (After Generate)
- File uploads: permission letter, completion certificate, photos
- NOT part of the PDF — excluded from hash via `getStage2FieldKeys()`
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

## ENTRY STATUSES (6) & WORKFLOW

```
DRAFT → GENERATED → (EDIT_REQUESTED → EDIT_GRANTED → GENERATED)
                  → (DELETE_REQUESTED → ARCHIVED | GENERATED)
                  → ARCHIVED (auto, timer expired without valid PDF)
```

Canonical statuses defined in `lib/types/entry.ts`. Transitions enforced in `lib/entries/workflow.ts`.

**Finalization is computed, not a status**: a GENERATED entry is "finalized" when `editWindowExpiresAt` has passed AND it has a valid PDF. No explicit FINALIZED status exists.

**Edit window**: Default 3 days after generation. Streak entries get `endDate + 8 days` (whichever is later).

### View Mode Rules
- EDIT_REQUESTED → stays in view mode (read-only) until admin approves
- DELETE_REQUESTED → stays in view mode until admin approves
- EDIT_GRANTED → switches to edit mode (new timer from grant date)
- After finalise (edit window expired) → view mode, Request Action dropdown available

### Request Action Rules (CURRENTLY BEING FIXED)
- User can request edit OR delete (one at a time), max 3/month
- After request sent → dropdown replaced by "Cancel Request" button immediately
- Cannot send duplicate requests (optimistic UI via requestEditStatus: "pending")
- Request Action dropdown hidden during pending requests
- Finalise button disabled during pending requests

---

## ARCHITECTURE (read ARCHITECTURE.md for full freeze document)

### Canonical Source-of-Truth Modules
| Concern | Canonical Module |
|---------|-----------------|
| Workflow transitions/rules | `lib/entries/workflow.ts` |
| Editor Save/Generate/Done availability | `lib/entries/editorLifecycle.ts` |
| Server-side lifecycle operations | `lib/entries/lifecycle.ts` + `lib/entries/internal/engine.ts` |
| Streak/progress business rules | `lib/streakProgress.ts` |
| Dashboard summary | `lib/dashboard/getDashboardSummary.ts` |
| Export pipeline | `lib/export/exportService.ts` |
| Category definitions | `data/categoryRegistry.ts` + `data/schemas/*.ts` |
| PDF hash/staleness | `lib/pdfSnapshot.ts` |
| Entry list grouping | `lib/entryCategorization.ts` |
| Navigation helpers | `lib/entryNavigation.ts` |

### Anti-Drift Rules
- **Do NOT** add business logic to deprecated wrappers: `lib/entries/stateMachine.ts`, `lib/entries/engine.ts`, `lib/gamification.ts`
- If code and ARCHITECTURE.md disagree, fix the code or update the doc deliberately

### Data Storage
File-based JSON — no database. User data in `.data/users/<email>/` with per-category JSON files. Atomic writes via temp file + rename (`lib/data/fileAtomic.ts`). In-process promise-chain locks per user (`lib/data/locks.ts`). WAL for audit trail (`lib/data/wal.ts`).

### Category Store Format (v2)
```json
{ "version": 2, "byId": { "<id>": { ... } }, "order": ["<id>", ...] }
```

### 5 Categories (MUST stay in sync)
1. fdp-attended
2. fdp-conducted
3. case-studies
4. guest-lectures
5. workshops

Each has: schema in `data/schemas/*.ts`, API route at `app/api/me/*/route.ts`, adapter at `components/data-entry/adapters/*.tsx`, file upload route at `app/api/me/*-file/route.ts`.

**RULE**: If a change applies to one category, it applies to ALL FIVE.

### Key Frontend Components
- `components/data-entry/adapters/*.tsx` — 5 category adapters (thin, category-specific)
- `components/data-entry/CategoryEntryPageShell.tsx` — page layout
- `components/data-entry/GroupedEntrySections.tsx` — entry list with 6-group system + filter tabs
- `components/data-entry/EditorProgressHeader.tsx` — progress bar (simplified)
- `components/data-entry/EditorStatusBanner.tsx` — status strip
- `components/data-entry/EntryDocumentSection.tsx` — compact document bar
- `components/entry/EntryActionsBar.tsx` — action buttons (generate, finalise, save, request actions)
- `components/entry/RequestActionDropdown.tsx` — request edit/delete dropdown (already accepts `editRequestPending`/`deleteRequestPending` props)

### Key Hooks
- `hooks/useCategoryEntryPageController.ts` — main controller composing all sub-hooks
- `hooks/useEntryWorkflow.ts` — workflow state (coreDirty, lifecycle stages)
- `hooks/useEntrySaveOrchestration.ts` — save, auto-save, unsaved changes
- `hooks/useEntryGenerateAndFinalise.ts` — generate + finalise
- `hooks/useEntryRequestActions.ts` — request edit/delete + confirmation
- `hooks/useRequestEdit.ts` — request edit with optimistic UI

### Entry List System (6 Groups)
`lib/entryCategorization.ts` — `groupEntriesForList()`:
1. **streak_runners** — streak-eligible, PDF generated, not finalized
2. **on_the_clock** — GENERATED, editable, not streak-eligible
3. **unlocked** — EDIT_GRANTED
4. **in_the_works** — DRAFT
5. **under_review** — EDIT_REQUESTED
6. **locked_in** — finalized

Sort: `sortByUrgency()` — edit-window entries first (expiring soonest), then newest-first by updatedAt → createdAt fallback.

### Streak System
- **Activated** = streak-eligible + GENERATED + pdfGenerated + not finalized + not permanently removed
- **Win** = streak-eligible + all mandatory fields + valid PDF + finalized + not permanently removed
- Checkpoint 1: Generate PDF → gate to Activated (endDate must be future)
- Checkpoint 2: Finalise → gate to Win
- End date → past on save: immediate Activated removal (recoverable)
- Request on Win: permanent removal
- Archive/restore: permanent removal

---

## WHAT WAS DONE IN PREVIOUS SESSIONS

### Session 3: Major Overhaul (P0-P9, T1-T9, F1-F4, H1-H5, MEGA-1/2)
Complete codebase overhaul from 5.4 → 8.8 audit score. Bug fixes (ESLint 162 errors, POST/PATCH, DateField null, false pdfStale, finalise guards, progress bar). UX redesign (compact document section, thin progress bar, neutral finalise dialog, removed lock overlay). A11y fixes (contrast, aria-labels).

### Session 4: Entry List Sort Fix + Repo Mapping
1. ✅ **Entry card sort order**: Fixed `sortByUrgency` in `lib/entryCategorization.ts` — added `createdAt` fallback and `!==` guard on `updatedAt` so newest entries always appear on top within each group section.
2. ✅ **Full repo file mapping**: Generated 401 raw URLs for all source files.

---

## CURRENTLY IN PROGRESS (FIX THESE NEXT)

### 1. Duplicate Request Actions (IMMEDIATE)
**Bug**: After clicking "Request Edit" in view mode, user can click it again before `entryStatus` updates, causing server error.
**Root cause**: `HeaderEntryActionsBar` checks `entryStatus === "EDIT_REQUESTED"` for `hasPendingRequest`, but status doesn't update until after the API call completes. The optimistic `requestEditStatus: "pending"` from `useRequestEdit` isn't being threaded through.
**Good news**: `RequestActionDropdown.tsx` already accepts `editRequestPending` and `deleteRequestPending` props and handles `hasPending` correctly. The `getHeaderActionProps` in `useCategoryEntryPageController.ts` also accepts these props. The gap is in:
1. The adapters — they're not passing `editRequestPending`/`deleteRequestPending` when calling `getHeaderActionProps()`
2. `HeaderEntryActionsBar` — its `hasPendingRequest` check uses only `entryStatus`, not the pending props
3. `HeaderEntryActionsBar` — it doesn't pass `editRequestPending`/`deleteRequestPending` to `RequestActionDropdown`

**Fix needed** (3 places):
- `components/entry/EntryActionsBar.tsx` (`HeaderEntryActionsBar`) — read `editRequestPending`/`deleteRequestPending` from props, include in `hasPendingRequest`, pass to `RequestActionDropdown`
- All 5 adapters — pass `editRequestPending: form.requestEditStatus === "pending"`, `deleteRequestPending: form.deleteRequestStatus === "pending"` to `getHeaderActionProps()`
- Type file where `HeaderEntryActionsBarProps` is defined — add `editRequestPending?: boolean; deleteRequestPending?: boolean`

### 2. Remaining A11y Issues (LOW PRIORITY)
- text-slate-500/600 on bg-slate-100 (ratio ~4.34, needs 4.5) → darken to text-slate-700
- text-amber-700 on bg-amber-50 (ratio 3.48) → darken to text-amber-900
- 1 unlabeled input somewhere

### 3. Future Date vs Past Date Entry Behavior (NOT YET STARTED)
User wants to define and verify behavior for entries with past dates vs future dates.

---

## PENDING WORK (AFTER FIXES)

### BFG Purge
`.data/` already clean in git history — BFG found "no dirty commits". Verified.

### Future Projects
1. SQLite migration — DataLayer abstraction ready
2. PWA / Mobile
3. Multi-instance scaling (Redis, S3, job queue)

---

## REPO DOCUMENTATION MAP
| Doc | Purpose |
|-----|---------|
| `ARCHITECTURE.md` | Canonical architecture freeze — module ownership, anti-drift rules |
| `CLAUDE.md` | Claude Code instructions — commands, key modules, adding categories |
| `DESIGN_SYSTEMS.md` | UI/styling canon — colors, components, typography, animations |
| `DATA_MODEL.md` | File storage structure, JSON schemas, WAL, locking, migrations |
| `API.md` | All API routes with auth, rate-limit, request/response formats |
| `PROMPT-ENGINEERING-FRAMEWORK.md` | How to write Claude Code prompts for this project |
| `AUDIT.md` | Known issues and prioritized action plan |
| `CONTRIBUTING.md` | Branch workflow, commit conventions, PR checklist |

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
