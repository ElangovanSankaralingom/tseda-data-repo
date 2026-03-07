import "server-only";

/**
 * Deprecated compatibility wrapper for the internal engine implementation.
 *
 * Public persisted entry operations should be imported from `lifecycle.ts`.
 * Workflow/editor rule helpers should be imported from `workflow.ts` or
 * `editorLifecycle.ts`.
 *
 * This module remains only to preserve existing imports while the entries
 * layer migrates to the clearer public/internal split.
 */
export type { EntryEngineRecord, EntryStreakSummary } from "./internal/engine.ts";
export {
  commitDraft,
  computeStreak,
  createEntry,
  deleteEntry,
  getEntryWorkflowStatus,
  grantEditAccess,
  isLockedFromApproval,
  listEntriesForCategory,
  normalizeEntryForWorkflow,
  replaceEntriesForCategory,
  requestEdit,
  updateEntry,
} from "./internal/engine.ts";
