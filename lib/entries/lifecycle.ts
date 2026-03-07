import "server-only";

/**
 * Public entrypoint for persisted entry lifecycle operations.
 *
 * Ownership:
 * - `stateMachine.ts` owns canonical workflow rules and normalization.
 * - `engine.ts` owns persistence, WAL/index updates, validation, and telemetry.
 * - this module is the stable public facade for server-side entry operations.
 *
 * Keep workflow-rule consumers on `stateMachine.ts`. Keep persisted mutation/list
 * callers on this module so the engine remains an internal implementation detail.
 */
export type { EntryEngineRecord, EntryStreakSummary } from "./engine.ts";

// Public persisted lifecycle operations.
export {
  approveEntry,
  commitDraft,
  computeStreak,
  createEntry,
  deleteEntry,
  listEntriesForCategory,
  rejectEntry,
  replaceEntriesForCategory,
  sendForConfirmation,
  updateEntry,
} from "./engine.ts";

// Compatibility helpers retained for read-only callers. These remain thin
// wrappers over `stateMachine.ts` via `engine.ts`; they do not own workflow rules.
export {
  getEntryWorkflowStatus,
  isLockedFromApproval,
  normalizeEntryForWorkflow,
} from "./engine.ts";
