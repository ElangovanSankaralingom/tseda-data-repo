/**
 * @deprecated This module was a workaround for routes bypassing engine.ts.
 * As of Phase 3, all mutations go through engine.ts which sets fields correctly
 * at write time via prepareEntryForWrite(). Read-time normalization callers
 * (dashboard, toApiResponse, categoryRouteHandler) have been removed.
 *
 * Remaining callers:
 * - engine.ts prepareEntryForWrite() — canonical write-time normalization
 * - scripts/migrate-normalize-entries.ts — one-time migration for old entries
 *
 * Do NOT add new callers.
 */

import { APP_CONFIG } from "@/lib/config/appConfig";
import { nowISTDateISO } from "@/lib/time";

/**
 * Returns true if the entry has valid pdfMeta (stored path + url).
 */
function hasPdfMeta(entry: Record<string, unknown>): boolean {
  const meta = entry.pdfMeta;
  if (!meta || typeof meta !== "object") return false;
  const record = meta as Record<string, unknown>;
  return !!(
    typeof record.storedPath === "string" &&
    record.storedPath.trim() &&
    typeof record.url === "string" &&
    record.url.trim()
  );
}

/**
 * Normalizes streak-related fields on an entry.
 *
 * Called both at write-time (engine.ts) and read-time (dashboard).
 *
 * Rules:
 * 1. pdfGenerated must be true if pdfMeta exists with valid data, or if
 *    pdfGeneratedAt is set (backward compat with entries created before
 *    the pdfGenerated flag was introduced).
 * 2. streakEligible is only set when pdfGenerated is true (checkpoint 1
 *    rule: Generate PDF is the gate to streak eligibility). Based on
 *    whether endDate is in the future (IST).
 * 3. editWindowExpiresAt safety net: if status is GENERATED but field is
 *    missing, backfill from committedAtISO + 3 days.
 * 4. Does NOT touch pdfStale — that is computed by the routes using
 *    pdfSourceHash comparison.
 */
export function normalizeEntryStreakFields(
  entry: Record<string, unknown>
): Record<string, unknown> {
  // 1. Derive pdfGenerated from pdfMeta or pdfGeneratedAt
  if (hasPdfMeta(entry)) {
    entry.pdfGenerated = true;
    if (!entry.pdfGeneratedAt) {
      const meta = entry.pdfMeta as Record<string, unknown>;
      if (typeof meta.generatedAtISO === "string" && meta.generatedAtISO.trim()) {
        entry.pdfGeneratedAt = meta.generatedAtISO;
      }
    }
  } else if (
    typeof entry.pdfGeneratedAt === "string" &&
    entry.pdfGeneratedAt.trim()
  ) {
    // Backward compat: pdfGeneratedAt exists but pdfGenerated wasn't set
    entry.pdfGenerated = true;
  }

  // 2. Streak eligibility: only when PDF has been generated
  if (entry.pdfGenerated === true) {
    const endDate = entry.endDate;
    if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      const todayIST = nowISTDateISO();
      entry.streakEligible = endDate.trim() > todayIST;
    } else {
      // No valid end date → not eligible
      entry.streakEligible = false;
    }
  }
  // If pdfGenerated is not true, don't touch streakEligible — it stays
  // as whatever it was (typically undefined/false for draft entries).

  // 3. editWindowExpiresAt safety net: if GENERATED but missing expiry,
  //    backfill from committedAtISO/generatedAt + DEFAULT_EDIT_WINDOW_DAYS.
  //    The canonical path (commitDraft in engine.ts) always sets this via
  //    computeEditWindowExpiry(), but old entries may lack it.
  const status = entry.confirmationStatus ?? entry.status;
  if (
    status === "GENERATED" &&
    !entry.editWindowExpiresAt &&
    entry.pdfGenerated === true
  ) {
    const baseISO =
      (typeof entry.committedAtISO === "string" && entry.committedAtISO.trim()
        ? entry.committedAtISO
        : typeof entry.generatedAt === "string" && entry.generatedAt.trim()
          ? entry.generatedAt
          : typeof entry.pdfGeneratedAt === "string" && entry.pdfGeneratedAt.trim()
            ? entry.pdfGeneratedAt
            : null) as string | null;

    if (baseISO) {
      const DEFAULT_EDIT_WINDOW_DAYS = APP_CONFIG.entryLifecycle.defaultEditWindowDays;
      const STREAK_BUFFER_DAYS = APP_CONFIG.entryLifecycle.streakEditWindowBufferDays;
      const defaultExpiry = new Date(
        new Date(baseISO).getTime() + DEFAULT_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      if (
        entry.streakEligible === true &&
        typeof entry.endDate === "string" &&
        entry.endDate.trim()
      ) {
        const endDateExpiry = new Date(
          new Date(entry.endDate.trim() + "T23:59:59.999Z").getTime() +
            STREAK_BUFFER_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        entry.editWindowExpiresAt =
          endDateExpiry > defaultExpiry ? endDateExpiry : defaultExpiry;
      } else {
        entry.editWindowExpiresAt = defaultExpiry;
      }
    }
  }

  return entry;
}
