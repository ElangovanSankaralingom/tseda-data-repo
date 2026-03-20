# TSEDA PROJECT — COMPLETE CONTEXT HANDOFF
## Session 5 → Session 6
## Last updated: March 20, 2026

---

## HOW TO START THE NEW CHAT

1. Upload this file
2. Paste these two URLs:
```
https://raw.githubusercontent.com/ElangovanSankaralingom/tseda-data-repo/main/CLAUDE.md
https://api.github.com/repos/ElangovanSankaralingom/tseda-data-repo/git/trees/main?recursive=1
```
3. Say what you want to work on

---

## HOW CLAUDE SHOULD BEHAVE IN THIS PROJECT

### Communication Style
- **Direct and concise** — no unnecessary explanations unless the user asks "why"
- **Give the command to run** — don't explain what it does unless asked
- **One fix at a time** — don't bundle unrelated changes
- **Always end with the exact terminal commands** to build, commit, and push
- **Keep responses short** — the user values speed over verbosity
- **No emojis in responses** unless the user uses them first

### Decision Making
- **Ask before designing** — when the user asks for UI/UX changes, ask preferences using the widget picker (single_select, multi_select) before writing code
- **Confirm before executing** — for destructive actions (delete data, rewrite files), explain what will happen first
- **Check before assuming** — run grep/cat commands to see current code before writing fixes
- **Don't guess file contents** — always verify with the user or fetch from repo
- **Use the ask_user_input tool** for any bounded choices — never list options in prose

### Deep Problem Solving (CRITICAL — added in Session 5)
- **Always think deeply about the fundamental root cause** before proposing solutions
- **Avoid superficial fixes, workarounds, or band-aids** — address the core architectural issue even if it requires more effort
- **Trace the full code path** before writing a fix — grep → cat → understand → fix
- **Never guess what code looks like** — always read the actual file first
- **When something doesn't work after a fix**, don't add more patches on top — go back to root cause

### Problem Solving Pattern
1. User reports a bug → ask for the exact error message or screenshot
2. Run diagnostic grep/cat commands → find the root cause (DEEP — not surface level)
3. Write a `cat << 'PROMPT' | claude` prompt for Claude Code to execute
4. End with `npm run build && git add -A && git commit -m "..." && git push origin main`

### For UI/UX Requests
1. Ask preferences using the widget picker tool
2. Show the design plan in a table or ASCII layout
3. Get user confirmation: "Does this sound right?"
4. Write the implementation prompt

### For Bug Fixes
1. Trace the code path (grep for the error, cat the relevant files)
2. Identify root cause — think about WHY the bug exists, not just where
3. Write a targeted fix prompt — don't refactor unrelated code
4. Always include verification steps

### For Schema/Category Changes
1. Show proposed field list to user for confirmation
2. Schema → Type → Adapter → Slot config → PDF omit list (all must be updated together)
3. Always include hydrateEntry migration for backward compat with old data
4. Test with existing data after changes

### For Audit/Quality Work
1. Gather data systematically (grep across codebase, not guesswork)
2. Score each dimension objectively
3. Prioritize by dependency order (what enables what)
4. Group fixes into phases that minimize code churn
5. Verify each phase is 10/10 before moving to next

### What NOT To Do
- Don't write long explanations of architecture unless asked
- Don't suggest multiple approaches — pick the best one and go
- Don't add features the user didn't ask for
- Don't use emojis in the UI (user explicitly removed them)
- Don't create branches or worktrees — main branch only
- Don't commit .data/ or public/uploads/
- Don't use unicode escapes (\u2014, \u2022, etc.) — always use literal characters (—, •, –, ₹)
- Don't use `router.back()` — use `router.push()` or `window.location.href` for navigation
- Don't add `as const` to option arrays that have `icon` properties (TypeScript incompatibility)
- Don't set `staleTimes.static` below 30 (Next.js minimum)
- Don't call `setState` synchronously in useEffect bodies (use setTimeout(fn, 0) wrapper)
- Don't initialize useState with `navigator` or `window` — causes hydration mismatch (use `useState(true)` + sync in useEffect)

### Common Patterns Used
- `cat << 'PROMPT' | claude` — for piping prompts to Claude Code
- `npm run build && git add -A && git commit -m "..." && git push origin main` — after every change
- `grep -rn "search" path/ --include="*.tsx" | head -20` — to find code before fixing
- `sed -i '' 's/old/new/' file.ts` — direct file edits when Claude Code prompts fail
- Hard refresh: `Cmd+Shift+R` — when UI doesn't update
- Kill dev server: `kill $(lsof -ti:3000) 2>/dev/null; rm -rf .next/cache; npm run dev`
- Run single test: `NODE_ENV=test node --test --experimental-strip-types --experimental-loader ./tests/helpers/pathAliasLoader.mjs tests/<path>`

### Zsh Terminal Gotchas (learned in Session 5)
- Don't use `===` in echo commands — zsh interprets as comparison
- Don't use semicolons in sed combining multiple substitutions — run separate commands
- `grep -rn` with `#` comments between commands causes `zsh: command not found: #`
- Always escape parentheses in zsh paths: `app/\(protected\)/`
- `npm test` can hang indefinitely — use Ctrl+C after 60 seconds and run individual test files instead

---

## PROJECT OVERVIEW

**TSEDA** = Gamified faculty data collection app for TCE (Thiagarajar College of Engineering), Madurai.

**Stack:** Next.js 16 (Turbopack), React 19, Tailwind CSS 4, shadcn/ui, lucide-react, NextAuth.js 4 (Google OAuth @tce.edu), TypeScript 5, file-based JSON storage, pdf-lib.

**Repo:** https://github.com/ElangovanSankaralingom/tseda-data-repo (main branch only)
**Working dir:** `/Users/thya/tseda-data-repo`
**Master admin:** senarch@tce.edu
**Tests:** 420+ tests (352 original + 68 new in Session 5)
**Audit score:** 9.7/10

---

## ARCHITECTURE (CRITICAL — must understand)

### Two-Stage Field Model
- **Stage 1:** Data fields (before Generate) → go into the PDF, affect hash
- **Stage 2:** Upload fields + numberOfParticipants (after Generate) → NOT in PDF, don't affect hash
- Schema annotation: `stage: 1` or `stage: 2` in `data/schemas/*.ts`
- `pdfSourceHash = hash(stage 1 only)` — computed in `lib/pdfSnapshot.ts`

### Upload Model (CHANGED in Session 5)
- **ALL uploads are now FileMeta[] (multi-file arrays)** — no more `FileMeta | null`
- **ALL uploads are top-level fields** — no more nested `uploads.permissionLetter` pattern
- Schema kind for uploads: `kind: "array"` with `upload: true`
- Completion checker checks `Array.isArray(val) && val.length > 0` BEFORE the object check

### Sponsored Pattern (NEW in Session 5)
- All categories have a `sponsored` field (Yes/No dropdown)
- When "Yes": shows `fundingAgency` (text) + `fundingAmount` (currency)
- When "No" or switching from Yes→No: clears funding fields
- Conditional validation: if sponsored=Yes, agency + amount are required
- `fundingAmount` formatted as `Rs. X` in PDF (added to formatFieldValue check)

### Dropdown Icons (NEW in Session 5)
- SelectDropdownOption type has optional `icon` prop (React component)
- Icons rendered in both trigger display and option list
- Current icons: Level (Flag/Globe), Mode (Monitor/Building2), Semester (CloudSun/Sun), Sponsored (Banknote/BanknoteX), Academic Year (Calendar), Year of Study (GraduationCap), Current Semester (Hash)

### Workflow Engine (SINGLE source of truth)
`lib/workflow/workflowEngine.ts` → `computeWorkflowState(entry, category, config)`
Returns: button states, timer state, completion state, request state, autoAction

**ALL button logic derives from this ONE function.** Do NOT add manual `if (status === "...")` checks in components.

### Entry Statuses (6)
```
DRAFT → GENERATED → EDIT_REQUESTED → EDIT_GRANTED → GENERATED (re-finalised)
                  → DELETE_REQUESTED → (permanently deleted)
```

### Timer Rules
| Entry Type | Timer |
|-----------|-------|
| Future dates (endDate > today) | 3 days from generate |
| Past dates (endDate < today) | 1 day from generate |
| Streak entries (future + eligible) | max(3 days, endDate + 8 days) |

Timer **pauses** during EDIT_REQUESTED and DELETE_REQUESTED.
Timer **resumes** when admin acts.
On expiry: complete → auto-finalise, incomplete → auto-delete (nightly job).

### Streak Rules
- Future dates only (past dates NEVER streak eligible)
- Activated: eligible + PDF generated + GENERATED status
- Win: activated + ALL **required** stage 1 data fields filled + valid PDF + finalized
- Win check excludes optional fields (sponsored, fundingAgency, fundingAmount, coCoordinators, numberOfParticipants)
- `completedAtISO` is NOT set by finalise — wins are computed dynamically from field completion

### Request Action Rules
- ONE request per entry lifetime (`requestActionUsed` flag)
- Cancel own request → `permanentlyLocked = true`
- Admin rejects → `permanentlyLocked = true`
- Admin grants edit → timer resumes, user edits, re-generates, re-finalises
- Admin approves delete → permanently deleted from disk (no archive)

### Navigation & Data Freshness (CRITICAL — solved in Session 5)
- `NavigationRefresh` component in protected layout handles all freshness
- Debounced (500ms) — fires on pathname change, window focus, visibility change, bfcache pageshow
- `closeForm()` uses `window.location.href` for hard navigation back to list
- `staleTimes: { dynamic: 0, static: 30 }` in next.config.ts
- `createRefreshList` adds `_t=timestamp` cache buster to fetch URLs
- **Never use `router.back()`** — it restores cached page state

---

## CURRENT STATE OF ALL 5 CATEGORIES

### FDP — Attended
**Stage 1:** Academic Year, Semester Type (ODD/EVEN), Level (National/International), Mode (Online/Offline), Start Date, End Date, Program Name, Organising Body, Sponsored (Yes/No → Funding Agency + Amount)
**Stage 2:** Permission Letter[], Completion Certificate[]
**Title field:** programName
**Subtitle field:** organisingBody

### FDP — Conducted
**Stage 1:** Academic Year, Semester Type, Level, Mode, Start Date, End Date, Program Name, Coordinator (auto), Co-coordinators (optional faculty picker), Sponsored (Yes/No → Funding Agency + Amount)
**Stage 2:** Permission Letter[], Geotagged Photos[], Attendance Sheet[], Official Poster[], Number of Participants
**Title field:** programName
**Subtitle field:** coordinator info

### Guest Lectures
**Stage 1:** Academic Year, Semester Type, Level, Mode, Start Date, End Date, Topic of the Lecture, Guest Speaker Name, Guest Speaker Designation, Guest Speaker Organisation, Coordinator (auto), Co-coordinators (optional), Sponsored (Yes/No → Funding Agency + Amount)
**Stage 2:** Permission Letter[], Geotagged Photos[], Attendance Sheet[], Official Poster[], Number of Participants
**Title field:** topicOfLecture
**Subtitle field:** guestSpeakerName + organisation

### Case Studies (Industry Visit)
**Stage 1:** Academic Year, Year of Study (I-V), Current Semester (1-10), Start Date, End Date, Place of Visit, Purpose of Visit, Coordinator (auto), Staff Accompanying (optional faculty picker), Sponsored (Yes/No → Funding Agency + Amount)
**Stage 2:** Permission Letter[], Travel Plan[], Geotagged Photos[], Report[], Feedback from Students and Industry[], Advance Closure[], Number of Participants
**Title field:** placeOfVisit
**Subtitle field:** purposeOfVisit
**Note:** This is the ONLY category that keeps yearOfStudy + currentSemester

### Workshops
**Stage 1:** Academic Year, Semester Type, Level, Mode, Start Date, End Date, Workshop Name, Resource Person Name, Resource Person Designation, Resource Person Organisation, Coordinator (auto), Co-coordinators (optional), Sponsored (Yes/No → Funding Agency + Amount)
**Stage 2:** Permission Letter[], Geotagged Photos[], Attendance Sheet[], Official Poster[], Number of Participants
**Title field:** workshopName
**Subtitle field:** resourcePersonName + organisation

---

## SESSION 5 AUDIT FIXES (Phases 1-4)

### Phase 1 — Security/UX Foundations
1. **beforeunload guard** — warns user before closing tab with unsaved changes, confirm dialog on back/cancel
2. **Client-side upload validation** — 20MB size limit + file type check (.pdf/.jpg/.jpeg/.png) before upload starts
3. **Auto-save retry** — 3 retries with exponential backoff (1s/3s/10s), persistent amber warning banner after all fail
4. **Offline banner** — NetworkStatus component detects online/offline, shows fixed bottom banner
5. **API response helpers** — `apiSuccess`, `apiError`, `apiUnauthorized`, `apiForbidden`, `apiNotFound`, `apiServerError` in lib/api/apiResponse.ts

### Phase 2 — Reliability & Polish
6. **FormErrorBoundary** — React error boundary wraps form area only, list stays visible on crash
7. **EntryListSkeleton** — animated placeholder cards during list loading
8. **Toast improvements** — 4s for errors (was 1.2-1.8s), dismiss button on all toasts
9. **Orphan file cleanup** — findOrphanUploads() scans uploads dir, reports (doesn't delete), wired into nightly job
10. **Debounced NavigationRefresh** — 500ms debounce prevents rapid-fire router.refresh()
11. **Backup verification** — ZIP magic bytes check after creating backup
12. **ESLint zero warnings** — all unused directives and variables cleaned up

### Phase 3 — Accessibility
13. **ARIA attributes** — role="combobox"/aria-expanded on SelectDropdown, role="menu"/menuitem on RequestActionDropdown, role="progressbar" on upload, role="alert"/"status" on toasts, aria-modal on dialogs
14. **Keyboard navigation** — tabIndex={0} on entry cards, Enter/Space to navigate, ArrowUp/Down in dropdowns, focus-visible ring, group-focus-within for action visibility
15. **Skip navigation** — visually hidden "Skip to main content" link, targets #main-content on `<main>`
16. **Contrast fixes** — text-slate-500 → text-slate-600, text-amber-600 → text-amber-700 for WCAG AA

### Phase 4 — Architecture Hardening
17. **API pagination** — `?page=N&pageSize=N` on all category list endpoints via shared handleCategoryGet
18. **Async faculty search** — /api/faculty?q=query, debounced 300ms, max 20 results
19. **Improved rate limiter** — fixed-window algorithm, MAX_BUCKETS cap (10000), periodic pruning, SENSITIVE_PRESETS
20. **DataLayer abstraction** — documented SQLite migration path in lib/data/dataLayer.ts

---

## KEY FILES (updated for Session 5)

### Entry Engine
- `lib/entries/internal/engine.ts` — barrel for all engine modules
- `lib/entries/lifecycle.ts` — public API
- `lib/entries/workflow.ts` — status transitions, timer, editability
- `lib/entries/internal/engineRequests.ts` — edit/delete requests with timer pause
- `lib/entries/internal/engineAdmin.ts` — admin grant/reject/approve with timer resume
- `lib/entries/internal/engineCommit.ts` — generate + finalise (checks array uploads)
- `lib/entries/hydrateEntry.ts` — **NEW** universal entry hydration (safe defaults for old/missing fields)

### Workflow Engine
- `lib/workflow/workflowEngine.ts` — computeWorkflowState (THE core function)
- `lib/workflow/workflowConfig.ts` — config types + DEFAULT_WORKFLOW_CONFIG
- `lib/workflow/timerManager.ts` — pause/resume/clear timer
- `lib/workflow/completionChecker.ts` — field completion checking (array check BEFORE object check)

### Frontend
- `components/data-entry/adapters/BaseEntryAdapter.tsx` — shared adapter (beforeunload, error boundary, skeleton, auto-save banner)
- `components/data-entry/DataEntryClient.tsx` — categories home page
- `components/entry/EntryActionsBar.tsx` — Generate, Finalise, Save buttons
- `components/entry/RequestActionDropdown.tsx` — request edit/delete dropdown (ARIA, keyboard nav)
- `components/controls/SelectDropdown.tsx` — custom combobox (icon support, ARIA, keyboard nav)
- `components/controls/DateField.tsx` — date input
- `components/data-entry/StageTwoDivider.tsx` — "Supporting Documents" unlock divider
- `components/data-entry/EntryListCardShell.tsx` — card with tabIndex, keyboard nav, focus-visible
- `components/data-entry/EntryListSkeleton.tsx` — **NEW** loading skeleton
- `components/ErrorBoundaryFallback.tsx` — **NEW** form error boundary
- `components/NavigationRefresh.tsx` — **NEW** global route refresh (debounced, bfcache)
- `components/NetworkStatus.tsx` — **NEW** offline/online banner

### API & Infrastructure
- `lib/api/apiResponse.ts` — **NEW** shared response helpers
- `lib/api/categoryRouteHandler.ts` — shared GET/POST/PATCH/DELETE with pagination
- `lib/api/categoryFileHandler.ts` — upload slot config per category
- `lib/constants/messages.ts` — **NEW** centralized user-facing strings
- `lib/jobs/orphanFileCleanup.ts` — **NEW** orphan upload detection
- `lib/jobs/nightly.ts` — nightly maintenance (auto-finalise/delete + orphan scan)
- `lib/security/rateLimit.ts` — improved rate limiter (fixed-window, memory cap)

### PDF
- `lib/entry-pdf.ts` — PDF generation (accent line height: 0.75)
- `lib/pdf/buildPdfData.ts` — builds field data for PDF (fundingAmount gets Rs. prefix)
- `lib/pdf/pdfService.ts` — orchestrates PDF generation + storage

### Schemas
- `data/schemas/fdp-attended.ts` — semesterType, level, mode, sponsored pattern
- `data/schemas/fdp-conducted.ts` — same + attendanceSheet, officialPoster, numberOfParticipants
- `data/schemas/guest-lectures.ts` — topicOfLecture, guestSpeaker fields
- `data/schemas/case-studies.ts` — yearOfStudy, currentSemester, report, feedback, advanceClosure
- `data/schemas/workshops.ts` — workshopName, resourcePerson fields
- `data/categoryRegistry.ts` — category config (label, icon, color, schema)

### Tests (NEW in Session 5)
- `tests/validation/categorySchemas.test.ts` — 29 tests across all 5 schemas
- `tests/entries/hydrateEntry.test.ts` — 32 tests for hydration utility
- `tests/api/uploadSlots.test.ts` — 7 tests for upload slot consistency

---

## UPLOAD SLOT CONFIG (per category)

| Category | Slots | All Array | Nested |
|----------|-------|-----------|--------|
| fdp-attended | permissionLetter, completionCertificate | Yes | No |
| fdp-conducted | permissionLetter, geotaggedPhotos, attendanceSheet, officialPoster | Yes | No |
| guest-lectures | permissionLetter, geotaggedPhotos, attendanceSheet, officialPoster | Yes | No |
| case-studies | permissionLetter, travelPlan, geotaggedPhotos, report, feedback, advanceClosure | Yes | No |
| workshops | permissionLetter, geotaggedPhotos, attendanceSheet, officialPoster | Yes | No |

---

## PDF OMIT LIST

These fields are excluded from PDF generation:
```
id, status, confirmationStatus, confirmationRejectedReason, sentForConfirmationAtISO,
confirmedAtISO, confirmedBy, createdAt, updatedAt, attachments, uploads,
permissionLetter, completionCertificate, travelPlan, geotaggedPhotos, brochure,
attendance, speakerProfile, organiserProfile, attendanceSheet, officialPoster,
report, feedback, advanceClosure, pdfMeta, pdfSourceHash, pdfStale, streak
```

---

## GITIGNORE RULES
```
.data/          # User data — NEVER commit
public/uploads/ # Uploaded files — NEVER commit
.env.local      # Secrets — NEVER commit
.data_backups/  # Backups — NEVER commit
```

## CLEAR DATA COMMAND
```bash
rm -rf .data/users/*/
rm -rf .data/admin/notifications.json
rm -rf .data/maintenance/analytics-cache.json
rm -rf .data/maintenance/integrity-history/
rm -rf .data/maintenance/last-integrity-report.json
rm -rf .data/maintenance/lastRun.json
rm -rf .data/maintenance/maintenance-log.jsonl
rm -rf .data/telemetry/events.log
rm -rf .data/telemetry/summary.json
rm -rf .data_backups/
rm -rf public/uploads/*/
echo '{"notifications":[]}' > .data/admin/notifications.json
rm -rf .next/cache
# Then restart dev server + hard refresh browser
```

---

## PENDING / NEXT STEPS

### Immediate
1. **Run documentation update prompts** — DESIGN_SYSTEMS.md, DATA_MODEL.md, API.md, CHANGELOG.md, AUDIT.md still have stale content
2. **Test remaining code paths** — auto-save retry, orphan detection, pagination, error boundary recovery
3. **Manual QA** — test all 5 categories end-to-end: create → save → generate → upload → finalise → streak win

### Backlog
1. **SQLite migration** — DataLayer abstraction is ready, need to implement SqliteDataLayer
2. **Full i18n** — message constants (lib/constants/messages.ts) are ready, need lookup function for Tamil
3. **PWA / Mobile** — not started, viewport meta is set
4. **Admin-initiated delete** with second admin approval
5. **Test coverage expansion** — integration tests for upload flow, nightly job, admin actions

### Known Behaviors
- Turbopack build shows ~13 file pattern warnings (cosmetic, ignore)
- `npm run dev` needs restart after `.env.local` changes
- Hard refresh (`Cmd+Shift+R`) sometimes needed after UI changes
- `.next/cache` may need clearing if stale: `rm -rf .next/cache`
- `npm test` can hang — run individual test files instead
- Zsh doesn't like `===` in echo or `;` combining sed commands

---

## UI STYLE (unchanged from Session 4)

- Primary action: `bg-[#1E3A5F]` (dark blue)
- Generate/Finalise: `bg-emerald-600` (green)
- Cards: `rounded-xl border-slate-200 shadow-sm` with colored top border `border-t-[3px]`
- Category accent colors on top borders and "+ New Entry" buttons
- Empty cards: `border-dashed border-slate-300 bg-slate-50` (greyed out style)
- All dropdowns use `SelectDropdown` combobox with icon support (not native `<select>`)
- Modals use React portal with `bg-black/20 backdrop-blur-sm` full-page overlay + `overflow-y-auto max-h-[90vh]`
- No emojis in UI, lucide-react icons only
- Frosted glass finalise modal with confetti
- Skip-to-content link (visually hidden, visible on focus)
- Focus-visible rings on interactive elements
- Minimum 44px tap targets on mobile
- Toast: dismiss button, 4s errors, 1.5s success

### Dropdown Icons
- Level: Flag (National), Globe (International)
- Mode: Monitor (Online), Building2 (Offline)
- Semester Type: CloudSun (ODD), Sun (EVEN)
- Sponsored: Banknote (Yes), BanknoteX (No)
- Academic Year: Calendar (all)
- Year of Study: GraduationCap (all)
- Current Semester: Hash (all)

### PDF Design
- Two logos: TSEDA (left), TCE (right), larger size
- No institution text (logos are enough)
- Blue accent line under logos (height: 0.75)
- Category title centered
- Faculty name + generation date
- Table with dark blue header, alternating row colors
- Pixel-width text wrapping (no overflow)
- Multi-page support
- fundingAmount formatted as `Rs. X`
- Footer: "Sd/-", signature line, Dr. Jinu's name (12pt bold) + designation
- Bottom: "T'SEDA Data Repository" (no "Confidential")

---

## USER PREFERENCES (for Claude's reference)

- Prefers short, direct responses
- Likes asking "what's next?" to keep momentum
- Tests features manually and reports bugs with screenshots
- Values UX polish — cares about button colors, dropdown consistency, animations, icons
- Doesn't like emojis in UI (removed them)
- Wants everything schema-driven and automatically applied to new categories
- Prefers `cat << 'PROMPT' | claude` pattern for Claude Code prompts
- Gets frustrated by double-click / race condition bugs — fix these permanently
- Appreciates celebration animations (confetti on finalise)
- Indian academic year convention: June to May (ODD: Jun-Nov, EVEN: Dec-May)
- Prefers combobox-style dropdowns over native select elements with icons
- Likes colored accents per category (top borders, buttons)
- Wants PDF to look formal and print-ready with two logos and signature block
- **Demands deep root-cause analysis** — no superficial fixes
- **Wants 10/10 quality** — systematic audit → phased fixes → verify each phase
- Appreciates visual roadmaps and strategic planning
- Not from a programming background — needs clear, actionable instructions
- Uses sed as fallback when Claude Code prompts fail to apply edits
