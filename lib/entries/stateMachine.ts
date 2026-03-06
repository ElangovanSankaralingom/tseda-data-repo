import type { EntryStatus } from "@/lib/types/entry";
export type { EntryStatus } from "@/lib/types/entry";

export type EntryLifecycleStage = "pre" | "post";

export type EntryLifecycleInput = {
  isLocked: boolean;
  hasPdfSnapshot: boolean;
  preStageValid: boolean;
  postStageValid: boolean;
  preStageDirty: boolean;
  postStageDirty: boolean;
  streakActivated?: boolean;
  streakCompleted?: boolean;
};

export type EntryLifecycleState = {
  stage: EntryLifecycleStage;
  dirty: boolean;
  isDirtyPreStage: boolean;
  isDirtyPostStage: boolean;
  hasPdfSnapshot: boolean;
  streakActivated: boolean;
  streakCompleted: boolean;
  canSave: boolean;
  canGenerate: boolean;
  canPreview: boolean;
  canDownload: boolean;
  canDone: boolean;
};

export function computeEntryLifecycle({
  isLocked,
  hasPdfSnapshot,
  preStageValid,
  postStageValid,
  preStageDirty,
  postStageDirty,
  streakActivated,
  streakCompleted,
}: EntryLifecycleInput): EntryLifecycleState {
  const dirty = preStageDirty || postStageDirty;
  const stage: EntryLifecycleStage = hasPdfSnapshot ? "post" : "pre";
  const canGenerate = !isLocked && preStageValid && preStageDirty;
  const canPreview = hasPdfSnapshot && preStageValid && !preStageDirty;
  const canDownload = canPreview;
  const canDone = !isLocked && hasPdfSnapshot && preStageValid && postStageValid && !preStageDirty;
  const canSave = !isLocked && dirty;

  return {
    stage,
    dirty,
    isDirtyPreStage: preStageDirty,
    isDirtyPostStage: postStageDirty,
    hasPdfSnapshot,
    streakActivated: streakActivated ?? false,
    streakCompleted: streakCompleted ?? false,
    canSave,
    canGenerate,
    canPreview,
    canDownload,
    canDone,
  };
}

export function markDirty(
  current: Pick<EntryLifecycleState, "isDirtyPreStage" | "isDirtyPostStage">,
  fieldGroup: "pre" | "post"
) {
  return fieldGroup === "pre"
    ? { isDirtyPreStage: true, isDirtyPostStage: current.isDirtyPostStage }
    : { isDirtyPreStage: current.isDirtyPreStage, isDirtyPostStage: true };
}

export function markSaved(
  current: Pick<EntryLifecycleState, "isDirtyPreStage" | "isDirtyPostStage">,
  fieldGroup?: "pre" | "post"
) {
  if (!fieldGroup) {
    return { isDirtyPreStage: false, isDirtyPostStage: false };
  }

  return fieldGroup === "pre"
    ? { isDirtyPreStage: false, isDirtyPostStage: current.isDirtyPostStage }
    : { isDirtyPreStage: current.isDirtyPreStage, isDirtyPostStage: false };
}

export function markGenerated(current: EntryLifecycleState): EntryLifecycleState {
  return computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: current.canDone,
    preStageDirty: false,
    postStageDirty: current.isDirtyPostStage,
    streakActivated: current.streakActivated,
    streakCompleted: current.streakCompleted,
  });
}

export function markDone(current: EntryLifecycleState): EntryLifecycleState {
  return {
    ...current,
    streakCompleted: true,
  };
}

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
    // Each send/resend should record the current submission timestamp.
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
