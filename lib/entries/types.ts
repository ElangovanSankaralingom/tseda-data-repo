import type { Entry, EntryStatus, UploadedFile } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";
import type { CategorySlug } from "@/data/categoryRegistry";

export type CategoryKey = CategorySlug;

export type { Entry, EntryStatus, UploadedFile };
export type UploadMeta = UploadedFile;

export type LockStateColor = "normal" | "yellow" | "red";

export type { RequestEditStatus };

export type RequestEditableEntry = {
  id: string;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
};
