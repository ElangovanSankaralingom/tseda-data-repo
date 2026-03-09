import { type EntryApiResponse } from '@/lib/types/entry';
import { normalizeEntryStatus, isEntryEditable, isEntryFinalized, getEditTimeRemaining } from '@/lib/entries/workflow';
import { normalizeEntryStreakFields } from '@/lib/entries/postSave';
import { hashPrePdfFields, computePdfState, type PdfSnapshotCategory } from '@/lib/pdfSnapshot';

/**
 * Convert a raw stored entry to the canonical API response shape.
 *
 * This is the SINGLE function that ensures the client always gets:
 * - Normalized status
 * - All lifecycle fields present (not undefined)
 * - Computed fields (isEditable, isFinalized, editTimeRemaining)
 * - PDF state (pdfStale computed from hash)
 * - Streak fields normalized
 *
 * Every API route MUST use this before returning entry data.
 */
export function entryToApiResponse(
  rawEntry: Record<string, unknown>,
  category: string
): EntryApiResponse {
  // Step 1: Normalize streak fields (backfill pdfGenerated from pdfGeneratedAt, etc.)
  const normalized = normalizeEntryStreakFields(rawEntry);

  // Step 2: Ensure confirmationStatus is canonical
  const confirmationStatus = normalizeEntryStatus(normalized);
  normalized.confirmationStatus = confirmationStatus;

  // Step 3: Compute PDF state via hash comparison
  const draftHash = hashPrePdfFields(normalized, category as PdfSnapshotCategory);
  const pdfState = computePdfState({
    pdfMeta: normalized.pdfMeta as { url?: string | null; storedPath?: string | null } | null | undefined,
    pdfSourceHash: normalized.pdfSourceHash as string | null | undefined,
    draftHash,
    fieldsGateOk: true,
  });
  normalized.pdfStale = pdfState.pdfStale;

  // Step 4: Compute editability and finalization
  const isEditable = isEntryEditable(normalized);
  const isFinalized = isEntryFinalized(normalized);
  const editTimeRemaining = getEditTimeRemaining(normalized);

  // Step 5: Return with all computed fields
  return {
    ...normalized,
    confirmationStatus,
    isEditable,
    isFinalized,
    editTimeRemaining,
  } as EntryApiResponse;
}

/**
 * Convert an array of entries (e.g., for list endpoints).
 */
export function entriesToApiResponse(
  entries: Record<string, unknown>[],
  category: string
): EntryApiResponse[] {
  return entries.map(e => entryToApiResponse(e, category));
}
