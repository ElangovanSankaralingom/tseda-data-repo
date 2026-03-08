import "server-only";

/**
 * Public entrypoint for persisted entry lifecycle operations.
 *
 * Ownership:
 * - `workflow.ts` and `editorLifecycle.ts` own canonical pure rules.
 * - `internal/engine.ts` owns persistence, WAL/index updates, validation, and telemetry.
 * - this module is the stable public facade for server-side entry operations.
 *
 * Keep workflow-rule consumers on `workflow.ts` / `editorLifecycle.ts`.
 * Keep persisted mutation/list callers on this module so the engine remains an
 * internal implementation detail.
 */
export type { EntryEngineRecord, EntryStreakSummary } from "./internal/engine.ts";

// Public persisted lifecycle operations.
export {
  cancelEditRequest,
  commitDraft,
  computeStreak,
  createEntry,
  deleteEntry,
  finalizeEntry,
  grantEditAccess,
  listEntriesForCategory,
  rejectEditRequest,
  replaceEntriesForCategory,
  requestEdit,
  updateEntry,
} from "./internal/engine.ts";

// Compatibility helpers retained for read-only callers. These remain thin
// wrappers over `workflow.ts` via the internal engine and do not own rules.
export {
  getEntryWorkflowStatus,
  isLockedFromApproval,
  normalizeEntryForWorkflow,
} from "./internal/engine.ts";
