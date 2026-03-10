import { isEntryStatus, mapLegacyStatus, type EntryStatus } from "@/lib/types/entry";
export type { EntryStatus } from "@/lib/types/entry";

/**
 * Canonical pure workflow-rule layer for entries.
 *
 * State machine (6 statuses):
 *   DRAFT → GENERATED → (EDIT_REQUESTED → EDIT_GRANTED → GENERATED)
 *                      → (DELETE_REQUESTED → ARCHIVED | GENERATED)
 *                      → ARCHIVED (auto, timer expired without valid PDF)
 *
 * Finalization is time-based: once `editWindowExpiresAt` has passed and the
 * entry has a valid PDF, it is effectively read-only. No explicit FINALIZED
 * status exists.
 *
 * Edit this module when changing status normalization, edit-window rules,
 * or transition logic. Persistence lives in `lifecycle.ts` / `engine.ts`.
 */

import { APP_CONFIG } from "@/lib/config/appConfig";

// --- Edit window constants ---
// These defaults can be overridden via app settings (lib/settings/consumer.ts).
// Functions accept optional override parameters for async settings consumers.

/** Default edit window: 3 days after generation. */
export const DEFAULT_EDIT_WINDOW_DAYS = APP_CONFIG.entryLifecycle.defaultEditWindowDays;

/** Streak-eligible entries get until endDate + 8 days. */
export const STREAK_EDIT_WINDOW_BUFFER_DAYS = APP_CONFIG.entryLifecycle.streakEditWindowBufferDays;

export type EntryTransitionAction =
  | "createEntry"
  | "generateEntry"
  | "requestEdit"
  | "requestDelete"
  | "grantEdit"
  | "rejectEdit"
  | "cancelEditRequest"
  | "cancelDeleteRequest"
  | "approveDelete"
  | "archiveEntry"
  | "restoreEntry";

export type EntryStateLike = {
  confirmationStatus?: unknown;
  requestEditStatus?: unknown;
  status?: unknown;
  generatedAt?: unknown;
  committedAtISO?: unknown;
  editWindowExpiresAt?: unknown;
  editRequestedAt?: unknown;
  editRequestMessage?: unknown;
  editGrantedAt?: unknown;
  editGrantedBy?: unknown;
  editGrantedDays?: unknown;
  editRejectedReason?: unknown;
  deleteRequestedAt?: unknown;
  requestType?: unknown;
  requestCount?: unknown;
  requestCountResetAt?: unknown;
  archivedAt?: unknown;
  archiveReason?: unknown;
  endDate?: unknown;
  streakEligible?: unknown;
  streakPermanentlyRemoved?: unknown;
  updatedAt?: unknown;
  pdfGenerated?: unknown;
  pdfGeneratedAt?: unknown;
  pdfUrl?: unknown;
  timerWarningShown?: unknown;
  // Legacy fields for migration
  sentForConfirmationAtISO?: unknown;
  confirmedAtISO?: unknown;
  confirmedBy?: unknown;
  confirmationRejectedReason?: unknown;
};

type TransitionOptions = {
  nowISO?: string;
  adminEmail?: string;
  editGrantedDays?: number;
  archiveReason?: "auto_no_pdf" | "delete_approved";
};

function normalizeStatusValue(value: unknown): EntryStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (isEntryStatus(normalized)) return normalized;
  // Try legacy mapping
  const mapped = mapLegacyStatus(normalized);
  if (mapped) return mapped;
  return null;
}

function toOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

export function normalizeEntryStatus(
  entry: EntryStateLike,
  fallback: EntryStatus = "DRAFT"
): EntryStatus {
  const fromCanonical = normalizeStatusValue(entry.confirmationStatus);
  if (fromCanonical) return fromCanonical;

  const fromStatus = normalizeStatusValue(entry.status);
  if (fromStatus) return fromStatus;

  // Legacy: if it was confirmed or sent for confirmation, it's GENERATED now
  if (typeof entry.confirmedAtISO === "string" && entry.confirmedAtISO.trim()) {
    return "GENERATED";
  }
  if (typeof entry.sentForConfirmationAtISO === "string" && entry.sentForConfirmationAtISO.trim()) {
    return "GENERATED";
  }

  // If it has generatedAt or committedAtISO, it's GENERATED
  if (toOptionalISO(entry.generatedAt) || toOptionalISO(entry.committedAtISO)) {
    return "GENERATED";
  }

  // Legacy requestEditStatus mapping
  const legacyReqStatus = String(entry.requestEditStatus ?? "").trim().toLowerCase();
  if (legacyReqStatus === "pending" || legacyReqStatus === "approved" || legacyReqStatus === "rejected") {
    return "GENERATED";
  }

  return fallback;
}

/**
 * Determines whether an entry has been committed (i.e., moved beyond DRAFT).
 * Checks for the presence of `generatedAt` or `committedAtISO` timestamps,
 * and falls back to the normalized workflow status.
 *
 * @param entry - The entry state to check.
 * @returns `true` if the entry has been committed (is no longer a draft).
 */
export function isEntryCommitted(entry: EntryStateLike): boolean {
  if (toOptionalISO(entry.generatedAt) || toOptionalISO(entry.committedAtISO)) {
    return true;
  }

  const workflowStatus = normalizeEntryStatus(entry);
  return workflowStatus !== "DRAFT";
}

// --- Edit window computation ---

function addDays(dateISO: string, days: number): string {
  const date = new Date(dateISO);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function computeEditWindowExpiry(
  generatedAtISO: string,
  entry: { endDate?: unknown; streakEligible?: unknown },
  overrides?: { editWindowDays?: number; streakBufferDays?: number }
): string {
  const windowDays = overrides?.editWindowDays ?? DEFAULT_EDIT_WINDOW_DAYS;
  const bufferDays = overrides?.streakBufferDays ?? STREAK_EDIT_WINDOW_BUFFER_DAYS;
  const defaultExpiry = addDays(generatedAtISO, windowDays);

  if (entry.streakEligible === true && typeof entry.endDate === "string" && entry.endDate.trim()) {
    // Streak entries: endDate + buffer days
    const endDateExpiry = addDays(entry.endDate.trim() + "T23:59:59.999Z", bufferDays);
    // Use whichever is later
    return endDateExpiry > defaultExpiry ? endDateExpiry : defaultExpiry;
  }

  return defaultExpiry;
}

/**
 * Compute the edit grant expiry.
 * When an admin grants edit access, the timer is based on the grant, not the
 * original entry timer.
 */
export function computeEditGrantExpiry(
  grantedAtISO: string,
  grantedDays: number
): string {
  return addDays(grantedAtISO, grantedDays);
}

// --- Editability ---

/**
 * Checks whether the entry's edit window has expired.
 * Returns `false` if no `editWindowExpiresAt` is set on the entry.
 *
 * @param entry - The entry state to check.
 * @param nowISO - Optional ISO timestamp to use as the current time (defaults to `new Date().toISOString()`).
 * @returns `true` if the current time is at or past the edit window expiry.
 */
export function isEditWindowExpired(entry: EntryStateLike, nowISO?: string): boolean {
  const expiry = toOptionalISO(entry.editWindowExpiresAt);
  if (!expiry) return false;
  const now = nowISO ?? new Date().toISOString();
  return now >= expiry;
}

/**
 * Determines whether an entry is finalized (effectively read-only).
 * An entry is finalized when it is in `GENERATED` status and its edit window
 * has expired. Entries in `DRAFT`, `ARCHIVED`, `EDIT_REQUESTED`,
 * `DELETE_REQUESTED`, or `EDIT_GRANTED` status are never considered finalized.
 *
 * @param entry - The entry state to check.
 * @param nowISO - Optional ISO timestamp to use as the current time.
 * @returns `true` if the entry is finalized and should be treated as read-only.
 */
export function isEntryFinalized(entry: EntryStateLike, nowISO?: string): boolean {
  const status = normalizeEntryStatus(entry);
  if (status === "DRAFT") return false;
  if (status === "ARCHIVED") return false;
  // EDIT_REQUESTED, DELETE_REQUESTED, and EDIT_GRANTED are not finalized
  if (status === "EDIT_REQUESTED" || status === "DELETE_REQUESTED" || status === "EDIT_GRANTED") return false;
  // GENERATED: finalized if edit window has expired
  return isEditWindowExpired(entry, nowISO);
}

/**
 * Determines whether an entry can currently be edited by the user.
 * Entries are editable if they are in `DRAFT` or `EDIT_GRANTED` status, or
 * in `GENERATED` status with an active (non-expired) edit window. Entries in
 * `EDIT_REQUESTED`, `DELETE_REQUESTED`, or `ARCHIVED` status are not editable.
 *
 * @param entry - The entry state to check.
 * @param nowISO - Optional ISO timestamp to use as the current time.
 * @returns `true` if the entry can be edited.
 */
export function isEntryEditable(entry: EntryStateLike, nowISO?: string): boolean {
  const status = normalizeEntryStatus(entry);
  if (status === "DRAFT") return true;
  if (status === "EDIT_GRANTED") return true;
  if (status === "GENERATED") {
    // Editable if edit window hasn't expired
    return !isEditWindowExpired(entry, nowISO);
  }
  // EDIT_REQUESTED, DELETE_REQUESTED, ARCHIVED: not editable
  return false;
}

/** @deprecated Use isEntryFinalized instead */
export function isEntryLocked(entry: EntryStateLike): boolean {
  return isEntryFinalized(entry);
}

// --- Transitions ---

/**
 * Checks whether a status transition is valid according to the entry state machine.
 * See the module-level comment for the full state diagram.
 *
 * @param from - The current entry status.
 * @param to - The target entry status.
 * @returns `true` if the transition from `from` to `to` is allowed.
 */
export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  if (from === "DRAFT") return to === "GENERATED";
  if (from === "GENERATED") {
    return to === "EDIT_REQUESTED" || to === "DELETE_REQUESTED" || to === "ARCHIVED";
  }
  if (from === "EDIT_REQUESTED") return to === "EDIT_GRANTED" || to === "GENERATED";
  if (from === "DELETE_REQUESTED") return to === "ARCHIVED" || to === "GENERATED";
  if (from === "EDIT_GRANTED") return to === "GENERATED" || to === "ARCHIVED";
  if (from === "ARCHIVED") return to === "GENERATED"; // restore
  return false;
}

function statusForAction(action: EntryTransitionAction): EntryStatus {
  if (action === "createEntry") return "DRAFT";
  if (action === "generateEntry") return "GENERATED";
  if (action === "requestEdit") return "EDIT_REQUESTED";
  if (action === "requestDelete") return "DELETE_REQUESTED";
  if (action === "grantEdit") return "EDIT_GRANTED";
  if (action === "rejectEdit" || action === "cancelEditRequest") return "GENERATED";
  if (action === "cancelDeleteRequest") return "GENERATED";
  if (action === "approveDelete" || action === "archiveEntry") return "ARCHIVED";
  if (action === "restoreEntry") return "GENERATED";
  return "DRAFT";
}

/**
 * Applies a workflow action to an entry, transitioning it to the appropriate
 * status and updating related timestamp/metadata fields. Throws if the
 * transition is invalid (except for `createEntry`, which bootstraps a new entry).
 *
 * Side-effects by action:
 * - `generateEntry` / `restoreEntry`: sets `generatedAt`, `editWindowExpiresAt`, resets PDF state (restore only).
 * - `requestEdit` / `requestDelete`: records request timestamps and type.
 * - `grantEdit`: sets grant metadata and replaces the edit window timer.
 * - `rejectEdit` / `cancelEditRequest` / `cancelDeleteRequest`: clears request fields.
 * - `approveDelete` / `archiveEntry`: sets `archivedAt` and clears pending requests.
 *
 * @param entry - The current entry state.
 * @param action - The workflow action to apply.
 * @param options - Optional overrides for timestamp, admin email, edit grant days, or archive reason.
 * @returns A shallow copy of the entry with the new status and updated fields.
 * @throws {Error} If the status transition is invalid for the given action.
 */
export function transitionEntry<T extends EntryStateLike>(
  entry: T,
  action: EntryTransitionAction,
  options?: TransitionOptions
): T {
  const nowISO = options?.nowISO ?? new Date().toISOString();
  const from = normalizeEntryStatus(entry);
  const to = statusForAction(action);

  if (action !== "createEntry" && !canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} -> ${to}`);
  }

  const next = {
    ...entry,
    confirmationStatus: to,
    updatedAt: nowISO,
  } as T;

  if (to === "DRAFT") {
    return next;
  }

  // GENERATED from EDIT_GRANTED: re-generate after edit grant
  if (to === "GENERATED" && from === "EDIT_GRANTED") {
    const editWindowExpiresAt = computeEditWindowExpiry(nowISO, entry);
    (next as Record<string, unknown>).editWindowExpiresAt = editWindowExpiresAt;
    (next as Record<string, unknown>).editRequestedAt = null;
    (next as Record<string, unknown>).editRequestMessage = null;
    (next as Record<string, unknown>).editGrantedAt = null;
    (next as Record<string, unknown>).editGrantedBy = null;
    (next as Record<string, unknown>).editGrantedDays = null;
    (next as Record<string, unknown>).requestType = null;
    return next;
  }

  // GENERATED from EDIT_REQUESTED: reject or cancel edit request
  if (to === "GENERATED" && from === "EDIT_REQUESTED") {
    (next as Record<string, unknown>).editRequestedAt = null;
    (next as Record<string, unknown>).editRequestMessage = null;
    (next as Record<string, unknown>).requestType = null;
    return next;
  }

  // GENERATED from DELETE_REQUESTED: reject or cancel delete request
  if (to === "GENERATED" && from === "DELETE_REQUESTED") {
    (next as Record<string, unknown>).deleteRequestedAt = null;
    (next as Record<string, unknown>).requestType = null;
    return next;
  }

  // GENERATED from ARCHIVED: restore
  if (to === "GENERATED" && from === "ARCHIVED") {
    const editWindowExpiresAt = computeEditWindowExpiry(nowISO, entry);
    (next as Record<string, unknown>).editWindowExpiresAt = editWindowExpiresAt;
    (next as Record<string, unknown>).generatedAt = nowISO;
    (next as Record<string, unknown>).archivedAt = null;
    (next as Record<string, unknown>).archiveReason = null;
    // Reset PDF state — user must regenerate after restore
    (next as Record<string, unknown>).pdfGenerated = false;
    (next as Record<string, unknown>).pdfGeneratedAt = null;
    (next as Record<string, unknown>).pdfUrl = null;
    return next;
  }

  // GENERATED from DRAFT: first generation (auto-transition)
  if (to === "GENERATED" && from === "DRAFT") {
    const editWindowExpiresAt = computeEditWindowExpiry(nowISO, entry);
    (next as Record<string, unknown>).editWindowExpiresAt = editWindowExpiresAt;
    (next as Record<string, unknown>).generatedAt = nowISO;
    // Also set committedAtISO for backwards compatibility
    (next as Record<string, unknown>).committedAtISO = nowISO;
    return next;
  }

  // Fallback GENERATED (shouldn't normally hit this)
  if (to === "GENERATED") {
    return next;
  }

  if (to === "EDIT_REQUESTED") {
    (next as Record<string, unknown>).editRequestedAt = nowISO;
    (next as Record<string, unknown>).requestType = "edit";
    return next;
  }

  if (to === "DELETE_REQUESTED") {
    (next as Record<string, unknown>).deleteRequestedAt = nowISO;
    (next as Record<string, unknown>).requestType = "delete";
    // Cancel any pending edit request
    (next as Record<string, unknown>).editRequestedAt = null;
    (next as Record<string, unknown>).editRequestMessage = null;
    return next;
  }

  if (to === "EDIT_GRANTED") {
    const grantedDays = options?.editGrantedDays ?? DEFAULT_EDIT_WINDOW_DAYS;
    (next as Record<string, unknown>).editGrantedAt = nowISO;
    (next as Record<string, unknown>).editGrantedBy = options?.adminEmail ?? null;
    (next as Record<string, unknown>).editGrantedDays = grantedDays;
    // Edit grant timer replaces original entry timer
    (next as Record<string, unknown>).editWindowExpiresAt = computeEditGrantExpiry(nowISO, grantedDays);
    (next as Record<string, unknown>).requestType = null;
    return next;
  }

  if (to === "ARCHIVED") {
    (next as Record<string, unknown>).archivedAt = nowISO;
    (next as Record<string, unknown>).archiveReason = options?.archiveReason ?? null;
    // Clear pending request state
    (next as Record<string, unknown>).editRequestedAt = null;
    (next as Record<string, unknown>).editRequestMessage = null;
    (next as Record<string, unknown>).deleteRequestedAt = null;
    (next as Record<string, unknown>).requestType = null;
    return next;
  }

  return next;
}

// --- Remaining edit time ---

export type EditTimeRemaining = {
  hasEditWindow: boolean;
  expired: boolean;
  expiresAtISO: string | null;
  remainingMs: number;
  remainingLabel: string;
};

/**
 * Computes the remaining edit time for an entry, including a human-readable label.
 * If the entry has no `editWindowExpiresAt`, returns a result indicating no edit window.
 *
 * @param entry - The entry state to check.
 * @param nowISO - Optional ISO timestamp to use as the current time.
 * @returns An {@link EditTimeRemaining} object with expiry info, remaining milliseconds, and a display label (e.g., "2 days left").
 */
export function getEditTimeRemaining(entry: EntryStateLike, nowISO?: string): EditTimeRemaining {
  const expiry = toOptionalISO(entry.editWindowExpiresAt);
  if (!expiry) {
    return { hasEditWindow: false, expired: false, expiresAtISO: null, remainingMs: 0, remainingLabel: "" };
  }

  const now = nowISO ?? new Date().toISOString();
  const remainingMs = Math.max(0, Date.parse(expiry) - Date.parse(now));
  const expired = remainingMs <= 0;

  let remainingLabel = "";
  if (!expired) {
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) {
      remainingLabel = `${days} ${days === 1 ? "day" : "days"} left`;
    } else if (hours > 0) {
      remainingLabel = `${hours} ${hours === 1 ? "hour" : "hours"} left`;
    } else {
      const minutes = Math.max(1, Math.ceil(remainingMs / (1000 * 60)));
      remainingLabel = `${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
    }
  }

  return { hasEditWindow: true, expired, expiresAtISO: expiry, remainingMs, remainingLabel };
}

// --- Request limit helpers ---

const MAX_REQUESTS_PER_MONTH = APP_CONFIG.entryLifecycle.maxRequestsPerMonth;

/**
 * Determines whether the user can submit an edit or delete request for this entry.
 * Requests are only allowed on finalized `GENERATED` entries that have not exceeded
 * the monthly request limit (`MAX_REQUESTS_PER_MONTH`).
 *
 * @param entry - The entry state to check.
 * @returns `true` if the entry is eligible for a new action request.
 */
export function canRequestAction(entry: EntryStateLike): boolean {
  const status = normalizeEntryStatus(entry);
  // Only finalized GENERATED entries can have actions requested
  if (status !== "GENERATED") return false;
  if (!isEntryFinalized(entry)) return false;

  // Check monthly limit
  const count = typeof entry.requestCount === "number" ? entry.requestCount : 0;
  return count < MAX_REQUESTS_PER_MONTH;
}

/**
 * Returns the number of action requests remaining for this entry within the
 * current monthly limit.
 *
 * @param entry - The entry state to check.
 * @returns The number of requests still available (0 or more).
 */
export function getRequestCountRemaining(entry: EntryStateLike): number {
  const count = typeof entry.requestCount === "number" ? entry.requestCount : 0;
  return Math.max(0, MAX_REQUESTS_PER_MONTH - count);
}
