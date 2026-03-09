# Architecture Freeze

This document defines the canonical architecture for the TCE data collection app as it exists now.

Its purpose is to prevent future drift. If code and this document disagree, fix the code or update this document deliberately. Do not silently add parallel logic.

## Core Principles

- One source of truth per concern.
- Public facades stay thin.
- Compatibility wrappers do not own business rules.
- Category pages are composition shells, not controller implementations.
- Schema and registry drive category-specific behavior.
- Five Category Route Rule: any change to one route/adapter must apply to ALL FIVE.

## Canonical Source-of-Truth Modules

| Concern | Canonical module(s) | Notes |
| --- | --- | --- |
| Entry workflow statuses | `lib/types/entry.ts` | Owns `ENTRY_STATUSES`, `EntryStatus`, and canonical status labels. |
| Workflow rules | `lib/entries/workflow.ts` | Owns status normalization, commitment semantics, transitions, and finalization locking. |
| Persisted entry lifecycle operations | `lib/entries/lifecycle.ts` | Public server-side facade for create/update/commit/request/approve/delete/list operations. |
| Persisted entry engine internals | `lib/entries/internal/engine.ts` | Owns persistence, validation, WAL/index refresh, and telemetry. |
| Post-save normalization | `lib/entries/postSave.ts` | Normalizes streak fields and PDF state after route-level saves. Workaround for routes bypassing engine.ts. |
| PDF staleness and hashing | `lib/pdfSnapshot.ts` | Owns hashPrePdfFields, computePdfState, getHashPayload. Determines if PDF needs regeneration. |
| Streak/progress business rules | `lib/streakProgress.ts` | Only canonical business-progress / streak rule layer. |
| Streak cache/snapshot | `lib/data/indexStore.ts` | May cache canonical streak output only. |
| Dashboard summary | `lib/dashboard/getDashboardSummary.ts` | Must present canonical summary output only. |
| Export pipeline | `lib/export/exportService.ts` | Canonical schema-driven export/reporting path. |
| Cross-category export fields | `data/schemas/exportConfig.ts` | Base export columns common to all categories. |
| Category registry | `data/categoryRegistry.ts` | Canonical category list, labels, schema binding, summary keys, and UI metadata. |
| Category schema contract | `data/schemas/types.ts` | Defines the schema shape every category must implement. |
| Category schemas | `data/schemas/*.ts` | Own per-category fields, validation, commit requirements, and export metadata. |
| Canonical navigation helpers | `lib/entryNavigation.ts` | Owns route construction and safe back-navigation helpers. |
| Migration / legacy normalization boundary | `lib/migrations/index.ts`, `lib/dataStore.ts` | Only place legacy persisted shapes/statuses may be accepted. |

## Canonical Workflow State Model

Internal workflow state is canonical and uppercase only:

- `DRAFT` -- initial state, editable
- `GENERATED` -- entry committed with PDF generated, in edit window
- `EDIT_REQUESTED` -- user requested edit on finalized entry, awaiting admin
- `DELETE_REQUESTED` -- user requested deletion, awaiting admin
- `EDIT_GRANTED` -- admin granted edit access, user can modify and re-finalize
- `ARCHIVED` -- entry deleted/archived after admin approval

Canonical type source:

- `lib/types/entry.ts`

Canonical rule source:

- `lib/entries/workflow.ts`

Allowed transitions:

- `DRAFT` -> `GENERATED` (commit / Generate PDF)
- `GENERATED` -> `EDIT_REQUESTED` (user requests edit)
- `GENERATED` -> `DELETE_REQUESTED` (user requests deletion)
- `EDIT_REQUESTED` -> `EDIT_GRANTED` (admin grants)
- `EDIT_REQUESTED` -> `GENERATED` (admin rejects / user cancels)
- `DELETE_REQUESTED` -> `ARCHIVED` (admin approves)
- `DELETE_REQUESTED` -> `GENERATED` (admin rejects / user cancels)
- `EDIT_GRANTED` -> `GENERATED` (user re-finalizes)

Important invariants:

- Finalized entries (timer expired or Finalise Now) are locked by workflow state.
- After second finalization (re-finalization from EDIT_GRANTED), `permanentlyLocked = true`. Request Edit is blocked; Request Delete remains available.
- Legacy lowercase workflow values such as `"draft"` and `"final"` are not valid internal workflow state.
- Legacy workflow values may be accepted only at the migration/datastore boundary, then normalized immediately.

## Entry Lifecycle and Timer System

Entries follow a time-based finalization flow:

1. **Create** -- entry starts as DRAFT
2. **Generate PDF** -- entry transitions to GENERATED, timer starts
3. **Edit window** -- user can edit Stage 1 fields (marks PDF stale) and upload Stage 2 files
4. **Finalize** -- happens automatically when timer expires, or manually via "Finalise Now"
5. **Post-finalization** -- entry is read-only; user can Request Edit or Request Delete

Timer durations:
- Non-streak entries: **3 days** from first GENERATED transition
- Streak entries: **endDate + 8 days**
- Timer never resets once `editWindowExpiresAt` is set

## Two-Stage Field Model

### Stage 1: Data fields
Text inputs, dates, selections, descriptions. Changes to Stage 1 fields mark the PDF as stale (`pdfStale = true`). User must regenerate PDF before finalizing.

### Stage 2: File uploads
Permission letters, completion certificates, geotagged photos, brochures. Changes to Stage 2 fields do NOT affect PDF staleness. Users can upload/remove files without regenerating the PDF.

Source: `lib/pdfSnapshot.ts` -- `hashPrePdfFields()` only hashes Stage 1 fields.

## 5 Routes Bypass engine.ts

The 5 category API routes (`app/api/me/<category>/route.ts`) handle their own read/write logic and field normalization. They do not fully route through `lib/entries/internal/engine.ts` for all operations.

**Consequence:** Any field normalization that engine.ts would do must be replicated in `lib/entries/postSave.ts`, which runs after each route-level save to ensure consistency of streak fields, PDF state, and computed values.

**Rule:** When adding new computed fields or normalization logic, add it to BOTH `engine.ts` AND `postSave.ts`.

## Lifecycle Ownership

### Public persisted lifecycle entrypoint

- `lib/entries/lifecycle.ts`

Edit this file when:

- you need to expose a new persisted entry operation to the rest of the app
- you want to change the public server-side lifecycle API shape

Do not put business rules here.

### Internal persistence/orchestration

- `lib/entries/internal/engine.ts`

Edit this file when:

- changing datastore writes/reads
- changing validation/orchestration around persisted operations
- changing WAL/index refresh behavior
- changing telemetry attached to lifecycle operations

Do not put canonical workflow semantics here.

### Workflow rules

- `lib/entries/workflow.ts`

Edit this file when:

- changing workflow normalization
- changing commitment semantics
- changing request/grant transitions
- changing finalization lock behavior

### Post-save normalization

- `lib/entries/postSave.ts`

Edit this file when:

- adding new computed fields that routes must normalize
- changing streak field logic
- changing PDF staleness computation at the route level

## Compatibility Wrappers

These files exist for compatibility and migration only. New business logic should not be added to them.

- `lib/entries/editorLifecycle.ts` -- legacy editor action-state rules; may not reflect current behavior

Rule:

- If you are about to edit one of these files for new behavior, stop and move that change to the canonical owner instead.

## Streak / Progress Ownership

Canonical business-progress ownership:

- `lib/streakProgress.ts`

This module owns:

- activated/win counting
- canonical streak metadata transitions
- streak eligibility decisions
- canonical aggregate/snapshot computation

See `STREAK-SPECIFICATION.md` for the full streak system spec.

Consumers:

- `lib/data/indexStore.ts` -- may cache canonical output
- `lib/dashboard/getDashboardSummary.ts` -- may present canonical output

Utility-only streak helpers:

- `lib/streakState.ts`
- `lib/streakTiming.ts`
- `lib/time.ts`

Hard rule:

- No dashboard, index, page, API route, or helper may define its own competing streak business rule.

## Export / Reporting Ownership

Canonical export pipeline:

1. Category registry resolves the category and schema.
2. Schema field definitions provide exportable fields, labels, ordering, and format hints.
3. Canonical normalized stored entries are loaded from the datastore.
4. Canonical status/category/date filters are applied.
5. Shared formatting logic generates CSV/XLSX rows.

Canonical modules:

- `lib/export/exportService.ts`
- `data/categoryRegistry.ts`
- `data/schemas/types.ts`
- `data/schemas/exportConfig.ts`
- category schema files in `data/schemas/*.ts`

Hard rules:

- Do not hardcode export columns in pages.
- Do not duplicate export labels in pages or routes.
- Do not define alternate status filtering logic outside canonical `EntryStatus`.

## Category Registry / Schema Ownership

Canonical category registry:

- `data/categoryRegistry.ts`

It owns:

- category slug list
- display labels
- schema binding
- summary keys
- category capabilities
- title field / title fallback metadata

Canonical schema contract:

- `data/schemas/types.ts`

Each category schema owns:

- field definitions
- field labels
- field kinds
- validation rules
- `requiredForCommit`
- export metadata on fields

There is no active separate schema registry module. The registry is the category registry plus the individual schema files.

## Category Page Architecture

The category data-entry pages are intentionally thin composition shells.

Shared controller/rendering modules:

- `hooks/useCategoryEntryPageController.ts`
- `hooks/useEntryWorkflow.ts`
- `components/data-entry/CategoryEntryPageShell.tsx`
- `components/data-entry/EntryListCardShell.tsx`
- `components/data-entry/GroupedEntrySections.tsx`

Category pages should own only:

- category-specific field rendering
- category-specific labels/text
- category-specific payload shaping
- category-specific upload widgets/requirements
- category-specific entry-card details

Category pages should not own:

- generic save orchestration
- generic save & close orchestration
- grouped section scaffolding
- generic list-card scaffolding
- generic action-state formulas

## Navigation Ownership

Canonical navigation helpers:

- `lib/entryNavigation.ts`

Hard rule:

- Do not rebuild entry/dashboard/admin paths ad hoc in pages when a helper already exists here.

## Compatibility Boundary Rules

Legacy compatibility is allowed only at explicit boundaries:

- `lib/migrations/index.ts`
- `lib/dataStore.ts`

This includes:

- old persisted shapes
- old workflow status forms
- migration of legacy category/user index files

Hard rule:

- After normalization, internal code must use only canonical shapes and canonical workflow states.

## Anti-Drift Rules

Do not duplicate:

- workflow status unions
- status arrays
- workflow transitions
- finalization lock rules
- streak business rules
- export columns/labels
- category lists
- navigation path construction

Do not add new business logic to:

- `lib/entries/editorLifecycle.ts`

When changing behavior, edit the canonical owner directly:

- workflow rules -> `lib/entries/workflow.ts`
- post-save normalization -> `lib/entries/postSave.ts`
- PDF staleness -> `lib/pdfSnapshot.ts`
- persisted lifecycle operations -> `lib/entries/lifecycle.ts` and `lib/entries/internal/engine.ts`
- streak/progress rules -> `lib/streakProgress.ts`
- exports -> `lib/export/exportService.ts`
- category definitions -> `data/categoryRegistry.ts` and `data/schemas/*.ts`

## How To Add A New Category Safely

1. Add a schema file in `data/schemas/<category>.ts`.
   - Implement `EntrySchema` from `data/schemas/types.ts`.
   - Define fields, labels, validation, `requiredForCommit`, and export metadata.

2. Register the category in `data/categoryRegistry.ts`.
   - Add slug, label, schema, summary key, capabilities, title field, and fallback title.

3. Let registry-derived systems pick it up automatically where applicable.
   - category list pages
   - search filters
   - export category options
   - summary/category metadata helpers
   - category store file mapping derived from `CATEGORY_LIST`

4. Add the category page at `app/(protected)/data-entry/<category>/page.tsx`.
   - Use `hooks/useCategoryEntryPageController.ts`.
   - Use `components/data-entry/CategoryEntryPageShell.tsx`.
   - Use `components/data-entry/EntryListCardShell.tsx`.
   - Use `components/data-entry/GroupedEntrySections.tsx`.
   - Keep the page thin.

5. Add the category API route(s) under `app/api/me/<category>/`.
   - Use canonical lifecycle operations from `lib/entries/lifecycle.ts`.
   - Use canonical workflow rules from `lib/entries/workflow.ts`.
   - Call `postSave.ts` normalization after saves.
   - Use canonical streak helpers from `lib/streakProgress.ts`.

6. Add the adapter component in `components/data-entry/adapters/<category>.tsx`.
   - Follow the Five Category Route Rule -- match the pattern of existing adapters.

7. Add or update tests.
   - schema validation coverage
   - persisted lifecycle behavior
   - any category-specific route behavior
   - search/export behavior if the category introduces meaningful new fields

8. Validate the architecture invariants.
   - no duplicated status arrays
   - no duplicated workflow rules
   - no page-local export logic
   - no page-local streak logic

## Test-Backed Architecture Invariants

Important invariant coverage currently lives in:

- `tests/entries/confirmationStateMachine.test.ts`
- `tests/entries/engine.test.ts`
- `tests/entries/streakProgress.test.ts`
- `tests/entries/exportService.test.ts`
- `tests/entries/dataStore.test.ts`
- `tests/entries/migrations.test.ts`
- `tests/entries/indexStore.test.ts`

When changing canonical architecture, update the relevant invariant tests in the same change.
