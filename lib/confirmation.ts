export type ConfirmationStatus = "none" | "pending" | "approved" | "rejected";
export type EntryApprovalStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "APPROVED"
  | "REJECTED";

type ConfirmationEntryLike = {
  status?: string | null;
  requestEditStatus?: string | null;
  confirmationStatus?: string | null;
};

export function normalizeConfirmationStatus(
  value: unknown,
  fallback: ConfirmationStatus = "none"
): ConfirmationStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : fallback;
}

export function getConfirmationStatus(entry: ConfirmationEntryLike): ConfirmationStatus {
  return normalizeConfirmationStatus(entry.requestEditStatus);
}

export function normalizeEntryApprovalStatus(
  value: unknown,
  fallback: EntryApprovalStatus = "DRAFT"
): EntryApprovalStatus {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PENDING_CONFIRMATION" || normalized === "PENDING") {
    return "PENDING_CONFIRMATION";
  }
  if (normalized === "DRAFT") return "DRAFT";

  const legacy = normalizeConfirmationStatus(value, "none");
  if (legacy === "approved") return "APPROVED";
  if (legacy === "pending") return "PENDING_CONFIRMATION";
  if (legacy === "rejected") return "REJECTED";
  if (legacy === "none") return "DRAFT";
  return fallback;
}

export function getEntryApprovalStatus(entry: ConfirmationEntryLike) {
  if (entry.confirmationStatus) {
    return normalizeEntryApprovalStatus(entry.confirmationStatus);
  }
  return normalizeEntryApprovalStatus(entry.requestEditStatus);
}

export function isEntryLockedFromStatus(entry: ConfirmationEntryLike) {
  return getEntryApprovalStatus(entry) === "APPROVED";
}

export function canSendForConfirmation(entry: ConfirmationEntryLike) {
  if (entry.status !== "final") {
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
