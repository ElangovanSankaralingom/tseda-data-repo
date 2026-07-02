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
- The husky pre-commit hook runs `npm run lint && npx tsc --noEmit` — both must pass before every commit
- `npm run lint` runs eslint (React Compiler rules: static-components, set-state-in-effect, exhaustive-deps) **plus the theme-token guard** (`scripts/check-theme-tokens.mjs` — see Color Conventions below)
- `npx tsc --noEmit` catches TypeScript errors; run `npm run build` as well before shipping
- NEVER use `npm run build` alone as verification — always run lint + typecheck too
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
- Incomplete or stale PDF → auto-delete (nightly job). NOTE: the nightly
  delete verdict QUARANTINES (30-day recoverable trash, `lib/jobs/quarantine.ts`)
  rather than destroying — only admin-approved delete requests are truly
  permanent. There is also an `ARCHIVED` status used by auto-archive/restore
  (distinct from the delete flow).

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
- `lib/admin/actionHistory.ts` — admin action history (append, read, paginate)
- `lib/data/dataLayer.ts` — abstract storage interface (JSON backend)
- `lib/entries/hydrateEntry.ts` — universal entry hydration (safe defaults for missing/old fields)
- `lib/constants/messages.ts` — centralized user-facing strings
- `lib/api/apiResponse.ts` — shared API response helpers (apiSuccess, cachedApiSuccess, apiError, etc.)
- `lib/swr/fetcher.ts` — shared SWR fetch function
- `lib/ui/categoryIcons.ts` — `CategoryIcon` component for server/client icon rendering
- `lib/jobs/orphanFileCleanup.ts` — orphan upload file detection (nightly job)
- `hooks/useApi.ts` — SWR-based data fetching hook for client components
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
- ALL colors use CSS variables from `lib/theme/themeTokens.ts` — NEVER hardcode hex or Tailwind slate colors
- Category accent colors from registry (`data/categoryRegistry.ts` → `color.accentBg`, `color.borderTop`)
- No emojis in UI
- lucide-react icons only

### Testing
- Test runner: Node.js native test runner
- Test files: `tests/**/*.test.ts`
- Run: `npm test`
- Coverage: c8

### Environment
- `.env.local`: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET
- Optional: TRUST_PROXY=false disables x-forwarded-for/x-real-ip trust for rate limiting (direct-exposure deployments)
- Master admin: `senarch@tce.edu` (configured in `lib/config/appConfig.ts`)

---

## Current State

- **508 tests, 0 failures** (2026-07 audit: added concurrency, nightly-idempotency, IST-boundary, requestIp, and ta-completeness coverage)
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

## TSEDA DESIGN LANGUAGE

**The core problem to avoid:** Everything looking the same. Dark background, white text, repeat. No layers, no drama, no hierarchy. Flat in the boring sense — not flat design, just *empty*. Cards, sections, pages blurring into one dark mass with no personality.

**What the design must achieve:**

**LAYERS are the DNA.** Category inside category. Sections inside sections. Every nesting level must *feel* different — through color, through surface treatment, through spacing, through shape. If a group sits inside another group, the inner one must visually declare "I'm a different thing." Not with a subtle border change. With an actual shift — background color, texture, elevation, something real.

**Things must feel DISTINCT from each other.** If two card types look similar, one of them is wrong. Each state, each group, each section should be recognizable at a glance without reading any text. Structure, color, and shape do this — not just swapping one hex code for another on the same dark rectangle.

**Experiment and take risks.** Try something unexpected. An accent that pulls attention. A color that doesn't "match" but creates energy. A layout choice that breaks the grid for one element. If it's what everyone does, don't do it. Find the thing that makes someone pause and look twice.

**Balance professional and futuristic.** Not a corporate spreadsheet. Not a neon cyberpunk game. Somewhere in between — polished enough for a college system, bold enough to feel like it was designed with ambition.

**Glass is a spice, not the meal.** Use it where it earns its place — a floating modal, a hero element, a single focal card. Never as the default surface for everything. When glass is everywhere, it's nowhere. The moment you reach for `backdrop-blur` as a habit, stop.

**Flat design is for things that are done.** Completed records, archived items, settled states — these get clean, minimal, flat treatment. They've earned their quiet. Active items get the energy, the gradients, the bold surfaces.

**Color is not decoration, it's structure.** Different sections need different color temperatures. Different groups need different palettes. The outermost container, the mid-level grouping, the individual card — each layer should have its own color identity. Dark-on-dark-on-dark with white text everywhere is the failure state.

**Break the pattern on purpose.** If nine things are cards, make the tenth something else. If everything flows vertically, put one thing horizontal. If the whole page is cool-toned, let one element be warm. These "out of context" moments are what create visual memory — the thing someone notices and remembers.

**Don't just redesign colors — redesign structure.** When you hear "redesign," it means rethink the grouping, the hierarchy, the containment, the nesting. How things are clubbed together matters more than what shade of blue the border is.

**VISIBILITY IS NON-NEGOTIABLE.** This is a dark-themed app. Text must be READABLE, not decorative. Every piece of text a user needs to read must meet minimum opacity thresholds — no exceptions, no "it looks subtle and cool." If a user has to squint, it's broken. Icons that convey meaning must be clearly visible, not ghostly hints. Borders and dividers that create structure must be strong enough to actually see. "Subtle" means slightly understated, NOT invisible.

### Legibility System (MANDATORY — USE TOKENS, NOT HARDCODED VALUES)

All legibility values are defined as CSS variables in `lib/theme/themeTokens.ts`. Every component MUST use these tokens. NEVER hardcode `rgba(255,255,255,0.XX)` or `text-white/XX` — use the token instead.

#### Text Hierarchy (5 tiers — use CSS variables via inline style or Tailwind arbitrary values)

| Tier | Purpose | Token | Dark value | Min size |
|------|---------|-------|------------|----------|
| **T1** | Headings, names, titles | `--color-text-primary` | `#F1F5F9` (≈white/95) | 15px+ |
| **T2** | Labels, nav items, descriptions | `--color-text-secondary` | `#94A3B8` (≈white/65) | 13px+ |
| **T3** | Hints, timestamps, metadata | `--color-text-tertiary` | `rgba(255,255,255,0.50)` | 11px+ |
| **T4** | Placeholders, empty states | `--color-text-placeholder` | `rgba(255,255,255,0.50)` | 13px+ |
| **T5** | Disabled, ghost text | `--color-text-muted` | `#4B5563` (≈white/40) | 11px+ |

**Hard floors:** T1 NEVER below white/90. T2 NEVER below white/50. T3/T4 NEVER below white/45. No text NEVER below white/40. Font size NEVER below 10px.

#### Border & Line Hierarchy (4 tiers)

| Tier | Purpose | Token | Dark value | Width |
|------|---------|-------|------------|-------|
| **B1** | Subtle surface edges, hover | `--color-border-subtle` | `rgba(255,255,255,0.08)` | 1px |
| **B2** | Card borders, input borders, containers | `--color-border-default` | `rgba(255,255,255,0.12)` | 1.5px |
| **B3** | Strong containers, focus rings, emphasis | `--color-border-strong` | `rgba(255,255,255,0.18)` | 1.5px+ |
| **D1** | Section dividers, separators | `--color-divider` | `rgba(255,255,255,0.10)` | 1.5px |
| **D2** | Strong dividers, group separators | `--color-divider-strong` | `rgba(255,255,255,0.15)` | 1.5px+ |

**Hard floors:** Borders NEVER below `0.08` opacity. Dividers NEVER below `0.10`. Width NEVER below 1px for borders, 1.5px for structural dividers. Accent lines use `2px`+, accent bars `3px`.

#### Icon Hierarchy (3 tiers)

| Tier | Purpose | Token | Dark value |
|------|---------|-------|------------|
| **I1** | Active, selected, interactive | `--color-icon-active` | `rgba(255,255,255,0.90)` |
| **I2** | Default, clickable, navigational | `--color-icon-default` | `rgba(255,255,255,0.65)` |
| **I3** | Decorative, muted, background | `--color-icon-muted` | `rgba(255,255,255,0.50)` |

**Hard floor:** Icons NEVER below white/45. If an icon conveys meaning, it must be I2 or above.

#### Surface Hierarchy (existing + new)

| Purpose | Token | Dark value |
|---------|-------|------------|
| Page background | `--color-body-bg` | `#0B0F19` |
| Card / raised surface | `--color-surface-raised` | `rgba(255,255,255,0.04)` |
| Inset / recessed input | `--color-surface-inset` | `rgba(0,0,0,0.12)` |
| Glass surface | `--color-glass-bg` | `rgba(255,255,255,0.03)` |

#### Migration rules for existing `rgba()` and `text-white/XX` patterns

When writing or modifying ANY component:
1. Replace `rgba(255,255,255,0.9X)` text → `var(--color-text-primary)`
2. Replace `rgba(255,255,255,0.5X-0.7X)` text → `var(--color-text-secondary)` or `var(--color-text-tertiary)`
3. Replace `rgba(255,255,255,0.3X-0.5X)` placeholder text → `var(--color-text-placeholder)`
4. Replace `rgba(255,255,255,0.0X)` borders → `var(--color-border-subtle)`, `var(--color-border-default)`, or `var(--color-border-strong)`
5. Replace `rgba(255,255,255,0.0X)` dividers → `var(--color-divider)` or `var(--color-divider-strong)`
6. Replace icon opacity → `var(--color-icon-active)`, `var(--color-icon-default)`, or `var(--color-icon-muted)`
7. Replace Tailwind text-white opacity classes with the matching color-text token via inline style or Tailwind arbitrary value

**The goal: ZERO hardcoded rgba white opacity values in any component.** Every opacity decision must go through a token. This ensures palette changes, legibility bumps, and theme switches affect the ENTIRE app at once.

#### Color Conventions (post light/dark migration, 2026-06 — ENFORCED BY `scripts/check-theme-tokens.mjs`)

The theme guard runs as part of `npm run lint` (and therefore the pre-commit hook). It hard-fails on: white/black Tailwind utilities (`text-white`, `bg-white/5`, …), raw `rgba(255,255,255,…)` outside box-shadow `inset` highlights, and hex literals inside `className`. Tailwind palette classes (`text-red-400`, …) are baseline-ratcheted: counts may shrink, never grow (`npm run lint:theme -- --update-baseline` after intentional changes).

| Need | Use |
|------|-----|
| Status meaning (error/warning/success/info) | `--color-status-{error,warning,success,info}` + `-bg` / `-border` |
| Identity hue (groups, categories, decorative accents) | `--color-palette-{violet,purple,cyan,orange,indigo,rose,yellow,blue,emerald,amber,pink}-{fg,bg,border}` |
| Alpha tint of any token | `color-mix(in srgb, var(--color-…) N%, transparent)` — NEVER `${hex}NN` suffix on a var |
| Text/surface ON a saturated accent or gradient | `--color-text-on-accent`, `-on-accent-muted`, `--color-surface-on-accent`, `-strong` |
| Nested panel layers (well → chip → tile) | `--color-surface-panel`, `-panel-raised`, `-panel-tile` |
| Deep recess (segmented tracks, node pits) | `--color-surface-inset-deep` |
| Dock / floating header | `--color-header-bg`, `--color-header-bg-scrolled` |

**Light-mode legibility floor (faculty of all ages):** every content-text token in `LIGHT_BASE` must meet WCAG AA 4.5:1 on BOTH white cards and the ice field (`--color-text-muted` is the lightest text allowed and passes). Disabled controls use `surface-inset-deep` + `text-muted` — never accent-at-low-opacity (washed accent with white text is unreadable). Saturated 400-shade hexes are dark-mode values; on light surfaces always use the palette/status tokens (light = 500/600 shades). No user-facing text below 11px.

**Registry-as-data exception:** category accent hexes (`ACCENT_HEX`, adapter accents, tier metals, chart colors, Google brand, ConfettiBurst) stay as literal hexes — they are saturated mid-tones valid in both modes and live in data registries, not styling. Their `${hex}NN` templates are legal because they operate on real hexes. GROUP_HEX (entry groups) is the opposite: it holds `var()` strings — tints from it MUST use color-mix.

**First-paint contract:** `app/(protected)/layout.tsx` emits `buildThemeCss(mode, palette)` server-side + a parser-blocking `.dark` class script, so the first paint matches the saved mode. The `:root` block in `globals.css` is a dark fallback for unauthenticated pages ONLY and must stay in exact sync with `DARK_BASE` (the P-phase sync script verified 1:1; keep it that way when adding tokens). The shadcn vars (`--background`, `--border`, …) are aliases into the token system — never give them literal colors.

**NEVER sacrifice readability for aesthetics.** When in doubt, bump UP aggressively. A slightly "too visible" element is infinitely better than one you can't read.

### The Rules

1. **Categorise** — group and nest visually, not just logically
2. **Make things feel distinct** — every state/group must be recognizable at a glance
3. **Experiment** — try unexpected layouts, colors, shapes
4. **Introduce attention-grabbers** — sometimes an out-of-context feature that drags the eye is exactly right
5. **Don't go all in with glass** — careful, intentional usage only
6. **Use flats wherever necessary** — completed/settled states earn flat treatment
7. **Be unique** — if many use that pattern, don't; find the other thing
8. **Balance professional and futuristic** — polished but ambitious
9. **Take risks** — safe design is invisible design
10. **RIGHT BALANCE** between professional and futuristic, flat and glass, always go for unique design, always experiment
11. **VISIBILITY FIRST** — every text element must be readable, every meaningful icon must be visible, never sacrifice readability for aesthetics

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

---

## Performance Optimizations

### Client-Side Data Caching (SWR)
- `hooks/useApi.ts` — shared hook wrapping `useSWR` with `lib/swr/fetcher.ts`
- Use `useApi('/api/...')` instead of `useState + useEffect + fetch` for all GET requests
- After mutations, call `mutate('/api/...')` from `swr` to revalidate
- Config: `revalidateOnFocus: false`, `dedupingInterval: 30000`

### Code Splitting
- Category adapters in `CategoryPageRouter.tsx` use `React.lazy` with `Suspense` fallback
- Only the adapter for the active category is loaded — not all 5

### React.memo Convention
- All components rendered inside `.map()` loops MUST be wrapped with `React.memo`
- Use `useCallback` for event handlers passed to memoized children

### API Response Caching
- Read endpoints use `Cache-Control: private, max-age=N, stale-while-revalidate=M`
- Dashboard: 60s, Action History: 30s, Category Overview: 30s
- Mutation endpoints and real-time endpoints (unread counts): no caching
- Helper: `cachedApiSuccess(data, maxAge, staleWhileRevalidate?)` in `lib/api/apiResponse.ts`

### Rate Limiting
- ALL API routes have rate limiting (89/90, NextAuth passthrough excluded)
- Tiers: entryReads 120/min, entryMutations 30/min, uploadOps 20/min, adminOps 60/min, fileDownloads 30/min, health 60/min
- Configured via `enforceRateLimitForRequest()` from `lib/security/rateLimit.ts`

### Font and Image Optimization
- `next/font` with Geist Sans + Geist Mono (`app/layout.tsx`), CSS variables on `<html>`
- All images use `next/image` — no raw `<img>` tags allowed

---

## Accessibility

- Skip navigation link in `ShellClient.tsx` targeting `#main-content`
- `sr-only` class available via Tailwind CSS v4 (built-in)
- All icon-only buttons MUST have `aria-label`
- `prefers-reduced-motion` support in `globals.css`
- Keyboard navigation on SelectDropdown (arrow keys, Escape, Home/End)
- ARIA roles on combobox, listbox, progressbar components

---

## Admin Action History

- `lib/admin/actionHistory.ts` — append, read, paginate
- `app/api/admin/action-history/route.ts` — GET with filters
- Records: edit_granted, edit_rejected, delete_approved, delete_rejected, user_cancelled, auto_finalised, auto_deleted
- Hooked into: `engineAdmin.ts`, `engineRequests.ts`, `nightly.ts`
- UI: "History" tab in admin confirmations page with filters and pagination

---

## Schema-Driven Satellite Systems

These systems derive their behavior from schema `upload: true` annotations — no hardcoded field lists:

- **Upload slots**: `getUploadSlotConfig()` in `lib/api/categoryFileHandler.ts` reads schema
- **PDF field exclusion**: `getOmitFromPdfSet()` in `lib/pdf/buildPdfData.ts` reads schema
- **Integrity checks**: `getAttachmentKeys()` in `lib/admin/integrityTypes.ts` reads schema
- **Entry title**: `getCategoryTitle()` uses `entryTitleField` from category registry
- **Numeric field detection**: PDF hash reads `kind: 'number'` from schema
- **Currency formatting**: PDF reads `format: 'currency'` from schema
- **Dashboard icons/colors**: Read from category registry, rendered via `CategoryIcon` component

### Server/Client Boundary for Icons
Server components cannot pass icon components as props to client components (serialization boundary). Pass `iconName` string prop and resolve inside the client component using an icon registry map. See `AdminPageShell.tsx` for the pattern.
