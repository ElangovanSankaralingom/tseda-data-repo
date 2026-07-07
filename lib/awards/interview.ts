import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { withLock } from "@/lib/data/locks";
import { getUserStoreDir } from "@/lib/userStore";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getAwardMetric, maxPointsOf } from "@/data/awardMetrics";
import { getAwardPointsConfig, resolveEffectivePointsModel } from "@/lib/awards/config";

/**
 * COMMITTEE-AWARDED POINTS (roadmap #16) — the `source: "interview"` metrics
 * (studio focus, documentation/curation, beyond syllabus) are assessed by
 * the award committee, not derived from entries. This store holds what the
 * committee awarded, per faculty per academic year; the scoring engine
 * merges it so those metrics stop being 0 and the appraisal document
 * carries the committee's note.
 *
 * Storage: `<users>/<email>/interview-points.json` — INSIDE the user store
 * dir, so it is universe-scoped automatically (demo-mode practice awards
 * fork under /demo and are wiped on exit).
 */

export type InterviewAward = {
  points: number;
  /** Committee's one-line justification, carried into score notes + report. */
  note: string;
  awardedBy: string;
  awardedAt: string;
};

/** academicYear → metricId → award. */
export type InterviewPointsStore = {
  version: 1;
  years: Record<string, Record<string, InterviewAward>>;
};

const EMPTY: InterviewPointsStore = { version: 1, years: {} };
const MAX_NOTE = 300;

function storePath(email: string): string {
  return path.join(getUserStoreDir(normalizeEmail(email)), "interview-points.json");
}

export async function readInterviewPoints(email: string): Promise<InterviewPointsStore> {
  try {
    const raw = await fs.readFile(storePath(email), "utf8");
    const parsed = JSON.parse(raw) as Partial<InterviewPointsStore>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.years !== "object" || !parsed.years) {
      return { version: 1, years: {} };
    }
    return { version: 1, years: parsed.years };
  } catch {
    return { ...EMPTY, years: {} };
  }
}

/** Committee awards for one year (metricId → award), {} when none. */
export async function readInterviewPointsForYear(
  email: string,
  academicYear: string,
): Promise<Record<string, InterviewAward>> {
  const store = await readInterviewPoints(email);
  return store.years[academicYear] ?? {};
}

/**
 * Write (or clear, with `null`) one committee award. Validates the metric is
 * committee-assessed and clamps points into [0, effective max] so a stale
 * form can never persist more than the current rulebook allows.
 */
export async function setInterviewAward(
  email: string,
  academicYear: string,
  metricId: string,
  award: { points: number; note?: string } | null,
  awardedBy: string,
): Promise<Record<string, InterviewAward>> {
  const metric = getAwardMetric(metricId);
  if (!metric) throw new Error(`Unknown award metric: ${metricId}`);
  if (metric.source !== "interview") {
    throw new Error(`Metric ${metricId} is not committee-assessed.`);
  }
  const year = academicYear.trim();
  if (!/^Academic Year \d{4}-\d{4}$/.test(year)) {
    throw new Error("academicYear must look like \"Academic Year 2025-2026\".");
  }

  // Locked per-user RMW (2026-07 concurrency audit): concurrent committee
  // edits on different metrics must never lose each other.
  return withLock(`interview-points:${normalizeEmail(email)}`, async () => {
  const store = await readInterviewPoints(email);
  const yearAwards = { ...(store.years[year] ?? {}) };

  if (award === null) {
    delete yearAwards[metricId];
  } else {
    if (typeof award.points !== "number" || !Number.isFinite(award.points) || award.points < 0) {
      throw new Error("points must be a non-negative number.");
    }
    const config = await getAwardPointsConfig();
    const max = maxPointsOf(resolveEffectivePointsModel(metric, config));
    yearAwards[metricId] = {
      // 0.1 precision matches the scoring engine's rounding elsewhere.
      points: Math.round(Math.min(award.points, max) * 10) / 10,
      note: String(award.note ?? "").replace(/\0/g, "").trim().slice(0, MAX_NOTE),
      awardedBy: normalizeEmail(awardedBy),
      awardedAt: new Date().toISOString(),
    };
  }

  if (Object.keys(yearAwards).length === 0) {
    delete store.years[year];
  } else {
    store.years[year] = yearAwards;
  }

  const filePath = storePath(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteTextFile(filePath, JSON.stringify(store, null, 2));
  return store.years[year] ?? {};
  });
}
