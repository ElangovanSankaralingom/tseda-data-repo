/**
 * Deprecated compatibility wrapper around the split entry rule modules.
 *
 * New code should import:
 * - `editorLifecycle.ts` for Save / Generate / Done action-state rules
 * - `workflow.ts` for workflow normalization, transitions, and lock checks
 *
 * This wrapper is retained so existing callers can migrate incrementally
 * without changing runtime behavior.
 */
export {
  computeEntryLifecycle,
  markDirty,
  markDone,
  markGenerated,
  markSaved,
  type EntryLifecycleInput,
  type EntryLifecycleStage,
  type EntryLifecycleState,
} from "./editorLifecycle.ts";

export {
  canTransition,
  isEntryCommitted,
  isEntryLocked,
  normalizeEntryStatus,
  transitionEntry,
  type EntryStateLike,
  type EntryStatus,
  type EntryTransitionAction,
} from "./workflow.ts";
