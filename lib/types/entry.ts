// Canonical entry workflow statuses — 6 statuses total.
// Do not restate this status list in other modules; derive status-keyed
// collections from `ENTRY_STATUSES` instead.
//
// Workflow:
//   DRAFT → GENERATED → (EDIT_REQUESTED → EDIT_GRANTED → GENERATED)
//                      → (DELETE_REQUESTED → ARCHIVED | GENERATED)
//                      → ARCHIVED (auto, on timer expiry without valid PDF)
//
// Finalization is computed: a GENERATED entry is "finalized" when its edit
// window has expired AND it has a valid PDF. There is no explicit FINALIZED
// status.
export const ENTRY_STATUSES = [
  "DRAFT",
  "GENERATED",
  "EDIT_REQUESTED",
  "DELETE_REQUESTED",
  "EDIT_GRANTED",
  "ARCHIVED",
] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ENTRY_STATUS_LABELS: Readonly<Record<EntryStatus, string>> = {
  DRAFT: "Draft",
  GENERATED: "Generated",
  EDIT_REQUESTED: "Edit Requested",
  DELETE_REQUESTED: "Delete Requested",
  EDIT_GRANTED: "Edit Granted",
  ARCHIVED: "Archived",
};

const STATUS_COUNT_KEYS: Readonly<Record<EntryStatus, string>> = {
  DRAFT: "draftCount",
  GENERATED: "generatedCount",
  EDIT_REQUESTED: "editRequestedCount",
  DELETE_REQUESTED: "deleteRequestedCount",
  EDIT_GRANTED: "editGrantedCount",
  ARCHIVED: "archivedCount",
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

/** Field stage for the two-stage model */
export type FieldStage = 1 | 2;

/**
 * Lifecycle fields managed by the engine.
 * These are NEVER user-editable. The engine sets them during transitions.
 */
export interface EntryLifecycleFields {
  id: string;
  category: string;
  ownerEmail: string;
  schemaVersion: number;
  confirmationStatus: EntryStatus;
  createdAt: string;
  updatedAt: string;

  // Generation & timer
  committedAtISO?: string;
  generatedAt?: string;
  editWindowExpiresAt?: string;

  // PDF state
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string;
  pdfUrl?: string;
  pdfSourceHash?: string;
  pdfStale?: boolean;

  // Streak state
  streakEligible?: boolean;
  streakPermanentlyRemoved?: boolean;

  // Lock state
  permanentlyLocked?: boolean;

  // Edit request state
  editRequestedAt?: string;
  editRequestMessage?: string;
  editGrantedAt?: string;
  editGrantedBy?: string;
  editGrantedDays?: number;
  editRejectedReason?: string;

  // Delete request state
  deleteRequestedAt?: string;

  // Request tracking
  requestType?: 'edit' | 'delete' | null;
  requestCount?: number;
  requestCountResetAt?: string;

  // Archive state
  archivedAt?: string;
  archiveReason?: 'auto_no_pdf' | 'delete_approved' | null;

  // Timer warning
  timerWarningShown?: boolean;
}

/**
 * Canonical entry type.
 * Lifecycle fields are typed, category-specific data fields are in `data`.
 * File upload fields are top-level (Stage 2).
 */
export interface CanonicalEntry extends EntryLifecycleFields {
  /** Category-specific data fields (Stage 1 — affects PDF hash) */
  [key: string]: unknown;
}

/**
 * What the API MUST return after any entry mutation.
 * Includes computed fields the client needs for UI decisions.
 */
export interface EntryApiResponse extends CanonicalEntry {
  isEditable: boolean;
  isFinalized: boolean;
  editTimeRemaining: {
    hasEditWindow: boolean;
    expired: boolean;
    expiresAtISO: string | null;
    remainingMs: number;
    remainingLabel: string;
  };
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
  streakPermanentlyRemoved?: boolean;
  createdAt?: string;
  updatedAt?: string;

  // --- Generation & timer ---
  // `generatedAt` is the canonical timestamp for the DRAFT→GENERATED
  // auto-transition. Replaces the old `committedAtISO`.
  generatedAt?: string | null;
  /** @deprecated Use `generatedAt` instead. Kept for migration. */
  committedAtISO?: string | null;
  editWindowExpiresAt?: string | null;

  // Timer warning shown once per entry on first auto-transition
  timerWarningShown?: boolean;

  // --- PDF state (server-side) ---
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  pdfUrl?: string | null;

  // --- Edit request fields ---
  editRequestedAt?: string | null;
  editRequestMessage?: string | null;
  editGrantedAt?: string | null;
  editGrantedBy?: string | null;
  editGrantedDays?: number | null;
  editRejectedReason?: string | null;

  // --- Delete request fields ---
  requestType?: "edit" | "delete" | null;
  deleteRequestedAt?: string | null;

  // --- Request limits (3/month shared edit+delete) ---
  requestCount?: number;
  requestCountResetAt?: string | null;

  // --- Permanent lock (set after re-finalization from EDIT_GRANTED) ---
  permanentlyLocked?: boolean;

  // --- Archive ---
  archivedAt?: string | null;
  archiveReason?: "auto_no_pdf" | "delete_approved" | null;

  // --- Uploads ---
  attachments?: UploadedFile[];
  data?: Record<string, unknown>;

  // --- PDF meta (existing, kept for compatibility) ---
  pdfMeta?: {
    url?: string | null;
    fileName?: string;
    generatedAtISO?: string;
  } | null;
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
