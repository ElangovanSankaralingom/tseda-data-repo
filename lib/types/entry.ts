// Canonical entry workflow statuses. Do not restate this status list in other
// modules; derive status-keyed collections from `ENTRY_STATUSES` instead.
export const ENTRY_STATUSES = [
  "DRAFT",
  "PENDING_CONFIRMATION",
  "APPROVED",
  "REJECTED",
] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ENTRY_STATUS_LABELS: Readonly<Record<EntryStatus, string>> = {
  DRAFT: "Draft",
  PENDING_CONFIRMATION: "Pending Confirmation",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const ENTRY_STATUS_SET = new Set<string>(ENTRY_STATUSES);

export function isEntryStatus(value: string): value is EntryStatus {
  return ENTRY_STATUS_SET.has(value);
}

export function createEntryStatusRecord<T>(
  createValue: (status: EntryStatus) => T
): Record<EntryStatus, T> {
  return ENTRY_STATUSES.reduce<Record<EntryStatus, T>>((next, status) => {
    next[status] = createValue(status);
    return next;
  }, {} as Record<EntryStatus, T>);
}

export type UploadedFile = {
  id?: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

export type Entry = Record<string, unknown> & {
  id?: string;
  category?: string;
  ownerEmail?: string;
  schemaVersion?: number;
  v?: number;
  status?: string;
  confirmationStatus?: EntryStatus;
  createdAt?: string;
  updatedAt?: string;
  attachments?: UploadedFile[];
  data?: Record<string, unknown>;
};

export type EntryLike = Entry;
