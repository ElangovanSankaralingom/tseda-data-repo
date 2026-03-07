# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read DESIGN_SYSTEMS.md before making any UI/styling changes. It defines the canonical color palette, component patterns, card styles, status badge styles, typography, animations, and page layout templates for the entire app.

## Documentation

Read the relevant doc before making changes in that area.

| File | When to read |
|------|-------------|
| `ARCHITECTURE.md` | Before changing any module ownership, data flow, or adding new features — canonical ownership rules |
| `DESIGN_SYSTEMS.md` | Before any UI/styling changes — color palette, component patterns, typography, animations, layout templates |
| `DATA_MODEL.md` | Before changing file storage, JSON schema, or data migration — documents the file-based storage structure |
| `API.md` | Before adding/modifying API endpoints — lists all routes with auth, rate-limit, and request/response formats |
| `CONTRIBUTING.md` | For branch workflow, commit conventions, and PR checklist |
| `AUDIT.md` | For known issues and prioritized action plan — check before starting work to avoid duplicating effort |
| `CHANGELOG.md` | Version history — update when shipping user-visible changes |
| `README.md` | Project overview, setup instructions, and tech stack |

## Project Overview

TCE faculty data collection app — a Next.js 16 application (App Router) for collecting and managing faculty professional development entries (FDPs attended/conducted, case studies, guest lectures, workshops). Uses file-based JSON storage (no database), Google OAuth via NextAuth, and Tailwind CSS 4 with shadcn/ui components.

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

File-based JSON — no database. User data lives in `.data/users/<email>/` with per-category JSON store files. Uploads go to `public/uploads/<email>/`. Atomic file writes and user-level file locks protect concurrent access (`lib/data/fileAtomic.ts`, `lib/data/locks.ts`).

### Auth

Google OAuth restricted to `@tce.edu` emails, gated by a faculty directory lookup (`data/faculty.json`). Config in `lib/auth.ts`.

### Category System

Categories are registry-driven via `data/categoryRegistry.ts`. Each category has a schema in `data/schemas/<category>.ts` implementing the `EntrySchema` contract (`data/schemas/types.ts`). Current categories: fdp-attended, fdp-conducted, case-studies, guest-lectures, workshops.

### Entry Workflow States

Canonical uppercase states only: `DRAFT`, `PENDING_CONFIRMATION`, `APPROVED`, `REJECTED`. Defined in `lib/types/entry.ts`, transitions enforced in `lib/entries/workflow.ts`. Legacy lowercase values are normalized at the migration boundary only.

### Key Module Ownership (anti-drift rules)

| Change needed | Edit this module |
|---|---|
| Workflow transitions/rules | `lib/entries/workflow.ts` |
| Editor Save/Generate/Done availability | `lib/entries/editorLifecycle.ts` |
| Server-side lifecycle (create/update/commit/approve) | `lib/entries/lifecycle.ts` + `lib/entries/internal/engine.ts` |
| Streak/progress business rules | `lib/streakProgress.ts` |
| Export pipeline | `lib/export/exportService.ts` |
| Category definitions | `data/categoryRegistry.ts` + `data/schemas/*.ts` |
| Navigation helpers | `lib/entryNavigation.ts` |

**Do not** add new business logic to deprecated wrappers: `lib/entries/stateMachine.ts`, `lib/entries/engine.ts`, `lib/gamification.ts`.

### Category Pages

Pages at `app/(protected)/data-entry/<category>/` are thin composition shells. They use shared controller hooks (`hooks/useCategoryEntryPageController.ts`, `hooks/useEntryWorkflow.ts`) and shared shell components (`components/data-entry/CategoryEntryPageShell.tsx`, `components/data-entry/EntryListCardShell.tsx`, `components/data-entry/GroupedEntrySections.tsx`). Pages own only category-specific field rendering and payload shaping.

### API Routes

User-facing routes under `app/api/me/<category>/` using canonical lifecycle operations. Admin routes under `app/api/admin/`. File upload routes at `app/api/me/file/` and category-specific file routes.

### Adding a New Category

1. Create schema in `data/schemas/<category>.ts` implementing `EntrySchema`
2. Register in `data/categoryRegistry.ts`
3. Add page at `app/(protected)/data-entry/<category>/page.tsx` (use shared shells)
4. Add API route(s) under `app/api/me/<category>/`
5. Add tests
