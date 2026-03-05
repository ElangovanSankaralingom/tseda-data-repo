export type EntryStatus = "DRAFT" | "PENDING_CONFIRMATION" | "APPROVED" | "REJECTED";

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
  status?: string;
  confirmationStatus?: EntryStatus;
  createdAt?: string;
  updatedAt?: string;
  attachments?: UploadedFile[];
  data?: Record<string, unknown>;
};

export type EntryLike = Entry;

