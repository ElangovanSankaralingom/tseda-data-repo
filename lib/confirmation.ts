import {
  isEntryCommitted,
  isEntryFinalized,
  normalizeEntryStatus,
  type EntryStateLike,
} from "./entries/stateMachine.ts";
import type { EntryStatus as EntryApprovalStatus } from "./types/entry.ts";
import type { RequestEditStatus } from "./types/requestEdit.ts";

export type ConfirmationStatus = RequestEditStatus;

type ConfirmationEntryLike = EntryStateLike & {
  status?: string | null;
  requestEditStatus?: string | null;
  confirmationStatus?: string | null;
};

export function normalizeConfirmationStatus(
  value: unknown,
  fallback: ConfirmationStatus = "none"
): ConfirmationStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "none" || normalized === "pending" || normalized === "approved" || normalized === "rejected") {
    return normalized;
  }

  const approvalStatus = normalizeEntryApprovalStatus(value, "DRAFT");
  if (approvalStatus === "GENERATED") return "approved";
  if (approvalStatus === "EDIT_REQUESTED") return "pending";
  if (approvalStatus === "EDIT_GRANTED") return "approved";
  return fallback;
}

export function getConfirmationStatus(entry: ConfirmationEntryLike): ConfirmationStatus {
  return normalizeConfirmationStatus(entry.requestEditStatus);
}

export function normalizeEntryApprovalStatus(
  value: unknown,
  fallback: EntryApprovalStatus = "DRAFT"
): EntryApprovalStatus {
  return normalizeEntryStatus(
    {
      confirmationStatus: value,
      requestEditStatus: value,
      status: value,
    },
    fallback
  );
}

export function getEntryApprovalStatus(entry: ConfirmationEntryLike) {
  return normalizeEntryStatus(entry);
}

export function isEntryLockedFromStatus(entry: ConfirmationEntryLike) {
  return isEntryFinalized(entry);
}

export function canSendForConfirmation(_entry: ConfirmationEntryLike) {
  // In the new workflow there is no "send for confirmation" action.
  // Entries auto-finalize based on time. This always returns false.
  return false;
}

export function getConfirmationStatusLabel(status: string) {
  const approvalStatus = normalizeEntryApprovalStatus(status);
  if (approvalStatus === "GENERATED") return "Generated";
  if (approvalStatus === "EDIT_REQUESTED") return "Edit Requested";
  if (approvalStatus === "EDIT_GRANTED") return "Edit Granted";
  return "Draft";
}
