/**
 * Barrel re-export for the internal entry engine.
 *
 * The implementation is split across focused modules:
 *   engineHelpers.ts   — shared types, constants, internal utilities
 *   engineRead.ts      — read-only operations (list, streak, compat wrappers)
 *   engineWrite.ts     — core CRUD mutations (create, update, delete, replace)
 *   engineCommit.ts    — commit & finalize operations
 *   engineRequests.ts  — user request operations (edit/delete requests, cancellations)
 *   engineAdmin.ts     — admin operations (grant, reject, approve, archive, restore)
 *
 * Public callers should import from `lifecycle.ts`, not this file directly.
 */

// Types
export type { EntryEngineRecord, EntryStreakSummary } from "./engineHelpers.ts";

// Read operations
export {
  isLockedFromApproval,
  listEntriesForCategory,
  computeStreak,
  getEntryWorkflowStatus,
  normalizeEntryForWorkflow,
} from "./engineRead.ts";

// Core write operations
export {
  createEntry,
  updateEntry,
  deleteEntry,
  replaceEntriesForCategory,
} from "./engineWrite.ts";

// Commit & finalize
export {
  commitDraft,
  finalizeEntry,
} from "./engineCommit.ts";

// User request operations
export {
  requestEdit,
  cancelEditRequest,
  cancelEditGrant,
  requestDelete,
  cancelDeleteRequest,
} from "./engineRequests.ts";

// Admin operations
export {
  grantEditAccess,
  rejectEditRequest,
  approveDelete,
  archiveEntry,
  restoreEntry,
} from "./engineAdmin.ts";
