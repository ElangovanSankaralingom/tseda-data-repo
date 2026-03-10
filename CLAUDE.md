# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read DESIGN_SYSTEMS.md before making any UI/styling changes. It defines the canonical color palette, component patterns, card styles, status badge styles, typography, animations, and page layout templates for the entire app.

## Critical Rules

1. **Five Category Route Rule:** Any change to one API route or adapter must apply to ALL FIVE categories (fdp-attended, fdp-conducted, guest-lectures, case-studies, workshops). Never change just one.

2. **Routes bypass engine.ts:** The 5 category API routes (`app/api/me/<category>/route.ts`) handle their own field normalization and do not go through `lib/entries/internal/engine.ts` for all operations. `lib/entries/postSave.ts` is the normalization workaround -- it runs after saves to ensure streak fields and PDF state are consistent.

3. **Two-stage field model:**
   - **Stage 1 (data fields):** Text fields, dates, selections -- these affect PDF staleness. Changing a Stage 1 field marks the PDF as stale (pdfStale = true).
   - **Stage 2 (file uploads):** Permission letters, certificates, photos -- these do NOT affect PDF staleness. Uploading or removing files never marks the PDF as stale.

4. **Master admin email:** `senarch@tce.edu` (hardcoded in `lib/admin.ts`).

## Documentation

Read the relevant doc before making changes in that area.

| File | When to read |
|------|-------------|
| `ARCHITECTURE.md` | Before changing any module ownership, data flow, or adding new features -- canonical ownership rules |
| `DESIGN_SYSTEMS.md` | Before any UI/styling changes -- color palette, component patterns, typography, animations, layout templates |
| `DATA_MODEL.md` | Before changing file storage, JSON schema, or data migration -- documents the file-based storage structure |
| `API.md` | Before adding/modifying API endpoints -- lists all routes with auth, rate-limit, and request/response formats |
| `STREAK-SPECIFICATION.md` | Before changing streak logic -- two checkpoints, activated/win conditions, permanent removal |
| `PROMPT-ENGINEERING-FRAMEWORK.md` | Prompt standards and context handoff format for Claude Code sessions |
| `tseda-url-index.md` | Auto-generated index of all files in the repo with GitHub URLs |
| `CONTRIBUTING.md` | For workflow, commit conventions, and PR checklist |
| `AUDIT.md` | For known issues and prioritized action plan -- check before starting work to avoid duplicating effort |
| `CHANGELOG.md` | Version history -- update when shipping user-visible changes |
| `DEPLOY.md` | Deployment guide -- env vars, data directory, cron setup, production checklist |
| `README.md` | Project overview, setup instructions, and tech stack |

## Project Overview

TCE faculty data collection app -- a Next.js 16 application (App Router) for collecting and managing faculty professional development entries (FDPs attended/conducted, case studies, guest lectures, workshops). Uses file-based JSON storage (no database), Google OAuth via NextAuth, and Tailwind CSS 4 with shadcn/ui components.

## Commands

- **Dev server:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Type check:** `npm run typecheck`
- **Run all tests:** `npm test`
- **Run a single test:** `NODE_ENV=test node --test --experimental-strip-types --experimental-loader ./tests/helpers/pathAliasLoader.mjs tests/entries/<testfile>.test.ts`

Tests use Node's built-in test runner (`node --test`), not Jest or Vitest. The `@/` path alias is resolved via a custom loader in `tests/helpers/pathAliasLoader.mjs`.

## Architecture

Read **ARCHITECTURE.md** for the full canonical architecture freeze document. Key points below.

### Data Storage

File-based JSON -- no database. User data lives in `.data/users/<email>/` with per-category JSON store files. Uploads go to `public/uploads/<email>/`. Atomic file writes and user-level file locks protect concurrent access (`lib/data/fileAtomic.ts`, `lib/data/locks.ts`).

### Auth

Google OAuth restricted to `@tce.edu` emails, gated by a faculty directory lookup (`data/faculty.json`). Config in `lib/auth.ts`.

### Category System

Categories are registry-driven via `data/categoryRegistry.ts`. Each category has a schema in `data/schemas/<category>.ts` implementing the `EntrySchema` contract (`data/schemas/types.ts`). Current categories: fdp-attended, fdp-conducted, case-studies, guest-lectures, workshops.

### Entry Workflow States

Six canonical uppercase states: `DRAFT`, `GENERATED`, `EDIT_REQUESTED`, `DELETE_REQUESTED`, `EDIT_GRANTED`, `ARCHIVED`. Defined in `lib/types/entry.ts`, transitions enforced in `lib/entries/workflow.ts`.

Transitions:
- `DRAFT` -> `GENERATED` (via Generate PDF / commit)
- `GENERATED` -> `EDIT_REQUESTED` (user requests edit on finalized entry)
- `GENERATED` -> `DELETE_REQUESTED` (user requests deletion)
- `EDIT_REQUESTED` -> `EDIT_GRANTED` (admin grants edit)
- `EDIT_GRANTED` -> `GENERATED` (user re-finalizes after editing)
- `DELETE_REQUESTED` -> `ARCHIVED` (admin approves deletion)

### Entry Lifecycle

Entries have a timer system that controls the finalization window:
- **Non-streak entries:** 3-day edit window from first GENERATED transition
- **Streak entries:** endDate + 8 days edit window
- Timer never resets once set (stored in `editWindowExpiresAt`)
- When timer expires, entry auto-finalizes (becomes read-only)
- Users can click "Finalise Now" to finalize before timer expires

### Permanently Locked

After second finalization (entry was EDIT_GRANTED, user re-generates), `permanentlyLocked = true`:
- Request Edit is BLOCKED
- Request Delete is ALWAYS available
- Entry cannot be edited again

### Key Module Ownership (anti-drift rules)

| Change needed | Edit this module |
|---|---|
| Workflow transitions/rules | `lib/entries/workflow.ts` |
| Server-side lifecycle (create/update/commit/approve) | `lib/entries/lifecycle.ts` + `lib/entries/internal/engine.ts` |
| Engine internals (split modules) | `lib/entries/internal/engine*.ts` (engineWrite, engineRead, engineCommit, engineAdmin, engineRequests, engineMutationRunner, engineHelpers) |
| Post-save normalization (streak fields, PDF state) | `lib/entries/postSave.ts` |
| PDF staleness detection and hash computation | `lib/pdfSnapshot.ts` |
| Streak/progress business rules | `lib/streakProgress.ts` |
| Export pipeline | `lib/export/exportService.ts` |
| Category definitions | `data/categoryRegistry.ts` + `data/schemas/*.ts` |
| Navigation helpers | `lib/entryNavigation.ts` |
| Nightly maintenance pipeline | `lib/jobs/nightly.ts` (orchestrator) |
| Background jobs (auto-archive, edit grant expiry, timer warnings) | `lib/jobs/autoArchive.ts`, `lib/jobs/editGrantExpiry.ts`, `lib/jobs/timerWarning.ts` |
| WAL compaction | `lib/jobs/walCompaction.ts` + `lib/maintenance/walCompact.ts` |
| Persistent notifications | `lib/confirmations/notificationStore.ts` + `lib/confirmations/notificationHelpers.ts` |
| Dashboard summary (with index fast path) | `lib/dashboard/getDashboardSummary.ts` |
| Structured logging | `lib/logger.ts` |

**Legacy modules (do not add new business logic):**
- `lib/entries/editorLifecycle.ts` -- legacy editor action-state rules

### Category Pages

Pages at `app/(protected)/data-entry/<category>/` are thin composition shells. They use shared controller hooks (`hooks/useCategoryEntryPageController.ts`, `hooks/useEntryWorkflow.ts`) and shared shell components (`components/data-entry/CategoryEntryPageShell.tsx`, `components/data-entry/EntryListCardShell.tsx`, `components/data-entry/GroupedEntrySections.tsx`). Pages own only category-specific field rendering and payload shaping.

### API Routes

User-facing routes under `app/api/me/<category>/` using canonical lifecycle operations. Admin routes under `app/api/admin/`. File upload routes at `app/api/me/file/` and category-specific file routes.

### Adding a New Category

Run `./scripts/add-category.sh <slug> "<Label>"` to scaffold all files, then:

1. Edit schema in `data/schemas/<category>.ts` — add fields
2. Register in `data/categoryRegistry.ts` — add to `CATEGORY_SLUGS` + registry
3. Flesh out adapter in `components/data-entry/adapters/<category>.tsx`
4. `npm run build` and `./scripts/verify-categories.sh`
5. Add tests
