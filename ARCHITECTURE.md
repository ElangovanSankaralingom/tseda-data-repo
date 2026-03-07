# Architecture Freeze

This document defines the canonical architecture for the TCE data collection app as it exists now.

Its purpose is to prevent future drift. If code and this document disagree, fix the code or update this document deliberately. Do not silently add parallel logic.

## Core Principles

- One source of truth per concern.
- Public facades stay thin.
- Compatibility wrappers do not own business rules.
- Category pages are composition shells, not controller implementations.
- Schema and registry drive category-specific behavior.

## Canonical Source-of-Truth Modules

| Concern | Canonical module(s) | Notes |
| --- | --- | --- |
| Entry workflow statuses | [lib/types/entry.ts](/Users/thya/tseda-data-repo/lib/types/entry.ts) | Owns `ENTRY_STATUSES`, `EntryStatus`, and canonical status labels. |
| Workflow rules | [lib/entries/workflow.ts](/Users/thya/tseda-data-repo/lib/entries/workflow.ts) | Owns status normalization, commitment semantics, transitions, and approval locking. |
| Editor action-state rules | [lib/entries/editorLifecycle.ts](/Users/thya/tseda-data-repo/lib/entries/editorLifecycle.ts) | Owns Save / Generate / Done availability rules. |
| Persisted entry lifecycle operations | [lib/entries/lifecycle.ts](/Users/thya/tseda-data-repo/lib/entries/lifecycle.ts) | Public server-side facade for create/update/commit/send/approve/reject/delete/list operations. |
| Persisted entry engine internals | [lib/entries/internal/engine.ts](/Users/thya/tseda-data-repo/lib/entries/internal/engine.ts) | Owns persistence, validation, WAL/index refresh, and telemetry. |
| Streak/progress business rules | [lib/streakProgress.ts](/Users/thya/tseda-data-repo/lib/streakProgress.ts) | Only canonical business-progress / streak rule layer. |
| Streak cache/snapshot | [lib/data/indexStore.ts](/Users/thya/tseda-data-repo/lib/data/indexStore.ts) | May cache canonical streak output only. |
| Dashboard summary | [lib/dashboard/getDashboardSummary.ts](/Users/thya/tseda-data-repo/lib/dashboard/getDashboardSummary.ts) | Must present canonical summary output only. |
| Export pipeline | [lib/export/exportService.ts](/Users/thya/tseda-data-repo/lib/export/exportService.ts) | Canonical schema-driven export/reporting path. |
| Cross-category export fields | [data/schemas/exportConfig.ts](/Users/thya/tseda-data-repo/data/schemas/exportConfig.ts) | Base export columns common to all categories. |
| Category registry | [data/categoryRegistry.ts](/Users/thya/tseda-data-repo/data/categoryRegistry.ts) | Canonical category list, labels, schema binding, summary keys, and UI metadata. |
| Category schema contract | [data/schemas/types.ts](/Users/thya/tseda-data-repo/data/schemas/types.ts) | Defines the schema shape every category must implement. |
| Category schemas | `data/schemas/*.ts` | Own per-category fields, validation, commit requirements, pending immutability, and export metadata. |
| Canonical navigation helpers | [lib/entryNavigation.ts](/Users/thya/tseda-data-repo/lib/entryNavigation.ts) | Owns route construction and safe back-navigation helpers. |
| Migration / legacy normalization boundary | [lib/migrations/index.ts](/Users/thya/tseda-data-repo/lib/migrations/index.ts), [lib/dataStore.ts](/Users/thya/tseda-data-repo/lib/dataStore.ts) | Only place legacy persisted shapes/statuses may be accepted. |

## Canonical Workflow State Model

Internal workflow state is canonical and uppercase only:

- `DRAFT`
- `PENDING_CONFIRMATION`
- `APPROVED`
- `REJECTED`

Canonical type source:

- [lib/types/entry.ts](/Users/thya/tseda-data-repo/lib/types/entry.ts)

Canonical rule source:

- [lib/entries/workflow.ts](/Users/thya/tseda-data-repo/lib/entries/workflow.ts)

Allowed transitions:

- `DRAFT -> PENDING_CONFIRMATION`
- `REJECTED -> PENDING_CONFIRMATION`
- `PENDING_CONFIRMATION -> APPROVED`
- `PENDING_CONFIRMATION -> REJECTED`

Important invariants:

- Approved entries are locked by canonical workflow state only.
- Legacy lowercase workflow values such as `"draft"` and `"final"` are not valid internal workflow state.
- Legacy workflow values may be accepted only at the migration/datastore boundary, then normalized immediately.

## Lifecycle Ownership

### Public persisted lifecycle entrypoint

- [lib/entries/lifecycle.ts](/Users/thya/tseda-data-repo/lib/entries/lifecycle.ts)

Edit this file when:

- you need to expose a new persisted entry operation to the rest of the app
- you want to change the public server-side lifecycle API shape

Do not put business rules here.

### Internal persistence/orchestration

- [lib/entries/internal/engine.ts](/Users/thya/tseda-data-repo/lib/entries/internal/engine.ts)

Edit this file when:

- changing datastore writes/reads
- changing validation/orchestration around persisted operations
- changing WAL/index refresh behavior
- changing telemetry attached to lifecycle operations

Do not put canonical workflow semantics here.

### Workflow rules

- [lib/entries/workflow.ts](/Users/thya/tseda-data-repo/lib/entries/workflow.ts)

Edit this file when:

- changing workflow normalization
- changing commitment semantics
- changing approval/rejection transitions
- changing approval lock behavior

### Editor action-state rules

- [lib/entries/editorLifecycle.ts](/Users/thya/tseda-data-repo/lib/entries/editorLifecycle.ts)

Edit this file when:

- changing Save Draft / Generate / Save & Close availability
- changing dirty-stage semantics
- changing action enable/disable rules for the editor

## Compatibility Wrappers

These files exist for compatibility and migration only. New business logic should not be added to them.

- [lib/entries/stateMachine.ts](/Users/thya/tseda-data-repo/lib/entries/stateMachine.ts)
  - deprecated wrapper around `workflow.ts` and `editorLifecycle.ts`
- [lib/entries/engine.ts](/Users/thya/tseda-data-repo/lib/entries/engine.ts)
  - deprecated wrapper around `internal/engine.ts`
- [lib/gamification.ts](/Users/thya/tseda-data-repo/lib/gamification.ts)
  - deprecated wrapper around streak utilities; canonical streak business rules do not live here

Rule:

- If you are about to edit one of these files for new behavior, stop and move that change to the canonical owner instead.

## Streak / Progress Ownership

Canonical business-progress ownership:

- [lib/streakProgress.ts](/Users/thya/tseda-data-repo/lib/streakProgress.ts)

This module owns:

- activated/win counting
- canonical streak metadata transitions
- streak eligibility decisions
- canonical aggregate/snapshot computation

Consumers:

- [lib/data/indexStore.ts](/Users/thya/tseda-data-repo/lib/data/indexStore.ts)
  - may cache canonical output
- [lib/dashboard/getDashboardSummary.ts](/Users/thya/tseda-data-repo/lib/dashboard/getDashboardSummary.ts)
  - may present canonical output

Utility-only streak helpers:

- [lib/streakState.ts](/Users/thya/tseda-data-repo/lib/streakState.ts)
- [lib/streakTiming.ts](/Users/thya/tseda-data-repo/lib/streakTiming.ts)
- [lib/time.ts](/Users/thya/tseda-data-repo/lib/time.ts)

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

- [lib/export/exportService.ts](/Users/thya/tseda-data-repo/lib/export/exportService.ts)
- [data/categoryRegistry.ts](/Users/thya/tseda-data-repo/data/categoryRegistry.ts)
- [data/schemas/types.ts](/Users/thya/tseda-data-repo/data/schemas/types.ts)
- [data/schemas/exportConfig.ts](/Users/thya/tseda-data-repo/data/schemas/exportConfig.ts)
- category schema files in `data/schemas/*.ts`

Hard rules:

- Do not hardcode export columns in pages.
- Do not duplicate export labels in pages or routes.
- Do not define alternate status filtering logic outside canonical `EntryStatus`.

## Category Registry / Schema Ownership

Canonical category registry:

- [data/categoryRegistry.ts](/Users/thya/tseda-data-repo/data/categoryRegistry.ts)

It owns:

- category slug list
- display labels
- schema binding
- summary keys
- category capabilities
- title field / title fallback metadata

Canonical schema contract:

- [data/schemas/types.ts](/Users/thya/tseda-data-repo/data/schemas/types.ts)

Each category schema owns:

- field definitions
- field labels
- field kinds
- validation rules
- `requiredForCommit`
- `immutableWhenPending`
- export metadata on fields

There is no active separate schema registry module. The registry is the category registry plus the individual schema files.

## Category Page Architecture

The category data-entry pages are intentionally thin composition shells.

Shared controller/rendering modules:

- [hooks/useCategoryEntryPageController.ts](/Users/thya/tseda-data-repo/hooks/useCategoryEntryPageController.ts)
- [hooks/useEntryWorkflow.ts](/Users/thya/tseda-data-repo/hooks/useEntryWorkflow.ts)
- [components/data-entry/CategoryEntryPageShell.tsx](/Users/thya/tseda-data-repo/components/data-entry/CategoryEntryPageShell.tsx)
- [components/data-entry/EntryListCardShell.tsx](/Users/thya/tseda-data-repo/components/data-entry/EntryListCardShell.tsx)
- [components/data-entry/GroupedEntrySections.tsx](/Users/thya/tseda-data-repo/components/data-entry/GroupedEntrySections.tsx)

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

- [lib/entryNavigation.ts](/Users/thya/tseda-data-repo/lib/entryNavigation.ts)

Hard rule:

- Do not rebuild entry/dashboard/admin paths ad hoc in pages when a helper already exists here.

## Compatibility Boundary Rules

Legacy compatibility is allowed only at explicit boundaries:

- [lib/migrations/index.ts](/Users/thya/tseda-data-repo/lib/migrations/index.ts)
- [lib/dataStore.ts](/Users/thya/tseda-data-repo/lib/dataStore.ts)

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
- approval lock rules
- streak business rules
- export columns/labels
- category lists
- navigation path construction

Do not add new business logic to:

- [lib/entries/stateMachine.ts](/Users/thya/tseda-data-repo/lib/entries/stateMachine.ts)
- [lib/entries/engine.ts](/Users/thya/tseda-data-repo/lib/entries/engine.ts)
- [lib/gamification.ts](/Users/thya/tseda-data-repo/lib/gamification.ts)

When changing behavior, edit the canonical owner directly:

- workflow rules -> [workflow.ts](/Users/thya/tseda-data-repo/lib/entries/workflow.ts)
- editor action-state rules -> [editorLifecycle.ts](/Users/thya/tseda-data-repo/lib/entries/editorLifecycle.ts)
- persisted lifecycle operations -> [lifecycle.ts](/Users/thya/tseda-data-repo/lib/entries/lifecycle.ts) and [internal/engine.ts](/Users/thya/tseda-data-repo/lib/entries/internal/engine.ts)
- streak/progress rules -> [streakProgress.ts](/Users/thya/tseda-data-repo/lib/streakProgress.ts)
- exports -> [exportService.ts](/Users/thya/tseda-data-repo/lib/export/exportService.ts)
- category definitions -> [categoryRegistry.ts](/Users/thya/tseda-data-repo/data/categoryRegistry.ts) and `data/schemas/*.ts`

## How To Add A New Category Safely

1. Add a schema file in `data/schemas/<category>.ts`.
   - Implement [EntrySchema](/Users/thya/tseda-data-repo/data/schemas/types.ts).
   - Define fields, labels, validation, `requiredForCommit`, `immutableWhenPending`, and export metadata.

2. Register the category in [data/categoryRegistry.ts](/Users/thya/tseda-data-repo/data/categoryRegistry.ts).
   - Add slug, label, schema, summary key, capabilities, title field, and fallback title.

3. Let registry-derived systems pick it up automatically where applicable.
   - category list pages
   - search filters
   - export category options
   - summary/category metadata helpers
   - category store file mapping derived from `CATEGORY_LIST`

4. Add the category page at `app/(protected)/data-entry/<category>/page.tsx`.
   - Use [useCategoryEntryPageController.ts](/Users/thya/tseda-data-repo/hooks/useCategoryEntryPageController.ts).
   - Use [CategoryEntryPageShell.tsx](/Users/thya/tseda-data-repo/components/data-entry/CategoryEntryPageShell.tsx).
   - Use [EntryListCardShell.tsx](/Users/thya/tseda-data-repo/components/data-entry/EntryListCardShell.tsx).
   - Use [GroupedEntrySections.tsx](/Users/thya/tseda-data-repo/components/data-entry/GroupedEntrySections.tsx).
   - Keep the page thin.

5. Add the category API route(s) under `app/api/me/<category>/`.
   - Use canonical lifecycle operations from [lifecycle.ts](/Users/thya/tseda-data-repo/lib/entries/lifecycle.ts).
   - Use canonical workflow rules from [workflow.ts](/Users/thya/tseda-data-repo/lib/entries/workflow.ts).
   - Use canonical streak helpers from [streakProgress.ts](/Users/thya/tseda-data-repo/lib/streakProgress.ts).

6. Add or update tests.
   - schema validation coverage
   - persisted lifecycle behavior
   - any category-specific route behavior
   - search/export behavior if the category introduces meaningful new fields

7. Validate the architecture invariants.
   - no duplicated status arrays
   - no duplicated workflow rules
   - no page-local export logic
   - no page-local streak logic

## Test-Backed Architecture Invariants

Important invariant coverage currently lives in:

- [tests/entries/confirmationStateMachine.test.ts](/Users/thya/tseda-data-repo/tests/entries/confirmationStateMachine.test.ts)
- [tests/entries/stateMachine.test.ts](/Users/thya/tseda-data-repo/tests/entries/stateMachine.test.ts)
- [tests/entries/streakProgress.test.ts](/Users/thya/tseda-data-repo/tests/entries/streakProgress.test.ts)
- [tests/entries/exportService.test.ts](/Users/thya/tseda-data-repo/tests/entries/exportService.test.ts)
- [tests/entries/dataStore.test.ts](/Users/thya/tseda-data-repo/tests/entries/dataStore.test.ts)
- [tests/entries/migrations.test.ts](/Users/thya/tseda-data-repo/tests/entries/migrations.test.ts)
- [tests/entries/indexStore.test.ts](/Users/thya/tseda-data-repo/tests/entries/indexStore.test.ts)

When changing canonical architecture, update the relevant invariant tests in the same change.
