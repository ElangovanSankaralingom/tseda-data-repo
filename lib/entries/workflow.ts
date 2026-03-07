import { isEntryStatus, type EntryStatus } from "@/lib/types/entry";
export type { EntryStatus } from "@/lib/types/entry";

/**
 * Canonical pure workflow-rule layer for entries.
 *
 * Edit this module when changing confirmation status normalization,
 * commitment semantics, workflow transitions, or approval locking rules.
 *
 * Persistence/orchestration does not belong here; see `lifecycle.ts` and
 * `internal/engine.ts` for persisted entry operations.
 */

export type EntryTransitionAction =
  | "createEntry"
  | "sendForConfirmation"
  | "adminApprove"
  | "adminReject";

export type EntryStateLike = {
  confirmationStatus?: unknown;
  requestEditStatus?: unknown;
  status?: unknown;
  committedAtISO?: unknown;
  sentForConfirmationAtISO?: unknown;
  confirmedAtISO?: unknown;
  confirmedBy?: unknown;
  confirmationRejectedReason?: unknown;
  updatedAt?: unknown;
};

type TransitionOptions = {
  nowISO?: string;
  adminEmail?: string;
  rejectionReason?: string;
};

function normalizeStatusValue(value: unknown): EntryStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return isEntryStatus(normalized) ? normalized : null;
}

function toOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

function normalizeLegacyRequestStatus(value: unknown): EntryStatus | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "none") return "DRAFT";
  if (normalized === "pending") return "PENDING_CONFIRMATION";
  if (normalized === "approved") return "APPROVED";
  if (normalized === "rejected") return "REJECTED";
  return null;
}

export function normalizeEntryStatus(
  entry: EntryStateLike,
  fallback: EntryStatus = "DRAFT"
): EntryStatus {
  const fromCanonical = normalizeStatusValue(entry.confirmationStatus);
  if (fromCanonical) return fromCanonical;

  const fromStatus = normalizeStatusValue(entry.status);
  if (fromStatus) return fromStatus;

  if (typeof entry.confirmedAtISO === "string" && entry.confirmedAtISO.trim()) {
    return "APPROVED";
  }

  if (typeof entry.sentForConfirmationAtISO === "string" && entry.sentForConfirmationAtISO.trim()) {
    return "PENDING_CONFIRMATION";
  }

  const fromLegacy = normalizeLegacyRequestStatus(entry.requestEditStatus);
  if (fromLegacy) return fromLegacy;

  return fallback;
}

export function isEntryCommitted(entry: EntryStateLike): boolean {
  if (toOptionalISO(entry.committedAtISO)) {
    return true;
  }

  const workflowStatus = normalizeEntryStatus(entry);
  if (
    workflowStatus === "PENDING_CONFIRMATION" ||
    workflowStatus === "APPROVED" ||
    workflowStatus === "REJECTED"
  ) {
    return true;
  }

  return false;
}

export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  if (from === "DRAFT") return to === "PENDING_CONFIRMATION";
  if (from === "REJECTED") return to === "PENDING_CONFIRMATION";
  if (from === "PENDING_CONFIRMATION") return to === "APPROVED" || to === "REJECTED";
  return false;
}

function statusForAction(action: EntryTransitionAction): EntryStatus {
  if (action === "createEntry") return "DRAFT";
  if (action === "sendForConfirmation") return "PENDING_CONFIRMATION";
  if (action === "adminApprove") return "APPROVED";
  return "REJECTED";
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
    (next as Record<string, unknown>).sentForConfirmationAtISO = null;
    (next as Record<string, unknown>).confirmedAtISO = null;
    (next as Record<string, unknown>).confirmedBy = null;
    (next as Record<string, unknown>).confirmationRejectedReason = "";
    return next;
  }

  if (to === "PENDING_CONFIRMATION") {
    (next as Record<string, unknown>).sentForConfirmationAtISO = nowISO;
    (next as Record<string, unknown>).confirmedAtISO = null;
    (next as Record<string, unknown>).confirmedBy = null;
    (next as Record<string, unknown>).confirmationRejectedReason = "";
    return next;
  }

  if (to === "APPROVED") {
    (next as Record<string, unknown>).confirmedAtISO = nowISO;
    (next as Record<string, unknown>).confirmedBy = options?.adminEmail ?? null;
    (next as Record<string, unknown>).confirmationRejectedReason = "";
    return next;
  }

  (next as Record<string, unknown>).confirmedAtISO = null;
  (next as Record<string, unknown>).confirmedBy = null;
  (next as Record<string, unknown>).confirmationRejectedReason =
    options?.rejectionReason?.trim() ?? "";
  return next;
}

export function isEntryLocked(entry: EntryStateLike): boolean {
  return normalizeEntryStatus(entry) === "APPROVED";
}
