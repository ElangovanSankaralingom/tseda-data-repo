# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-03-09

Backend hardening, background jobs, testing, and performance.

### Added
- Nightly maintenance pipeline with 7 steps: backup, integrity, housekeeping, auto-archive, edit grant expiry, timer warnings, WAL compaction
- Auto-archive cron job for GENERATED entries with expired edit windows and no valid PDF
- Edit grant expiry job to revert stale EDIT_GRANTED entries to GENERATED
- Timer warning notifications for entries within 24h of expiry
- WAL compaction with 30-day retention for per-user and telemetry event logs
- Persistent notification system (`notificationStore.ts`) with 5 notification types: edit_granted, edit_rejected, delete_approved, auto_archived, timer_warning
- Health check endpoint (`GET /api/health`) -- unauthenticated, returns storage/user/version status
- Admin maintenance dashboard with individual job controls and action history
- Split engine internals into focused modules (engineWrite, engineRead, engineCommit, engineAdmin, engineRequests, engineMutationRunner, engineHelpers)
- Comprehensive test suite: 77 engine tests, 24 workflow tests, 13 streak tests, 32 API response tests
- Custom ESM test loader (`tests/helpers/pathAliasLoader.mjs`) for `@/` alias and `.ts` extension resolution
- Dashboard fast path via pre-computed UserIndex (skips 5 category file reads)
- Structured JSON logger (`lib/logger.ts`) with level filtering, key redaction, `withTimer` utility

### Changed
- Dashboard computation uses UserIndex fast path when available, falls back to full category reads
- All engine mutations invalidate dashboard cache via `revalidateTag`

### Removed
- `lib/entries/stateMachine.ts` -- deprecated wrapper (imports migrated to `workflow.ts`/`editorLifecycle.ts`)
- `lib/entries/engine.ts` -- deprecated wrapper (imports migrated to `internal/engine.ts`)
- `lib/gamification.ts` -- deprecated wrapper (imports migrated to `streakState.ts`/`streakTiming.ts`/`time.ts`)

## [0.2.0] - 2026-03-09

Entry lifecycle overhaul, streak system, and finalization flow.

### Added
- Six-status entry lifecycle: DRAFT -> GENERATED -> EDIT_REQUESTED/DELETE_REQUESTED -> EDIT_GRANTED -> ARCHIVED
- Streak system with two checkpoints: Generate PDF (Activated) and Finalise (Win)
- PDF generation with staleness detection (Stage 1 fields only)
- Finalise Now flow with confirmation dialog
- Timer system (3 days non-streak, endDate+8 days streak)
- View mode for finalized entries
- Request Edit / Request Delete dropdown
- Permanently locked after second finalization
- postSave.ts normalization workaround for route bypass
- Entry grouping (locked_in, streak_runners, on_the_clock, unlocked, under_review, in_the_works)
- Dashboard streak journey funnel
- tseda-url-index.md for repo file access
- PROMPT-ENGINEERING-FRAMEWORK.md
- STREAK-SPECIFICATION.md

### Fixed
- pdfGenerated field never being set by API routes
- editWindowExpiresAt set to NOW instead of future
- File uploads incorrectly triggering PDF staleness
- Dashboard showing 0 streaks due to missing field normalization
- Finalized entries showing Edit/Delete instead of View/Request
- Finalise Now always disabled due to missing PDF checks

### Changed
- Entry statuses changed from DRAFT/PENDING_CONFIRMATION/APPROVED/REJECTED to DRAFT/GENERATED/EDIT_REQUESTED/DELETE_REQUESTED/EDIT_GRANTED/ARCHIVED
- Removed dev branch, working directly on main
- Cleaned up phantom git worktrees

## [0.1.0] - 2026-03-07

Initial architecture documentation and infrastructure hardening.

### Features

- **5 data categories:** FDP Attended, FDP Conducted, Case Studies, Guest Lectures, Workshops
- **Entry workflow:** DRAFT -> GENERATED with timer-based finalization and request/grant lifecycle
- **Gamification:** Streak tracking and progress visualization across categories
- **File uploads:** Permission letters, certificates, geotagged photos, brochures per category
- **PDF generation:** Per-entry PDF reports via pdf-lib
- **Export pipeline:** Schema-driven CSV/XLSX export for admin
- **Admin panel:** Confirmation management, faculty directory, data export
- **Google OAuth:** NextAuth v4 with `@tce.edu` domain restriction and faculty directory lookup
- **File-based storage:** JSON stores with atomic writes, per-user locking, write-ahead log

### Infrastructure

- Rate limiting on entry creation and file upload routes
- Loading skeletons for dashboard, data-entry, and admin pages
- Parallelized category file reads in index and dashboard computation
- Eliminated redundant streak rebuild in entry mutation path
- GitHub Actions CI pipeline (build + test)
- Authentication on all API routes, admin guards on mutation endpoints
- `.env.example` for onboarding

### Documentation

- ARCHITECTURE.md — canonical ownership rules and anti-drift policy
- DESIGN_SYSTEMS.md — UI/UX patterns, color system, component specs
- CONTRIBUTING.md — branch workflow, commit conventions, PR checklist
- DATA_MODEL.md — file-based storage structure and formats
- API.md — all API endpoints with auth and rate-limit status
- AUDIT.md — security and architecture audit with phased action plan
- CLAUDE.md — AI assistant guidance

---

## Template for Future Entries

```markdown
## [X.Y.Z] - YYYY-MM-DD

Brief summary of the release.

### Added
- New features

### Changed
- Changes to existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features

### Security
- Security-related changes
```
