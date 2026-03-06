export const REQUEST_EDIT_STATUSES = {
  NONE: "none",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type RequestEditStatus =
  (typeof REQUEST_EDIT_STATUSES)[keyof typeof REQUEST_EDIT_STATUSES];
