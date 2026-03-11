# Schema-Driven Workflow Engine — Modular, Scalable, Category-Agnostic

## Problem
Currently, button states, timer behavior, auto-actions, and admin interactions are scattered across:
- EntryActionsBar.tsx (button visibility/disabled logic)
- BaseEntryAdapter.tsx (canFinalise, isPendingRequest checks)
- CategoryEntryRecordCard.tsx (card action buttons per group)
- workflow.ts (status transitions)
- engineRequests.ts (request logic)
- engineAdmin.ts (admin actions)
- nightly/route.ts (auto-archive)
- Multiple hooks (useRequestEdit, useRequestDelete, useEntryWorkflow)

Adding a new category or changing behavior requires touching 10+ files.

## Solution: Declarative Workflow Schema

### 1. Workflow Config per Category

Each category defines its workflow rules in the schema:

```typescript
// data/schemas/fdp-attended.ts
export const fdpAttendedSchema = {
  fields: [...], // existing field definitions
  
  workflow: {
    // Timer
    timer: {
      defaultWindowDays: 3,
      streakBufferDays: 8,
      pauseOnRequest: true,         // pause timer during EDIT/DELETE_REQUESTED
      autoFinaliseOnExpiry: true,    // auto-finalise if complete when timer expires
      autoDeleteOnExpiry: true,      // auto-delete if incomplete when timer expires
    },

    // Request Actions
    requests: {
      maxEditRequests: 1,           // one chance only
      maxDeleteRequests: 1,         // one chance only
      rejectLocksEntry: true,       // rejection = permanently locked
      cancelLocksEntry: true,       // user cancel = permanently locked
    },

    // Completion Rules
    completion: {
      requireAllStage1: true,       // all stage 1 fields must be filled
      requireAllStage2: true,       // all stage 2 uploads must be present
      requireFreshPdf: true,        // PDF must not be stale
    },

    // Auto-Actions (nightly job)
    autoActions: {
      deleteIncompleteOnExpiry: true,    // delete if incomplete when timer expires
      finaliseCompleteOnExpiry: true,    // finalise if complete when timer expires
      deleteStaleOnExpiry: true,         // delete if PDF stale when timer expires
    },

    // Button Visibility Rules
    buttons: {
      save: { 
        showWhen: ["DRAFT", "GENERATED", "EDIT_GRANTED"],
        enableWhen: "fieldsDirty && !saving && !locked",
      },
      generate: {
        showWhen: ["DRAFT", "GENERATED", "EDIT_GRANTED"],
        enableWhen: "stage1Complete && (noPdf || pdfStale) && !saving",
      },
      finalise: {
        showWhen: ["GENERATED", "EDIT_GRANTED"],
        enableWhen: "allFieldsComplete && pdfFresh && !pendingRequest && !locked",
      },
      requestAction: {
        showWhen: ["GENERATED"],
        enableWhen: "finalized && !locked && !requestActionUsed",
      },
    },
  },
};
```

### 2. Workflow Engine (lib/workflow/workflowEngine.ts)

A single engine that reads the schema and computes everything:

```typescript
export type WorkflowState = {
  // Current status
  status: EntryStatus;
  isEditable: boolean;
  isFinalized: boolean;
  isPermanentlyLocked: boolean;
  
  // Timer
  timer: {
    isPaused: boolean;
    isExpired: boolean;
    remainingMs: number | null;
    expiresAt: string | null;
  };
  
  // Button states
  buttons: {
    save: { visible: boolean; enabled: boolean; label: string };
    generate: { visible: boolean; enabled: boolean; label: string };
    finalise: { visible: boolean; enabled: boolean; label: string; disabledReason?: string };
    requestAction: { visible: boolean; enabled: boolean; options: RequestOption[] };
    cancel: { visible: boolean; enabled: boolean; label: string };
  };
  
  // Completion
  completion: {
    stage1Complete: boolean;
    stage2Complete: boolean;
    allComplete: boolean;
    pdfExists: boolean;
    pdfFresh: boolean;
  };
  
  // Request state
  requestState: {
    hasActiveRequest: boolean;
    requestType: "edit" | "delete" | null;
    canRequest: boolean;
    canCancel: boolean;
  };
};

export function computeWorkflowState(
  entry: Record<string, unknown>,
  category: string,
  schema: CategorySchema,
): WorkflowState {
  const config = schema.workflow;
  const status = normalizeEntryStatus(entry);
  
  // Compute all states from schema rules...
  // This is the SINGLE SOURCE OF TRUTH for all button/action states
}
```

### 3. Nightly Job Engine (lib/workflow/nightlyProcessor.ts)

Reads the workflow config and processes expired entries:

```typescript
export async function processExpiredEntries() {
  for (const category of CATEGORY_KEYS) {
    const schema = getCategorySchema(category);
    const config = schema.workflow;
    
    for (const user of users) {
      const entries = await listEntriesForCategory(user, category);
      
      for (const entry of entries) {
        const state = computeWorkflowState(entry, category, schema);
        
        // Skip paused timers
        if (state.timer.isPaused) continue;
        
        // Skip not expired
        if (!state.timer.isExpired) continue;
        
        // Skip already locked
        if (state.isPermanentlyLocked) continue;
        
        // Apply auto-actions based on config
        if (state.completion.allComplete && state.completion.pdfFresh) {
          if (config.autoActions.finaliseCompleteOnExpiry) {
            await autoFinalise(user, category, entry);
          }
        } else {
          if (config.autoActions.deleteIncompleteOnExpiry) {
            await permanentlyDelete(user, category, entry);
          }
        }
      }
    }
  }
}
```

### 4. Frontend Hook (hooks/useWorkflowState.ts)

Single hook that replaces all the scattered button logic:

```typescript
export function useWorkflowState(entry: Entry, category: string) {
  const schema = getCategorySchema(category);
  
  return useMemo(() => {
    return computeWorkflowState(entry, category, schema);
  }, [entry, category, schema]);
}
```

Used in BaseEntryAdapter:
```typescript
const workflow = useWorkflowState(form, category);

// Instead of scattered checks:
// workflow.buttons.save.enabled
// workflow.buttons.generate.visible
// workflow.buttons.finalise.enabled
// workflow.requestState.canRequest
// workflow.timer.isPaused
```

### 5. Entry Card Actions (auto-derived)

CategoryEntryRecordCard reads workflow state instead of checking groups:

```typescript
function EntryCardActions({ entry, category }) {
  const workflow = useWorkflowState(entry, category);
  
  return (
    <>
      {workflow.buttons.save.visible && (
        <ActionButton disabled={!workflow.buttons.save.enabled}>
          {workflow.buttons.save.label}
        </ActionButton>
      )}
      {workflow.buttons.requestAction.visible && (
        <RequestActionDropdown 
          disabled={!workflow.buttons.requestAction.enabled}
          options={workflow.buttons.requestAction.options}
        />
      )}
      {/* ... etc */}
    </>
  );
}
```

### 6. Adding a New Category

With this system, adding a new category means:

1. Define fields in `data/schemas/new-category.ts`
2. Set `workflow` config (copy from existing, modify rules)
3. Register in `categoryRegistry.ts`
4. Run `./scripts/add-category.sh`

ZERO changes to:
- Button components
- Action bar logic
- Nightly job
- Request handling
- Timer logic
- Admin console

Everything auto-derives from the schema.

## Migration Plan

### Phase 1: Create the engine (no UI changes)
1. Create `lib/workflow/workflowEngine.ts` with `computeWorkflowState`
2. Create `lib/workflow/workflowConfig.ts` with the config types
3. Add `workflow` config to each schema (default values matching current behavior)
4. Create `hooks/useWorkflowState.ts`
5. Write tests: verify computeWorkflowState produces correct states for all 6 statuses

### Phase 2: Migrate button logic
1. Replace scattered checks in BaseEntryAdapter with `useWorkflowState`
2. Replace checks in EntryActionsBar with workflow state props
3. Replace checks in CategoryEntryRecordCard with workflow state
4. Remove duplicate logic from CategoryEntryPageShell

### Phase 3: Migrate nightly job
1. Create `lib/workflow/nightlyProcessor.ts`
2. Replace current auto-archive logic with schema-driven processor
3. Add timer pause/resume logic
4. Add auto-delete logic
5. Add hash-at-grant comparison logic

### Phase 4: Migrate request handling
1. Unify requestEdit/requestDelete into a single `requestAction` function
2. Read max requests and lock-on-reject from schema config
3. Timer pause/resume reads from config

## Files to Create
- `lib/workflow/workflowEngine.ts` — computeWorkflowState (THE core function)
- `lib/workflow/workflowConfig.ts` — types for workflow config
- `lib/workflow/nightlyProcessor.ts` — nightly auto-actions
- `lib/workflow/timerManager.ts` — pause/resume/compute timer
- `lib/workflow/completionChecker.ts` — check field completion from schema
- `hooks/useWorkflowState.ts` — frontend hook
- `tests/workflow/workflowEngine.test.ts` — comprehensive tests

## Files to Modify
- `data/schemas/*.ts` — add `workflow` config to each
- `components/data-entry/adapters/BaseEntryAdapter.tsx` — use useWorkflowState
- `components/entry/EntryActionsBar.tsx` — receive workflow state as props
- `components/data-entry/CategoryEntryRecordCard.tsx` — use workflow state
- `app/api/cron/nightly/route.ts` — use nightlyProcessor
- `lib/entries/internal/engineRequests.ts` — read config from schema
- `lib/entries/internal/engineAdmin.ts` — read config from schema

## Files to Eventually Remove (after migration)
- Scattered `canFinalise` logic in BaseEntryAdapter
- Scattered `isViewMode` logic based on status
- Scattered `isPendingRequest` checks
- `useEntryWorkflow.ts` (replaced by useWorkflowState)
- Manual button state computation in CategoryEntryPageShell

## Key Principle
**computeWorkflowState is the SINGLE source of truth.**
Every button, every card action, every nightly job decision, every timer check calls this ONE function. It reads the schema config and the entry data, and returns a complete snapshot of what's allowed and what's not.

No more scattered `if (status === "EDIT_REQUESTED")` checks across 10 files.
