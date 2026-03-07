import "server-only";

/**
 * Public entrypoint for entry lifecycle orchestration APIs.
 *
 * Canonical workflow state normalization and transitions live in
 * `stateMachine.ts` (with `EntryStatus` in `lib/types/entry.ts`).
 * This module intentionally exposes the persisted lifecycle operations
 * from `engine.ts` without re-defining workflow/state logic.
 */
export type { EntryEngineRecord, EntryStreakSummary } from "./engine.ts";
export {
  approveEntry,
  commitDraft,
  computeStreak,
  createEntry,
  deleteEntry,
  getEntryWorkflowStatus,
  isLockedFromApproval,
  listEntriesForCategory,
  normalizeEntryForWorkflow,
  rejectEntry,
  replaceEntriesForCategory,
  sendForConfirmation,
  updateEntry,
} from "./engine.ts";
