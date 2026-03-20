> **Note:** This document is from Session 5. See TSEDA-CONTEXT-SESSION6.md for the latest handoff.

# TSEDA PROJECT — CONTEXT HANDOFF (Session 5 → Session 6)
## Upload this file at the start of the new chat
## Last updated: March 20, 2026

---

## HOW TO START A NEW CHAT

1. Upload this file (TSEDA-CONTEXT-SESSION5.md)
2. Point Claude to `~/tseda-data-repo/CLAUDE.md` for full architecture docs
3. Run `npm run build` to verify clean state before making changes

---

## PROJECT

**TSEDA** = Gamified faculty data collection app for TCE (Thiagarajar College of Engineering), Madurai.
Faculty log professional activities across 5 categories. The app gamifies data entry with a streak system and timed edit windows.

- **Stack:** Next.js 16 (Turbopack, App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, NextAuth.js 4 (Google OAuth, @tce.edu only), file-based JSON storage with DataLayer abstraction (SQLite-ready)
- **Working directory:** `~/tseda-data-repo`
- **Master admin:** `senarch@tce.edu`
- **Build:** `npm run build` (must pass before every commit)
- **Tests:** `npm test` (Node.js built-in test runner)
- **Audit score:** 9.7/10

---

## CURRENT STATE OF ALL 5 CATEGORIES

All categories share these patterns:
- **Sponsored pattern:** Sponsored (Yes/No) dropdown. When "Yes" is selected, shows Funding Agency (text) + Funding Amount (currency). Conditionally validated in adapter.
- **Multi-upload:** ALL upload fields are `FileMeta[]` arrays (no single-upload `FileMeta | null`). All stored top-level on entries (no nested `uploads` object).
- **Coordinator:** Read-only display of current user. Co-coordinators via FacultyPickerRows with API-based search.
- **Hydration:** Universal hydration utility (`lib/entries/hydrateEntry.ts`) ensures old entries with missing/removed fields don't crash.
- **Icons:** Level (Flag/Globe), Mode (Monitor/Building2), Semester (CloudSun/Sun), Sponsored (Banknote/BanknoteX) dropdowns have icons.

### FDP Attended
- **Stage 1:** academicYear, semesterType, level, mode, startDate, endDate, programName, organisingBody, sponsored, fundingAgency, fundingAmount
- **Stage 2:** permissionLetter[], completionCertificate[]
- **Title:** programName | **Subtitle:** organisingBody

### FDP Conducted
- **Stage 1:** academicYear, semesterType, level, mode, startDate, endDate, programName, coordinatorName/Email, coCoordinators, sponsored, fundingAgency, fundingAmount
- **Stage 2:** permissionLetter[], geotaggedPhotos[], attendanceSheet[], numberOfParticipants, officialPoster[]
- **Title:** programName | **Subtitle:** coordinator info

### Guest Lectures
- **Stage 1:** academicYear, semesterType, level, mode, startDate, endDate, topicOfLecture, guestSpeakerName, guestSpeakerDesignation, guestSpeakerOrganisation, coordinatorName/Email, coCoordinators, sponsored, fundingAgency, fundingAmount
- **Stage 2:** permissionLetter[], geotaggedPhotos[], attendanceSheet[], officialPoster[], numberOfParticipants
- **Title:** topicOfLecture | **Subtitle:** speaker info

### Case Studies
- **Stage 1:** academicYear, yearOfStudy, currentSemester, startDate, endDate, placeOfVisit, purposeOfVisit, coordinatorName/Email, staffAccompanying, sponsored, fundingAgency, fundingAmount
- **Stage 2:** permissionLetter[], travelPlan[], geotaggedPhotos[], report[], feedback[], advanceClosure[], numberOfParticipants
- **Note:** Only category that keeps yearOfStudy + currentSemester (with academic progression helpers)
- **Title:** placeOfVisit | **Subtitle:** purposeOfVisit

### Workshops
- **Stage 1:** academicYear, semesterType, level, mode, startDate, endDate, workshopName, resourcePersonName, resourcePersonDesignation, resourcePersonOrganisation, coordinatorName/Email, coCoordinators, sponsored, fundingAgency, fundingAmount
- **Stage 2:** permissionLetter[], geotaggedPhotos[], attendanceSheet[], officialPoster[], numberOfParticipants
- **Title:** workshopName | **Subtitle:** resource person info

---

## ARCHITECTURE DECISIONS FROM SESSION 5

### Upload Model
- All uploads are `FileMeta[]` arrays stored as top-level entry fields
- No nested `uploads` object for any category
- `categoryFileHandler.ts` has `nested: false` for all categories
- Upload slots defined in schema with `kind: "array", upload: true, stage: 2`
- `OMIT_FROM_PDF` set includes all upload field keys
- Client-side validation: 20MB max, .pdf/.jpg/.jpeg/.png only

### Data Resilience
- `lib/entries/hydrateEntry.ts` provides safe defaults for all field types
- Each adapter's `hydrateEntry` function migrates old field names and formats
- Old `supportAmount` migrated to `fundingAmount` where applicable
- Old nested uploads migrated to top-level arrays
- Old single `FileMeta | null` migrated to `FileMeta[]`

### Navigation & Freshness
- `NavigationRefresh` component in protected layout handles pathname changes, focus, visibility, bfcache
- `closeForm` uses `window.location.href` for full page reload on form close
- Cache-busting `_t=` param on all API fetches
- `useEffect` re-fetches list when `activeEntryId` transitions to empty

### Completion & Streaks
- `completionChecker.ts`: array check (`kind === "array"`) runs BEFORE upload/object check
- `streakProgress.ts`: streak win only checks `required !== false` fields (optional fields don't block)

### Security & UX
- beforeunload guard with `hasUnsavedChanges` check
- Auto-save retry: 3 attempts with 1s/3s/10s backoff, persistent warning banner after 3 failures
- Error boundary wraps form fields only (list stays visible)
- Skeleton cards during initial load
- Toast: 4s errors, 1.5s success, dismiss button, ARIA roles
- Rate limiter: fixed-window counters, 10K bucket cap, 60s prune interval
- Backup ZIP verification via magic bytes check

### Accessibility
- SelectDropdown: full ARIA combobox, keyboard nav, Home/End/Space
- Entry cards: tabIndex, Enter/Space, focus-visible ring
- Skip navigation link
- WCAG AA contrast on all status badges and timestamps
- RequestActionDropdown: role="menu", arrow keys, auto-focus

---

## KEY FILES CREATED IN SESSION 5

| File | Purpose |
|------|---------|
| `lib/entries/hydrateEntry.ts` | Universal entry hydration (safe defaults, migration) |
| `lib/constants/messages.ts` | Centralized user-facing strings |
| `lib/api/apiResponse.ts` | Shared API response helpers |
| `lib/jobs/orphanFileCleanup.ts` | Orphan upload file detection (nightly) |
| `components/ErrorBoundaryFallback.tsx` | Form area error boundary with retry |
| `components/NavigationRefresh.tsx` | Global route refresh on nav/focus/bfcache |
| `components/NetworkStatus.tsx` | Offline/online status banner |
| `components/data-entry/EntryListSkeleton.tsx` | Loading skeleton cards |
| `tests/validation/categorySchemas.test.ts` | Schema validation tests (all 5 categories) |
| `tests/entries/hydrateEntry.test.ts` | Hydration utility tests |
| `tests/api/uploadSlots.test.ts` | Upload slot consistency tests |

---

## PENDING / NEXT STEPS

1. **Test coverage** — Add tests for remaining code paths (adapters, workflow transitions)
2. **SQLite migration** — DataLayer abstraction is ready (`lib/data/dataLayer.ts` + `sqliteDataLayer.ts` stub). See `DATABASE-MIGRATION.md`
3. **i18n** — `lib/constants/messages.ts` is the i18n extraction point if Tamil support is needed
4. **PWA / mobile app** — Viewport meta set, touch targets at 44px, responsive layouts done
5. **Orphan cleanup** — Currently report-only. Enable auto-delete after validation period
6. **PDF template updates** — New fields (topicOfLecture, resourcePerson*, etc.) auto-appear in PDF via schema-driven buildPdfData

---

## COMMUNICATION STYLE

- Direct, command-first prompts work best
- Pipe prompts via `cat << 'PROMPT' | claude`
- Always end with `npm run build`
- No emojis in UI (project rule)
- Work only on `main` branch
- Push after every change: `git add -A && git commit -m "description" && git push origin main`
