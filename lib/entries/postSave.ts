/**
 * Post-save entry normalization.
 *
 * Called from engine.ts before every entry write to ensure streak fields
 * are correct. This is the SINGLE SOURCE OF TRUTH for deriving
 * pdfGenerated and streakEligible from entry data.
 *
 * Why here: 5 separate API routes save entries independently. Rather than
 * patching each route, this function runs in the engine's single write
 * chokepoint so no route can miss it.
 */

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
 * Normalizes streak-related fields on an entry before it is persisted.
 *
 * Rules:
 * 1. pdfGenerated must be true if pdfMeta exists with valid data, or if
 *    pdfGeneratedAt is set (backward compat with entries created before
 *    the pdfGenerated flag was introduced).
 * 2. streakEligible is only set when pdfGenerated is true (checkpoint 1
 *    rule: Generate PDF is the gate to streak eligibility). Based on
 *    whether endDate is in the future (IST).
 * 3. Does NOT touch pdfStale — that is computed by the routes using
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

  return entry;
}
