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

// ── Uploads ───────────────────────────────────────────────────────────────
export const UPLOAD = {
  failed: "Upload failed.",
  deleteFailed: "Delete failed.",
  deleteSuccess: "File deleted.",
  fileTooLarge: "File exceeds the size limit.",
  invalidType: "This file type is not accepted.",
  pathMissing: "File path missing.",
  invalidSlot: "Invalid upload slot.",
} as const;

// ── Requests ──────────────────────────────────────────────────────────────
export const REQUEST = {
  editSent: "Edit request sent.",
  editCancelled: "Edit request cancelled.",
  editGranted: "Edit request granted.",
  editRejected: "Edit request rejected.",
  deleteSent: "Delete request sent.",
  deleteCancelled: "Delete request cancelled.",
  deleteApproved: "Delete request approved.",
  alreadyUsed: "Request action already used for this entry.",
} as const;

// ── Validation ────────────────────────────────────────────────────────────
export const VALIDATION = {
  required: "This field is required.",
  invalidDate: "Invalid date.",
  endBeforeStart: "End date must be after start date.",
  outsideAcademicYear: "Date is outside the academic year range.",
  duplicateFaculty: "This faculty is already selected in another role.",
  fundingAgencyRequired: "Funding agency is required when sponsored.",
  fundingAmountRequired: "Funding amount is required when sponsored.",
} as const;

// ── Network / system ──────────────────────────────────────────────────────
export const SYSTEM = {
  offline: "You are offline \u2014 changes won\u2019t be saved until connection is restored.",
  autoSaveFailed: "Changes not saved \u2014 check your connection and try again.",
  loadFailed: "Failed to load.",
  refreshFailed: "Failed to refresh saved entries.",
  rateLimited: "Too many requests. Please try again later.",
} as const;

// ── Admin ─────────────────────────────────────────────────────────────────
export const ADMIN = {
  backupCreated: "Backup created successfully.",
  backupFailed: "Backup creation failed.",
  repairComplete: "Integrity repair complete.",
  maintenanceComplete: "Maintenance job complete.",
} as const;
