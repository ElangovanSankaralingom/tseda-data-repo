# Contributing

## Before You Start

Read these documents before making any changes:

- [ARCHITECTURE.md](ARCHITECTURE.md) — canonical ownership rules and anti-drift policy
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — UI patterns, colors, component specs

## Branch Strategy

- Work on feature branches off `dev`
- PR into `dev` for review
- `main` receives merged, tested code only

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add workshop PDF generation
fix: correct streak count after entry deletion
refactor: extract common upload validation
docs: update API.md with new route
test: add migration edge-case coverage
style: align card padding with design system
```

## PR Checklist

Before opening a pull request, all of these must pass:

```bash
npm run build    # Production build succeeds
npm test         # All tests pass
npm run lint     # No lint errors
```

## Architecture Rules

### Anti-Drift Checklist

Before submitting, verify:

- [ ] No duplicated status arrays — `ENTRY_STATUSES` is defined only in `lib/types/entry.ts`
- [ ] No logic in deprecated wrappers — `lib/entries/stateMachine.ts`, `lib/entries/engine.ts`, `lib/gamification.ts` are compatibility-only
- [ ] No hardcoded category lists — use `data/categoryRegistry.ts`
- [ ] No page-local streak/export logic — use `lib/streakProgress.ts` and `lib/export/exportService.ts`
- [ ] No ad-hoc navigation paths — use `lib/entryNavigation.ts`
- [ ] No duplicate workflow transitions — use `lib/entries/workflow.ts`

### Module Ownership

When changing behavior, edit the canonical owner:

| Change | Edit |
|---|---|
| Workflow transitions | `lib/entries/workflow.ts` |
| Editor action-state rules | `lib/entries/editorLifecycle.ts` |
| Server-side lifecycle | `lib/entries/lifecycle.ts` + `lib/entries/internal/engine.ts` |
| Streak/progress rules | `lib/streakProgress.ts` |
| Export pipeline | `lib/export/exportService.ts` |
| Category definitions | `data/categoryRegistry.ts` + `data/schemas/*.ts` |

## Adding a New Category

Follow the 7-step checklist in [ARCHITECTURE.md](ARCHITECTURE.md#how-to-add-a-new-category-safely):

1. Create schema in `data/schemas/<category>.ts` implementing `EntrySchema`
2. Register in `data/categoryRegistry.ts`
3. Let registry-derived systems pick it up (search, export, summary)
4. Add page at `app/(protected)/data-entry/<category>/page.tsx` using shared shells
5. Add API route(s) under `app/api/me/<category>/`
6. Add or update tests (schema validation, lifecycle, route behavior)
7. Validate architecture invariants (no duplicated arrays, no page-local logic)

## Adding UI Changes

Follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md):

- Use the canonical color palette (zinc base, blue primary, emerald success, amber warning, red destructive)
- Use existing component patterns (`Card`, `Badge`, `Button` variants)
- Follow the responsive breakpoints (`sm:640px`, `md:768px`, `lg:1024px`)
- Match page layout templates (max-w-5xl centered, consistent spacing)

## Test Requirements

- Tests use Node's built-in test runner (`node --test`), not Jest or Vitest
- Path alias `@/` resolved via `tests/helpers/pathAliasLoader.mjs`
- When changing canonical modules, update corresponding tests:
  - Workflow rules → `tests/entries/confirmationStateMachine.test.ts`
  - Streak logic → `tests/entries/streakProgress.test.ts`
  - Export pipeline → `tests/entries/exportService.test.ts`
  - Data store → `tests/entries/dataStore.test.ts`
  - Migrations → `tests/entries/migrations.test.ts`
  - Index store → `tests/entries/indexStore.test.ts`
