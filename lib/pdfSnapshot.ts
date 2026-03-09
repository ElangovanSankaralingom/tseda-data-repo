import { getCategorySchema } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";

type PdfMetaLike = {
  url?: string | null;
  storedPath?: string | null;
} | null | undefined;

type FacultyRowLike = {
  id?: string | null;
  email?: string | null;
};

type PdfSnapshotCategory = CategoryKey;

type PdfStateInput = {
  pdfMeta: PdfMetaLike;
  pdfSourceHash?: string | null;
  draftHash: string;
  fieldsGateOk: boolean;
  isLocked?: boolean;
};

type PdfStateOutput = {
  pdfStale: boolean;
  canGenerate: boolean;
  canPreviewDownload: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function normalizeFacultyRows(rows: unknown) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const item = (row ?? {}) as FacultyRowLike;
    return {
      id: normalizeText(item.id),
      email: normalizeEmail(item.email),
    };
  });
}

/** Lifecycle and metadata fields excluded from the PDF hash */
const LIFECYCLE_FIELDS = new Set([
  'id', 'category', 'ownerEmail', 'schemaVersion', 'v',
  'status', 'confirmationStatus', 'createdAt', 'updatedAt',
  'committedAtISO', 'generatedAt', 'editWindowExpiresAt',
  'pdfGenerated', 'pdfGeneratedAt', 'pdfUrl', 'pdfSourceHash', 'pdfStale',
  'streakEligible', 'streakPermanentlyRemoved', 'permanentlyLocked',
  'editRequestedAt', 'editRequestMessage', 'editGrantedAt', 'editGrantedBy',
  'editGrantedDays', 'editRejectedReason', 'deleteRequestedAt',
  'requestType', 'requestCount', 'requestCountResetAt',
  'archivedAt', 'archiveReason', 'timerWarningShown',
  'attachments', 'data',
  'pdfMeta', 'streak',
]);

/** Cache of Stage 2 field keys per category */
const stage2Cache = new Map<string, Set<string>>();

function getStage2FieldKeys(category: string): Set<string> {
  let cached = stage2Cache.get(category);
  if (cached) return cached;
  try {
    const schema = getCategorySchema(category);
    cached = new Set(
      schema.fields
        .filter(f => f.stage === 2)
        .map(f => f.key)
    );
  } catch {
    cached = new Set();
  }
  stage2Cache.set(category, cached);
  return cached;
}

function normalizeValue(value: unknown, key: string): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return normalizeNullableNumber(value);
  if (typeof value === 'string') {
    // Check if it looks like a number field
    if (key === 'semesterNumber' || key === 'supportAmount' || key === 'participants' || key === 'amountSupport' || key === 'currentSemester') {
      return normalizeNullableNumber(value);
    }
    return normalizeText(value);
  }
  if (Array.isArray(value)) {
    // Normalize faculty row arrays (coCoordinators, staffAccompanying)
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && ('id' in value[0] || 'email' in value[0])) {
      return normalizeFacultyRows(value);
    }
    return value;
  }
  if (typeof value === 'object') {
    // Coordinator objects
    const obj = value as Record<string, unknown>;
    if ('id' in obj || 'email' in obj) {
      return { id: normalizeText(obj.id), email: normalizeEmail(obj.email) };
    }
    return value;
  }
  return value;
}

function getHashPayload(entry: Record<string, unknown>, category: PdfSnapshotCategory) {
  const stage2Fields = getStage2FieldKeys(category);
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(entry)) {
    if (LIFECYCLE_FIELDS.has(key)) continue;
    if (stage2Fields.has(key)) continue;

    const normalized = normalizeValue(value, key);
    if (normalized !== undefined) {
      payload[key] = normalized;
    }
  }

  return payload;
}

export function hashPrePdfFields(entry: unknown, category: PdfSnapshotCategory) {
  const record = ((entry ?? {}) as Record<string, unknown>) || {};
  return stableStringify(getHashPayload(record, category));
}

export function computePdfState({
  pdfMeta,
  pdfSourceHash,
  draftHash,
  fieldsGateOk,
}: PdfStateInput): PdfStateOutput {
  const hasPdf = !!pdfMeta?.url && !!pdfMeta?.storedPath;
  const pdfStale = hasPdf && !!pdfSourceHash && draftHash !== pdfSourceHash;

  return {
    pdfStale,
    canGenerate: fieldsGateOk && (!hasPdf || pdfStale),
    canPreviewDownload: hasPdf && !pdfStale,
  };
}

export function hydratePdfSnapshot<T extends { pdfMeta?: PdfMetaLike; pdfSourceHash?: string | null; pdfStale?: boolean }>(
  entry: T,
  category: PdfSnapshotCategory
) {
  const currentHash = hashPrePdfFields(entry, category);

  if (!entry.pdfMeta?.url || !entry.pdfMeta?.storedPath) {
    return {
      ...entry,
      pdfStale: false,
    };
  }

  return {
    ...entry,
    pdfSourceHash: entry.pdfSourceHash || currentHash,
    pdfStale: false,
  };
}

export type { PdfSnapshotCategory, PdfStateOutput };
