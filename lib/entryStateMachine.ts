export type EntryStatus = "DRAFT" | "PENDING_CONFIRMATION" | "APPROVED" | "REJECTED";

export type EntryTransitionAction =
  | "createEntry"
  | "sendForConfirmation"
  | "adminApprove"
  | "adminReject";

export type EntryStateLike = {
  confirmationStatus?: unknown;
  requestEditStatus?: unknown;
  status?: unknown;
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
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "DRAFT") return "DRAFT";
  if (normalized === "PENDING_CONFIRMATION" || normalized === "PENDING") {
    return "PENDING_CONFIRMATION";
  }
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  return null;
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

export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  if (from === to) return true;
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
    const hasSentAt =
      typeof entry.sentForConfirmationAtISO === "string" && entry.sentForConfirmationAtISO.trim();
    (next as Record<string, unknown>).sentForConfirmationAtISO = hasSentAt
      ? entry.sentForConfirmationAtISO
      : nowISO;
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
