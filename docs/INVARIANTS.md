# TSEDA Invariants — the Handoff Codex

> Written 2026-07 on the last day of the model that built most of this
> system, so that ANY future maintainer — human or AI — can uphold it
> without re-deriving the reasoning. Each invariant states WHAT must hold,
> WHY it exists, and HOW to verify it mechanically. When you change code,
> find your invariant here first; when you add one, add its verify recipe.

**The one-command health check:** `npm run lint && npx tsc --noEmit &&
npm test && npm run test:sqlite` — 636+ tests × two storage backends.
Nearly every invariant below has a named guard inside that run.

---

## 1 · Storage

**I-S1. All entry traffic flows through the DataLayer façade.**
`lib/dataStore.ts` façade functions delegate to `createDataLayer()`
(`DATA_LAYER` env: `json` default | `sqlite`). Never construct
`new DataStore()` outside `JsonDataLayer`/file tooling, and never let
`JsonDataLayer` call the façade (infinite recursion — it uses the class).
*Verify:* `npm run test:sqlite` — any bypass shows up as missing data on
the sqlite backend (this is exactly how the exportService bypass was
caught).

**I-S2. Every entry write bumps the per-user store revision.**
JSON: inside `DataStore.writeCategoryStore`. SQLite: in each write method
of `SqliteDataLayer`. The revision powers the read-time self-heal.
*Verify:* `tests/wiring/syncStrategy.test.ts` (monotonic bump + heal).

**I-S3. Derived stores never trust a single refresh call — three sync layers.**
Write-time refresh (engine runner hooks) → read-time heal (`ensureUserIndex`
compares `UserIndex.storeRev` to the store revision, O(1)) → nightly
`runSyncReconcile` (rebuild every index, truth-sync every entry's feed
events). A forgotten refresh call is a *performance* bug, never a
correctness bug.
*Verify:* `syncStrategy.test.ts` (drift injection), `lifecycleFuzz.test.ts`
(terminal coherence).

**I-S4. Sync config stores stay synchronous; async stores stay locked.**
`facultyRegistry`/`roles`/`coordinators` are race-safe ONLY because their
read-modify-write never yields — one `await` reopens lost updates. Async
RMW stores (demo state, settings, award points, interview, feedback) hold
`withLock`. All config writes are atomic (temp+fsync+rename).
*Verify:* `tests/wiring/storeConcurrency.test.ts` (stress + the no-await
tripwire).

**I-S5. Path helpers are never re-prefixed.** `getUsersRootDir`/
`getUserStoreDir`/`getUserCategoryStoreFile`/`privateDataRoot` already
join `process.cwd()`. Wrapping them in another `join(cwd, …)` doubles the
path (the Pulse-backfill bug). New dynamic `path.join(process.cwd(),
getDataRoot(), …)` sites carry `/*turbopackIgnore: true*/`.
*Verify:* `tests/wiring/pathResolution.test.ts` (static scan + contracts).

## 2 · Workflow engine

**I-W1. All button/state logic derives from `computeWorkflowState`; all
mutations flow through the engine** (`lib/entries/internal/engine.ts` via
`lifecycle.ts`). Direct store writers must also refresh index+summary.
*Verify:* `lifecycleFuzz.test.ts` — 120+ seeded random actions; a rejected
action must leave the entry byte-identical (engine atomicity), statuses
stay in the legal set, locks never drop.

**I-W2. Two flows, one predicate root.** `record` flow = submit locks,
streak counts immediately, corrections re-requestable forever. The root
branch point is `isEditWindowExpired` (record+committed reads "expired").
Gold/silver tier comes ONLY from `getStreakTier` (record=silver,
permission=gold) — clients included.

**I-W3. Coordinator power is category-scoped and never self-applied** (E1:
a coordinator can never approve their own entry; master CAN self-grant —
deliberate, accountability lives in the action history). Master has NO
implicit `enterData` on DLC sheets.
*Verify:* `tests/admin/permissionMatrix.test.ts` (full role×action×resource
cross product, engine-proven denials).

## 3 · Department Pulse (feed)

**I-F1. Milestone-only privacy.** Events carry EXACTLY
`{id,type,actorEmail,categoryKey,createdAt,tier,withNames,milestone}` —
no entry data ever; collaborator names truncate to first names; the route
ships reaction COUNTS, never reactor emails. DLC categories never emit.
*Verify:* `tests/feed/feedPrivacy.test.ts` (sentinel poisoning).

**I-F2. The wall holds exactly the earned set.** `collectEntryMilestoneEvents`
is the single truth (started is CUMULATIVE — a finalized entry with its
streak intact keeps its started card); `syncEntryFeedEvents` reconciles
per-entry ids (kept cards keep reactions/timestamps); moderation
tombstones (`suppressedIds`) are never resurrected; win-count milestones
fire once per threshold, only on a FRESH win append. New per-entry event
kinds must be added to `perEntryEventIds` in `feedStore.ts`.
*Verify:* `tests/feed/feedEmissionLogic.test.ts` (the truth table) +
`feedBackfill.test.ts`.

## 4 · Demo mode

**I-D1. The ACTOR picks the universe; every route is `demoAware`-wrapped**
(scanner-enforced, exemptions: nextauth/cron/health). Never `enterWith`.
**I-D2. Wipes cannot touch real data** — `assertDemoPath` throws outside
`/demo`; sqlite: exit-wipe deletes the user's rows from the DEMO db,
universe-wipe closes handles first.
*Verify:* `tests/demo/routeGuard.test.ts`, `demoMode.test.ts`,
`newStoreIsolation.test.ts` (feed/backfill/revision/reconcile isolation).

## 5 · UI system

**I-U1. Zero hardcoded colors/strings** — theme tokens (lint-enforced
guard) and `t()`/`fieldLabel()` with en+ta parity (ta-completeness) AND
authenticity (`tamilAuthenticity.test.ts`: no English in a Tamil slot).
**I-U2. Accent-on-accent token pairs hold WCAG AA (≥4.5:1) in BOTH modes**
— `tests/wiring/contrastGuard.test.ts` recomputes real ratios from
`themeTokens.ts` every run. Light-palette fixes are darken-only.
**I-U3. One number, one home** (dashboard IA): hero = identity+action,
analytics strip owns every number. Loading states never fabricate stats.

## 6 · Deliberate decisions (do not "fix" without a ruling)

- Record-flow corrections are re-requestable forever (records must stay
  correctable); permission flow keeps one-request-ever + permanent locks.
- A record entry under a pending correction shows a "logged" card, not its
  win — celebration suspended during review, activity still visible.
- Archive-restore kills the streak (`streakPermanentlyRemoved`); BIN
  restore revives it (Q7). Different restores, different semantics.
- The first index read after a wipe may rebuild twice (creating missing
  category stores bumps the revision mid-build) — convergent by design.
- `.data` JSON remains the default backend until Elan runs the cutover in
  docs/SQLITE-MIGRATION.md phase 5. Rollback is `DATA_LAYER=json`.
- Multi-instance deployment remains a wall for BOTH backends' in-process
  locks — see docs/DEPLOYMENT.md before scaling.

## 7 · Recipes

- Fresh test data: `npm run seed:fresh` · wipe only: `npm run data:clear`.
- Backend parity: `npm run test:sqlite`.
- Migration (his machine, app stopped): backup → `npm run migrate:sqlite`
  → `DATA_LAYER=sqlite` → smoke per playbook → rollback = flip env
  (post-cutover writes come back via `npm run migrate:sqlite:reverse`).
- Fuzz harder: `FUZZ_SEED=<n> FUZZ_STEPS=<n> npm test` (failures print
  the seed — always reproducible).
- New category: `./scripts/add-category.sh` + its printed checklist;
  schema invariants + wiring-completeness tests validate the result.
