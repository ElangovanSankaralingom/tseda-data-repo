import { isEntryStatus, mapLegacyStatus, type EntryStatus } from "@/lib/types/entry";
export type { EntryStatus } from "@/lib/types/entry";

/**
 * Canonical pure workflow-rule layer for entries.
 *
 * The new workflow replaces DRAFT/PENDING/APPROVED/REJECTED with:
 *   DRAFT → GENERATED → (EDIT_REQUESTED → EDIT_GRANTED → GENERATED)
 *
 * Finalization is time-based: once `editWindowExpiresAt` has passed, the entry
 * is effectively read-only. There is no explicit FINALIZED status.
 *
 * Edit this module when changing status normalization, edit-window rules,
 * or transition logic. Persistence lives in `lifecycle.ts` / `engine.ts`.
 */

// --- Edit window constants ---
// These defaults can be overridden via app settings (lib/settings/consumer.ts).
// Functions accept optional override parameters for async settings consumers.

/** Default edit window: 3 days after generation. */
export const DEFAULT_EDIT_WINDOW_DAYS = 3;

/** Streak-eligible entries get until endDate + 8 days. */
export const STREAK_EDIT_WINDOW_BUFFER_DAYS = 8;

export type EntryTransitionAction =
  | "createEntry"
  | "generateEntry"
  | "requestEdit"
  | "grantEdit";

export type EntryStateLike = {
  confirmationStatus?: unknown;
  requestEditStatus?: unknown;
  status?: unknown;
  committedAtISO?: unknown;
  editWindowExpiresAt?: unknown;
  editRequestedAt?: unknown;
  editRequestMessage?: unknown;
  editGrantedAt?: unknown;
  editGrantedBy?: unknown;
  endDate?: unknown;
  streakEligible?: unknown;
  updatedAt?: unknown;
  // Legacy fields for migration
  sentForConfirmationAtISO?: unknown;
  confirmedAtISO?: unknown;
  confirmedBy?: unknown;
  confirmationRejectedReason?: unknown;
};

type TransitionOptions = {
  nowISO?: string;
  adminEmail?: string;
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

  // If it has committedAtISO, it's GENERATED
  if (toOptionalISO(entry.committedAtISO)) {
    return "GENERATED";
  }

  // Legacy requestEditStatus mapping
  const legacyReqStatus = String(entry.requestEditStatus ?? "").trim().toLowerCase();
  if (legacyReqStatus === "pending" || legacyReqStatus === "approved" || legacyReqStatus === "rejected") {
    return "GENERATED";
  }

  return fallback;
}

export function isEntryCommitted(entry: EntryStateLike): boolean {
  if (toOptionalISO(entry.committedAtISO)) {
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

// --- Editability ---

export function isEditWindowExpired(entry: EntryStateLike, nowISO?: string): boolean {
  const expiry = toOptionalISO(entry.editWindowExpiresAt);
  if (!expiry) return false;
  const now = nowISO ?? new Date().toISOString();
  return now >= expiry;
}

export function isEntryFinalized(entry: EntryStateLike, nowISO?: string): boolean {
  const status = normalizeEntryStatus(entry);
  if (status === "DRAFT") return false;
  // EDIT_REQUESTED and EDIT_GRANTED are not finalized
  if (status === "EDIT_REQUESTED" || status === "EDIT_GRANTED") return false;
  // GENERATED: finalized if edit window has expired
  return isEditWindowExpired(entry, nowISO);
}

export function isEntryEditable(entry: EntryStateLike, nowISO?: string): boolean {
  const status = normalizeEntryStatus(entry);
  if (status === "DRAFT") return true;
  if (status === "EDIT_GRANTED") return true;
  if (status === "GENERATED") {
    // Editable if edit window hasn't expired
    return !isEditWindowExpired(entry, nowISO);
  }
  // EDIT_REQUESTED: not editable until granted
  return false;
}

/** @deprecated Use isEntryFinalized instead */
export function isEntryLocked(entry: EntryStateLike): boolean {
  return isEntryFinalized(entry);
}

// --- Transitions ---

export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  if (from === "DRAFT") return to === "GENERATED";
  if (from === "GENERATED") return to === "EDIT_REQUESTED";
  if (from === "EDIT_REQUESTED") return to === "EDIT_GRANTED";
  if (from === "EDIT_GRANTED") return to === "GENERATED";
  return false;
}

function statusForAction(action: EntryTransitionAction): EntryStatus {
  if (action === "createEntry") return "DRAFT";
  if (action === "generateEntry") return "GENERATED";
  if (action === "requestEdit") return "EDIT_REQUESTED";
  return "EDIT_GRANTED";
}

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

  if (to === "GENERATED" && from === "EDIT_GRANTED") {
    // Re-generate after edit grant — update edit window
    const editWindowExpiresAt = computeEditWindowExpiry(nowISO, entry);
    (next as Record<string, unknown>).editWindowExpiresAt = editWindowExpiresAt;
    (next as Record<string, unknown>).editRequestedAt = null;
    (next as Record<string, unknown>).editRequestMessage = null;
    (next as Record<string, unknown>).editGrantedAt = null;
    (next as Record<string, unknown>).editGrantedBy = null;
    return next;
  }

  if (to === "GENERATED") {
    // First generation
    const editWindowExpiresAt = computeEditWindowExpiry(nowISO, entry);
    (next as Record<string, unknown>).editWindowExpiresAt = editWindowExpiresAt;
    return next;
  }

  if (to === "EDIT_REQUESTED") {
    (next as Record<string, unknown>).editRequestedAt = nowISO;
    return next;
  }

  if (to === "EDIT_GRANTED") {
    (next as Record<string, unknown>).editGrantedAt = nowISO;
    (next as Record<string, unknown>).editGrantedBy = options?.adminEmail ?? null;
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
      remainingLabel = `${days}d ${hours % 24}h left`;
    } else if (hours > 0) {
      remainingLabel = `${hours}h left`;
    } else {
      const minutes = Math.max(1, Math.ceil(remainingMs / (1000 * 60)));
      remainingLabel = `${minutes}m left`;
    }
  }

  return { hasEditWindow: true, expired, expiresAtISO: expiry, remainingMs, remainingLabel };
}
