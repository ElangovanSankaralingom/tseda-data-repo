/**
 * Centralized user-facing strings.
 * All UI text, error messages, and status labels should reference this file.
 * This makes future i18n straightforward — swap this for a lookup function.
 */

// ── Auth ──────────────────────────────────────────────────────────────────
export const AUTH = {
  unauthorized: "Unauthorized",
  accessDenied: "Access denied",
  sessionExpired: "Your session has expired. Please sign in again.",
  invalidEmail: "Invalid email address.",
  notFaculty: "This email is not registered in the faculty directory.",
} as const;

// ── Entry lifecycle ───────────────────────────────────────────────────────
export const ENTRY = {
  saveFailed: "Save failed.",
  saveSuccess: "Saved",
  generateFailed: "Generate failed.",
  generateSuccess: "Entry generated.",
  finaliseFailed: "Finalise failed.",
  finaliseSuccess: "Entry finalised.",
  deleteFailed: "Delete failed.",
  deleteSuccess: "Entry deleted.",
  commitSuccess: "Draft committed.",
  notFound: "Entry not found.",
  alreadyLocked: "This entry is permanently locked.",
  timerExpired: "The editing window has expired.",
  completeFieldsFirst: "Complete all required fields before generating the entry.",
  waitForUploads: "Finish the current uploads before generating the entry.",
} as const;

// ── Network / system ──────────────────────────────────────────────────────
export const SYSTEM = {
  offline: "You are offline \u2014 changes won\u2019t be saved until connection is restored.",
  autoSaveFailed: "Changes not saved \u2014 check your connection and try again.",
  loadFailed: "Failed to load.",
  refreshFailed: "Failed to refresh saved entries.",
  rateLimited: "Too many requests. Please try again later.",
} as const;
