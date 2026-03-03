export type CategoryKey =
  | "fdp-attended"
  | "fdp-conducted"
  | "case-studies"
  | "guest-lectures"
  | "workshops";

export type UploadMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

export type PdfSnapshotMeta = {
  storedPath: string;
  url: string;
  fileName?: string;
  generatedAtISO?: string;
} | null;

export type LockStateColor = "normal" | "yellow" | "red";

export type RequestEditStatus = "none" | "pending" | "approved" | "rejected";

export type RequestEditableEntry = {
  id: string;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
};

export type FacultyRowEntry = {
  id: string;
  name: string;
  email: string;
  isLocked: boolean;
  savedAtISO?: string | null;
};
