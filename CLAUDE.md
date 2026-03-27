# TSEDA — Claude Code Instructions

> This file is read automatically by Claude Code. It is the single source of truth for project architecture, conventions, and rules.

## Project

**TSEDA** = Gamified faculty data collection app for TCE (Thiagarajar College of Engineering), Madurai.
Faculty log professional development activities across categories. The app gamifies data entry with a streak system and timed edit windows.

## Stack

- **Next.js 16** (Turbopack, App Router)
- **React 19**, TypeScript 5
- **Tailwind CSS 4**, shadcn/ui, lucide-react
- **NextAuth.js 4** (Google OAuth, @tce.edu domain only)
- **File-based JSON storage** with DataLayer abstraction (SQLite-ready)
- **pdf-lib** for PDF generation

## Critical Rules

### Git
- Work ONLY on `main` branch. No worktrees, no dev branches.
- Push after every change: `git add -A && git commit -m "description" && git push origin main`
- **NEVER commit** `.data/`, `public/uploads/`, `.env.local` — all gitignored.

### Code Quality
- `npm run build && npm run lint` must pass before every commit (husky pre-commit hook runs both)
- `npm run build` catches TypeScript and compilation errors
- `npm run lint` catches React Compiler rules (static-components, set-state-in-effect, exhaustive-deps)
- NEVER use `npm run build` alone as verification — always run both
- 0 `any` types. 0 `console.log`. 0 TODO/FIXME.
- All inputs use `value={field || ""}` to prevent controlled/uncontrolled warnings.
- All new fields in entry types must be added to `LIFECYCLE_FIELDS` in `lib/pdfSnapshot.ts` if they shouldn't affect the PDF hash.

### Security
- All API routes require auth (NextAuth session check)
- CSRF on all mutations
- File validation (MIME, size, magic bytes)
- Input sanitization (HTML strip, null bytes, length truncation)
- Rate limiting on all endpoints
- `CRON_SECRET` required for nightly job

---

## Architecture

### Two-Stage Field Model

Every entry has two independent field sets:

**Stage 1 (Primary):** Data fields — program name, dates, organising body, etc. These go INTO the PDF. Changing stage 1 after generate → "Document outdated". All required stage 1 fields must be filled before Generate Entry is enabled.

**Stage 2 (Secondary):** File uploads — permission letter, completion certificate. NOT part of the PDF. Visible only after Generate Entry. Uploading/deleting stage 2 files NEVER affects PDF staleness. Stage 2 completion required for Finalise.

Schema annotation: `stage: 1` or `stage: 2` on each field in `data/schemas/*.ts`.
Hash rule: `pdfSourceHash = hash(stage 1 fields only)`.

### Entry Statuses (6)

```
DRAFT → GENERATED → EDIT_REQUESTED → EDIT_GRANTED → GENERATED (re-finalised)
                  → DELETE_REQUESTED → (permanently deleted)
```

### Workflow Engine (THE source of truth)

`lib/workflow/workflowEngine.ts` → `computeWorkflowState(entry, category, config)`

Returns: button states, timer state, completion state, request state, autoAction for nightly job.

ALL button visibility/enabled logic derives from this ONE function. Do NOT add manual `if (status === "EDIT_REQUESTED")` checks in components — use the engine.

Supporting modules:
- `lib/workflow/workflowConfig.ts` — config types + defaults
- `lib/workflow/timerManager.ts` — pause/resume/compute timer
- `lib/workflow/completionChecker.ts` — stage 1+2 completion from schema
- `hooks/useWorkflowState.ts` — frontend hook

### Timer Rules

| Entry Type | Timer |
|-----------|-------|
| Future dates (endDate > today) | 3 days from generate |
| Past dates (endDate < today) | 1 day from generate |
| Streak entries (future + eligible) | max(3 days, endDate + 8 days) |

Timer **pauses** during EDIT_REQUESTED and DELETE_REQUESTED.
Timer **resumes** when admin acts (grant/reject).

On timer expiry:
- All fields complete + PDF fresh → auto-finalise (permanentlyLocked)
- Incomplete or stale PDF → auto-delete permanently (nightly job)

### Streak Rules

- **Eligible:** Future date entries only (endDate > today at creation time). Past dates are NEVER streak eligible.
- **Activated:** Streak eligible + PDF generated + GENERATED status
- **Win:** Activated + ALL stage 2 fields filled

### Request Action Rules

- Each entry gets ONE request action ever (edit OR delete). `requestActionUsed` flag tracks this.
- After any request is sent → no more Request Action dropdown.
- Cancel own request → `permanentlyLocked = true`
- Admin rejects → `permanentlyLocked = true`
- Admin grants edit → timer resumes, user edits, re-generates, re-finalises
- Admin approves delete → entry + files permanently deleted from disk

### Permanent Delete

`approveDelete` in `engineAdmin.ts` removes:
- Entry from category JSON
- All uploaded files (PDF, certificates, letters)
- Upload directory
- Admin notifications for this entry
- Invalidates analytics cache

No ARCHIVED status for delete flow — data is gone.

---

## File Structure

### Entry Point — Engine
ALL entry mutations flow through `lib/entries/internal/engine.ts` (barrel):
- `engineRead.ts`, `engineWrite.ts`, `engineCommit.ts`
- `engineTransitions.ts`, `engineAdmin.ts`, `engineRequests.ts`
- `engineValidation.ts`, `engineHelpers.ts`, `engineIndex.ts`

Public API: `lib/entries/lifecycle.ts`

### API Routes
`lib/api/categoryRouteHandler.ts` — single shared handler for all categories.
5 thin wrappers at `app/api/me/*/route.ts` (~25 lines each).

PATCH actions: `save`, `generate`, `finalise`, `request_edit`, `request_delete`, `cancel_request_edit`, `cancel_request_delete`, `cancel_edit_grant`

### Frontend Components
- `components/data-entry/adapters/BaseEntryAdapter.tsx` — shared adapter base (uses `computeWorkflowState`)
- `components/data-entry/adapters/*.tsx` — per-category form fields
- `components/data-entry/CategoryEntryPageShell.tsx` — page layout
- `components/data-entry/CategoryPageRouter.tsx` — routes category slug to adapter
- `components/entry/EntryActionsBar.tsx` — Generate, Finalise, Save, Request Action buttons
- `components/entry/RequestActionDropdown.tsx` — edit/delete request dropdown
- `components/data-entry/DataEntryClient.tsx` — categories home page

### Schemas
- `data/schemas/*.ts` — field definitions with `stage`, `kind`, `required`, `upload`
- `data/categoryRegistry.ts` — category config (label, icon, color, schema)
- Each schema exports `workflow: WorkflowConfig` for the workflow engine

### Key Libraries
- `lib/pdfSnapshot.ts` — hash computation, stage 2 exclusion, staleness detection
- `lib/pdf/pdfService.ts` — PDF generation
- `lib/streakProgress.ts` — streak business rules
- `lib/workflow/` — workflow engine (timer, completion, button states)
- `lib/security/` — CSRF, file validation, sanitization, rate limiting
- `lib/admin/roles.ts` — role-based access control
- `lib/data/dataLayer.ts` — abstract storage interface (JSON backend)
- `lib/entries/hydrateEntry.ts` — universal entry hydration (safe defaults for missing/old fields)
- `lib/constants/messages.ts` — centralized user-facing strings
- `lib/api/apiResponse.ts` — shared API response helpers (apiSuccess, apiError, apiUnauthorized, etc.)
- `lib/jobs/orphanFileCleanup.ts` — orphan upload file detection (nightly job)
- `components/ErrorBoundaryFallback.tsx` — React error boundary for form area
- `components/NavigationRefresh.tsx` — global route refresh on navigation + focus + bfcache
- `components/NetworkStatus.tsx` — offline/online status banner
- `components/data-entry/EntryListSkeleton.tsx` — skeleton loading cards

### Nightly Job
`app/api/cron/nightly/route.ts` → `lib/jobs/nightly.ts`
Runs: auto-archive, auto-delete, timer warnings, WAL compaction, backup, integrity check.
Requires `CRON_SECRET` header.

---

## Adding a New Category

```bash
./scripts/add-category.sh journal-papers "Journal Papers"
```

Creates:
- `data/schemas/journal-papers.ts` (with workflow config)
- `app/api/me/journal-papers/route.ts`
- `components/data-entry/adapters/journal-papers.tsx`

Then:
1. Edit schema — add fields with `stage: 1` or `stage: 2`, set `required: false` for optional
2. Register in `data/categoryRegistry.ts` — add to CATEGORY_LIST
3. Add adapter import in `components/data-entry/CategoryPageRouter.tsx`
4. Flesh out the adapter (form fields, list rendering)
5. `npm run build && npm run lint`

Everything else (routes, workflow, timer, buttons, nightly job, dashboard) auto-derives from schema.

**Schema field notes:**
- Upload fields should use `kind: "array"` with `upload: true, stage: 2`
- All uploads are multi-file (`FileMeta[]`) — no single-file upload fields
- If the category can be sponsored, add the `sponsored`/`fundingAgency`/`fundingAmount` conditional pattern (sponsored Yes/No drives visibility of funding fields)
- Add icons to `Level`, `Mode`, and `Sponsored` option lists using lucide-react icons (see existing schemas for examples)

---

## Conventions

### Imports
- `@/` alias for project root
- Server-only files start with `import "server-only";`
- Barrel exports from `lib/entries/internal/engine.ts` and `lib/workflow/index.ts`

### Naming
- Category slugs: kebab-case (`fdp-attended`, `guest-lectures`)
- Schema exports: camelCase (`fdpAttendedSchema`)
- Component files: PascalCase (`BaseEntryAdapter.tsx`)
- Hook files: camelCase (`useWorkflowState.ts`)
- Lib files: camelCase (`workflowEngine.ts`)

### UI Style
- Primary action color: `bg-[#1E3A5F]` (dark blue)
- Generate button: `bg-emerald-600` (green)
- Finalise button: `bg-emerald-600` (green)
- Cards: `rounded-xl border border-slate-200 shadow-sm` with `hover:-translate-y-0.5 hover:shadow-md`
- Category accent colors per card (top border `border-t-[3px]`)
- Empty states: `border-dashed border-slate-300 bg-slate-50`
- No emojis in UI
- lucide-react icons only
- Frosted glass modals: `bg-black/20 backdrop-blur-sm` via React portal

### Testing
- Test runner: Node.js native test runner
- Test files: `tests/**/*.test.ts`
- Run: `npm test`
- Coverage: c8

### Environment
- `.env.local`: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET
- Master admin: `senarch@tce.edu` (configured in `lib/config/appConfig.ts`)

---

## Current State

- **Audit score: 8.8/10** across 18 categories
- **352+ tests**, 0 failures
- **Build: clean** (Turbopack warnings are cosmetic)
- **Docker + CI/CD ready** (GitHub Actions)
- **5 categories:** fdp-attended, fdp-conducted, guest-lectures, case-studies, workshops
  - All categories use: semesterType, level, mode, sponsored pattern (except case-studies keeps yearOfStudy/currentSemester)
  - All uploads are multi-file (FileMeta[])
  - Guest lectures uses topicOfLecture, guestSpeaker* fields
  - Workshops uses workshopName, resourcePerson* fields

## Do NOT

- Create worktrees or branches
- Add `any` types
- Use `console.log` (use `logger` from `lib/logger.ts`)
- Hardcode category slugs outside registry/schemas
- Add button state logic outside the workflow engine
- Commit `.data/` or `public/uploads/`
- Modify business logic without running `npm test`
- Use emojis in the UI

---

## NO-HARDCODE PRINCIPLE (MANDATORY)

NOTHING in TSEDA is hardcoded. Everything is schema-driven and modular:

### UI Strings
- ALL user-facing text uses `t('key')` from `lib/i18n/useTranslation.ts`
- English dictionary (`lib/i18n/en.ts`) is the source of truth
- Tamil dictionary (`lib/i18n/ta.ts`) is type-checked against English — missing key = compile error
- New languages: create a new file typed against `TranslationDict`, add to Language union

### Field Labels
- Schemas define field structure, NOT display labels
- Display labels resolve through `fieldLabel(fieldName)` which reads from translation dictionary
- If translation exists → translated. If not → fallback to fieldName.

### Dropdown Options
- Schema defines `options: [{ value: 'national', label: 'National' }]`
- At render time: `valueLabel(option.value)` resolves through translation
- Schema `label` is the English fallback only

### Category Names
- `categoryLabel(slug)` resolves through translation dictionary
- categoryRegistry defines slug, icon, color — NOT display name

### Toast / Error Messages
- All toast messages use translation keys: `t('toast.saved')`
- Error messages use: `t('common.error')` or specific error keys

### Adding a New Feature Checklist
1. Add data to schema/registry (structure only, no display strings)
2. Add English key to `lib/i18n/en.ts`
3. TypeScript forces Tamil key in `lib/i18n/ta.ts`
4. Component uses `t()`, `fieldLabel()`, `valueLabel()`, or `categoryLabel()`
5. NEVER write a hardcoded string in a component — always go through translation

### Adding a New Language
1. Create `lib/i18n/<code>.ts` typed against `TranslationDict`
2. Add to `Language` union in `lib/i18n/index.ts`
3. Add to dictionaries map
4. Add option in appearance settings
5. Done — compiler guarantees completeness

### Registries and Config (single source of truth)
- **Admin tools:** `data/adminToolRegistry.ts` — all admin console tool cards (icon, route, accent color, badge config). AdminConsoleDashboard maps over this registry.
- **Notification types:** `data/notificationTypeConfig.ts` — shared icon/color config for both user and admin notification types. Imported by NotificationBell and AdminNotificationBell.
- **Category config:** `data/categoryRegistry.ts` — category slug, icon, color, schema, gradient. Do NOT duplicate category metadata.
- **Routes:** `lib/entryNavigation.ts` — all route paths. NEVER hardcode `/admin/...` or `/data-entry/...` in components.
- **Dates & numbers:** `lib/i18n/locale.ts` — `formatDate()`, `formatNumber()`, `formatCurrency()`. NEVER hardcode `"en-IN"`.
- **File limits:** `lib/config/appConfig.ts` — `APP_CONFIG.upload.maxFileSizeBytes`, `.maxFileSizeMB`, `.allowedExtensions`.
- **PDF config:** `lib/config/appConfig.ts` — `APP_CONFIG.pdf.signatoryName`, `.signatoryDesignation`, `.footerText`.
- **Theme tokens:** `lib/theme/themeTokens.ts` — ALL colors as CSS variables. NEVER use hardcoded hex/Tailwind slate colors.
- **Theming:** `lib/theme/ThemeProvider.tsx` — `useTheme()` provides mode, palette, language. All components use CSS variables.
