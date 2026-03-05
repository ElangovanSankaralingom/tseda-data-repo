export type ConfirmationStatus = "none" | "pending" | "approved" | "rejected";

type ConfirmationEntryLike = {
  status?: string | null;
  requestEditStatus?: string | null;
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

export function isEntryLockedFromStatus(entry: ConfirmationEntryLike) {
  return entry.status === "final" && getConfirmationStatus(entry) === "approved";
}

export function canSendForConfirmation(entry: ConfirmationEntryLike) {
  if (entry.status !== "final") {
    return false;
  }

  const confirmationStatus = getConfirmationStatus(entry);
  return confirmationStatus === "none" || confirmationStatus === "rejected";
}

export function getConfirmationStatusLabel(status: ConfirmationStatus) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending Confirmation";
  if (status === "rejected") return "Rejected";
  return "Draft";
}
