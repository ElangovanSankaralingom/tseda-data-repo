import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import { CATEGORY_STORE_SCHEMA_VERSION } from "@/lib/migrations";
import { createEntryStatusRecord, type EntryStatus, type UploadedFile } from "@/lib/types/entry";
import type { CategoryKey } from "@/lib/entries/types";

// ---------------------------------------------------------------------------
// Severity & issue types
// ---------------------------------------------------------------------------

export type IssueSeverity = "info" | "warn" | "error";

export type IntegrityIssue = {
  code: string;
  severity: IssueSeverity;
  message: string;
  category?: CategoryKey;
  entryId?: string;
  fixAvailable: boolean;
};

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

export type CategoryIntegrityReport = {
  category: CategoryKey;
  filePath: string;
  exists: boolean;
  legacyFormat: boolean;
  totalEntries: number;
  issues: IntegrityIssue[];
};

export type IndexIntegrityReport = {
  filePath: string;
  exists: boolean;
  issues: IntegrityIssue[];
};

export type WalIntegrityReport = {
  filePath: string;
  exists: boolean;
  validLines: number;
  invalidLines: number;
  outOfOrderLines: number;
  issues: IntegrityIssue[];
};

export type IntegrityReport = {
  userEmail: string;
  checkedAtISO: string;
  perCategory: Record<CategoryKey, CategoryIntegrityReport>;
  indexReport: IndexIntegrityReport;
  walReport: WalIntegrityReport;
  issues: IntegrityIssue[];
};

export type IntegritySummary = {
  userEmail: string;
  totalIssues: number;
  infoCount: number;
  warnCount: number;
  errorCount: number;
  fixableCount: number;
  checkFailed: boolean;
  failureMessage?: string;
};

export type RepairResult = {
  userEmail: string;
  category: CategoryKey;
  fixedIssues: string[];
  backupsCreated: string[];
  filesTouched: string[];
};

export type MigrationResult = {
  userEmail: string;
  categories: Array<{
    category: CategoryKey;
    fixedIssues: string[];
    filesTouched: string[];
  }>;
  indexMigrated: boolean;
  backupsCreated: string[];
  filesTouched: string[];
};

export type CategoryRawRead = {
  filePath: string;
  exists: boolean;
  parseError: boolean;
  parsed: unknown | null;
};

export type EntryStatusCounts = Record<EntryStatus, number>;

export type CategoryDerivedStats = {
  entries: import("@/lib/types/entry").Entry[];
  total: number;
  pending: number;
  approved: number;
  lastEntryAtISO: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INDEX_FILE_NAME = "index.json";
export const WAL_FILE_NAME = "events.log";
export const ATTACHMENT_KEYS = [
  "attachments",
  "permissionLetter",
  "completionCertificate",
  "travelPlan",
  "brochure",
  "attendance",
  "speakerProfile",
  "organiserProfile",
  "geotaggedPhotos",
] as const;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isStoreV2(
  value: unknown
): value is { version: number; byId: Record<string, unknown>; order: unknown[] } {
  if (!isRecord(value)) return false;
  if (Number(value.version) !== CATEGORY_STORE_SCHEMA_VERSION) return false;
  if (!isRecord(value.byId)) return false;
  if (!Array.isArray(value.order)) return false;
  return true;
}

export function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

export function toIssue(
  input: Omit<IntegrityIssue, "fixAvailable"> & { fixAvailable?: boolean }
): IntegrityIssue {
  return {
    ...input,
    fixAvailable: input.fixAvailable ?? false,
  };
}

export function toISO(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : text;
}

export function compareTime(left: string | null, right: string | null) {
  const leftTime = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightTime = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return -1;
  if (Number.isNaN(rightTime)) return 1;
  return leftTime - rightTime;
}

export function emptyStatusCounts(): EntryStatusCounts {
  return createEntryStatusRecord(() => 0);
}

export function emptyCategoryCounts() {
  return CATEGORY_KEYS.reduce<Record<CategoryKey, number>>(
    (next, category) => {
      next[category] = 0;
      return next;
    },
    {} as Record<CategoryKey, number>
  );
}

export function isUploadedFileLike(value: unknown): value is UploadedFile {
  if (!isRecord(value)) return false;
  const fileName = String(value.fileName ?? "").trim();
  const mimeType = String(value.mimeType ?? "").trim();
  const url = String(value.url ?? "").trim();
  const storedPath = String(value.storedPath ?? "").trim();
  const uploadedAt = toISO(value.uploadedAt);
  const size = value.size;
  return !!(
    fileName &&
    mimeType &&
    url &&
    storedPath &&
    uploadedAt &&
    typeof size === "number" &&
    Number.isFinite(size) &&
    size >= 0
  );
}

export function hasPathTraversal(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");
  return !normalized || normalized.includes("../") || normalized.startsWith("..");
}
