import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { getUserStoreDir } from "@/lib/userStore";
import { normalizeEmail } from "@/lib/facultyDirectory";

/**
 * STUDENT-FEEDBACK CLAIM (Elan's S3 ruling, 2026-07): faculty select the
 * academic year + semester and enter their feedback PERCENTAGE (labs
 * excluded). Odd and even are AVERAGED for the award tier (≥90 → 10,
 * 80–90 → 5). The value is auditable against CAMU reports — the claim
 * stores who entered it and when.
 *
 * Storage: `<users>/<email>/feedback-claims.json` — inside the user store
 * dir, so universe-scoped (demo-safe) like the research profile.
 */

export type FeedbackYearClaim = {
  /** Percentages 0–100, 0.1 precision. Absent = not entered yet. */
  odd?: number;
  even?: number;
  updatedBy: string;
  updatedAt: string;
};

export type FeedbackClaimStore = {
  version: 1;
  years: Record<string, FeedbackYearClaim>;
};

function storePath(email: string): string {
  return path.join(getUserStoreDir(normalizeEmail(email)), "feedback-claims.json");
}

export async function readFeedbackClaims(email: string): Promise<FeedbackClaimStore> {
  try {
    const raw = await fs.readFile(storePath(email), "utf8");
    const parsed = JSON.parse(raw) as Partial<FeedbackClaimStore>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.years !== "object" || !parsed.years) {
      return { version: 1, years: {} };
    }
    return { version: 1, years: parsed.years };
  } catch {
    return { version: 1, years: {} };
  }
}

export async function readFeedbackClaimForYear(
  email: string,
  academicYear: string,
): Promise<FeedbackYearClaim | null> {
  const store = await readFeedbackClaims(email);
  return store.years[academicYear] ?? null;
}

function sanitizePercent(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error("Feedback percentage must be between 0 and 100.");
  }
  return Math.round(n * 10) / 10;
}

/** Write one year's claim (odd/even independently updatable; both-empty clears). */
export async function setFeedbackClaim(
  email: string,
  academicYear: string,
  claim: { odd?: number | null; even?: number | null },
  updatedBy: string,
): Promise<FeedbackClaimStore> {
  const year = academicYear.trim();
  if (!/^Academic Year \d{4}-\d{4}$/.test(year)) {
    throw new Error("academicYear must look like \"Academic Year 2025-2026\".");
  }
  const store = await readFeedbackClaims(email);
  const odd = sanitizePercent(claim.odd);
  const even = sanitizePercent(claim.even);

  if (odd === undefined && even === undefined) {
    delete store.years[year];
  } else {
    const next: FeedbackYearClaim = {
      updatedBy: normalizeEmail(updatedBy),
      updatedAt: new Date().toISOString(),
    };
    if (odd !== undefined) next.odd = odd;
    if (even !== undefined) next.even = even;
    store.years[year] = next;
  }

  const filePath = storePath(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteTextFile(filePath, JSON.stringify(store, null, 2));
  return store;
}

/** Average of the entered semesters (single-semester claims count as-is). */
export function feedbackAverage(claim: FeedbackYearClaim | null): number | null {
  if (!claim) return null;
  const values = [claim.odd, claim.even].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
