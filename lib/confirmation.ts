import {
  isEntryLocked,
  normalizeEntryStatus,
  type EntryStateLike,
} from "./entries/stateMachine.ts";
import type { EntryStatus as EntryApprovalStatus } from "./types/entry.ts";

export type ConfirmationStatus = "none" | "pending" | "approved" | "rejected";

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
  if (approvalStatus === "APPROVED") return "approved";
  if (approvalStatus === "PENDING_CONFIRMATION") return "pending";
  if (approvalStatus === "REJECTED") return "rejected";
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
  return isEntryLocked(entry);
}

export function canSendForConfirmation(entry: ConfirmationEntryLike) {
  const stage = String(entry.status ?? "").trim().toLowerCase();
  if (stage !== "final") {
    return false;
  }

  const approvalStatus = getEntryApprovalStatus(entry);
  return approvalStatus === "DRAFT" || approvalStatus === "REJECTED";
}

export function getConfirmationStatusLabel(status: string) {
  const approvalStatus = normalizeEntryApprovalStatus(status);
  if (approvalStatus === "APPROVED") return "Approved";
  if (approvalStatus === "PENDING_CONFIRMATION") return "Pending Confirmation";
  if (approvalStatus === "REJECTED") return "Rejected";
  return "Draft";
}
