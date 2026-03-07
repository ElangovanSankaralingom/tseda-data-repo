// Canonical entry workflow statuses. Do not restate this status list in other
// modules; derive status-keyed collections from `ENTRY_STATUSES` instead.
//
// Workflow: DRAFT → GENERATED → (optionally) EDIT_REQUESTED → EDIT_GRANTED → GENERATED
// Once the edit window expires, a GENERATED entry is effectively finalized
// (read-only). There is no explicit FINALIZED status — finalization is computed
// from `editWindowExpiresAt`.
export const ENTRY_STATUSES = [
  "DRAFT",
  "GENERATED",
  "EDIT_REQUESTED",
  "EDIT_GRANTED",
] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ENTRY_STATUS_LABELS: Readonly<Record<EntryStatus, string>> = {
  DRAFT: "Draft",
  GENERATED: "Generated",
  EDIT_REQUESTED: "Edit Requested",
  EDIT_GRANTED: "Edit Granted",
};

const STATUS_COUNT_KEYS: Readonly<Record<EntryStatus, string>> = {
  DRAFT: "draftCount",
  GENERATED: "generatedCount",
  EDIT_REQUESTED: "editRequestedCount",
  EDIT_GRANTED: "editGrantedCount",
};

export function incrementStatusCount(
  target: Record<string, number>,
  status: EntryStatus,
): void {
  const key = STATUS_COUNT_KEYS[status];
  if (key in target) target[key] += 1;
}

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
  streakEligible?: boolean;
  createdAt?: string;
  updatedAt?: string;
  committedAtISO?: string | null;
  editWindowExpiresAt?: string | null;
  editRequestedAt?: string | null;
  editRequestMessage?: string | null;
  editGrantedAt?: string | null;
  editGrantedBy?: string | null;
  attachments?: UploadedFile[];
  data?: Record<string, unknown>;
};

export type EntryLike = Entry;

// --- Legacy status mapping ---
// Maps old statuses from pre-migration entries to the new system.
const LEGACY_STATUS_MAP: Record<string, EntryStatus> = {
  PENDING_CONFIRMATION: "GENERATED",
  APPROVED: "GENERATED",
  REJECTED: "GENERATED",
};

export function mapLegacyStatus(status: string): EntryStatus | null {
  return LEGACY_STATUS_MAP[status] ?? null;
}
