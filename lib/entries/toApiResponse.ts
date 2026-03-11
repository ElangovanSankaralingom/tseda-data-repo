import { type EntryApiResponse } from '@/lib/types/entry';
import { normalizeEntryStatus, isEntryEditable, isEntryFinalized, getEditTimeRemaining } from '@/lib/entries/workflow';
import { hashPrePdfFields, computePdfState, type PdfSnapshotCategory } from '@/lib/pdfSnapshot';

/**
 * Convert a raw stored entry to the canonical API response shape.
 *
 * This is the SINGLE function that ensures the client always gets:
 * - Normalized status
 * - All lifecycle fields present (not undefined)
 * - Computed fields (isEditable, isFinalized, editTimeRemaining)
 * - PDF state (pdfStale computed from hash)
 *
 * Streak fields (pdfGenerated, streakEligible, editWindowExpiresAt) are now
 * set correctly at write time by engine.ts — no read-time normalization needed.
 *
 * Every API route MUST use this before returning entry data.
 */
export function entryToApiResponse(
  rawEntry: Record<string, unknown>,
  category: string
): EntryApiResponse {
  const normalized = rawEntry;

  // Step 1: Ensure confirmationStatus is canonical
  const confirmationStatus = normalizeEntryStatus(normalized);
  normalized.confirmationStatus = confirmationStatus;

  // Step 2: Compute PDF state via hash comparison
  const draftHash = hashPrePdfFields(normalized, category as PdfSnapshotCategory);
  const pdfState = computePdfState({
    pdfMeta: normalized.pdfMeta as { url?: string | null; storedPath?: string | null } | null | undefined,
    pdfSourceHash: normalized.pdfSourceHash as string | null | undefined,
    draftHash,
    fieldsGateOk: true,
  });
  normalized.pdfStale = pdfState.pdfStale;

  // Step 3: Compute editability and finalization
  const isEditable = isEntryEditable(normalized);
  const isFinalized = isEntryFinalized(normalized);
  const editTimeRemaining = getEditTimeRemaining(normalized);

  // Step 4: Return with all computed fields
  return {
    ...normalized,
    confirmationStatus,
    isEditable,
    isFinalized,
    editTimeRemaining,
    timerPausedAt: normalized.timerPausedAt ?? null,
    timerRemainingMs: normalized.timerRemainingMs ?? null,
    hashAtEditGrant: normalized.hashAtEditGrant ?? null,
    requestActionUsed: normalized.requestActionUsed ?? false,
    permanentlyLocked: normalized.permanentlyLocked ?? false,
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
