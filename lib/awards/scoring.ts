import "server-only";

import { CATEGORY_LIST } from "@/data/categoryRegistry";
import {
  AWARD_METRICS,
  AWARD_SECTIONS,
  maxPointsOf,
  type AwardMetricDefinition,
  type AwardPointsModel,
  type AwardSectionId,
} from "@/data/awardMetrics";
import { getAwardPointsConfig, resolveEffectivePointsModel } from "@/lib/awards/config";
import { readCategoryEntries } from "@/lib/dataStore";
import { normalizeEntryStatus } from "@/lib/entries/workflow";
import type { CategoryKey } from "@/lib/entries/types";

/**
 * AWARD SCORING ENGINE — committed entries → points, per faculty per
 * academic year.
 *
 * Rules of the house:
 *  - Only COMMITTED entries score (status GENERATED — i.e. the data was
 *    locked into a document). Drafts and archived entries never score.
 *  - Year bucketing uses the entry's own `academicYear` field
 *    ("Academic Year 2025-2026").
 *  - Point values ALWAYS resolve through the admin-adjustable config
 *    (lib/awards/config.ts) — never the registry defaults directly.
 *  - Derivers are explicit per metric id. A metric whose entries lack the
 *    data it needs reports WHY (`notes`), so the dashboard can tell the
 *    faculty what to record instead of silently scoring zero.
 */

export type MetricScoreStatus =
  | "scored" // entry-derived, points > 0
  | "zero" // entry-derived, trackable today, nothing qualifying yet
  | "untracked" // claim-based: needs a future category (roadmap)
  | "manual"; // interview/committee-awarded

export type MetricScore = {
  id: string;
  section: AwardSectionId;
  label: string;
  source: AwardMetricDefinition["source"];
  effort: AwardMetricDefinition["effort"];
  status: MetricScoreStatus;
  points: number;
  /** Qualifying entry count (entry-derived metrics). */
  count: number;
  /** Max points one instance can yield under the EFFECTIVE model. */
  maxPointsPerInstance: number;
  /** Human-readable reasons (e.g. "2 entries skipped: participants not > 20"). */
  notes: string[];
};

export type SectionScore = {
  section: AwardSectionId;
  label: string;
  points: number;
  scoredMetrics: number;
  totalMetrics: number;
};

export type AwardScore = {
  academicYear: string;
  totalPoints: number;
  sections: SectionScore[];
  metrics: MetricScore[];
  /** Entry-derived metrics currently auto-tracked vs the whole rulebook. */
  coverage: { tracked: number; total: number };
  strengths: MetricScore[];
  quickWins: MetricScore[];
};

type EntryRecord = Record<string, unknown>;

function isCommitted(entry: EntryRecord): boolean {
  return normalizeEntryStatus(entry) === "GENERATED";
}

function inYear(entry: EntryRecord, academicYear: string): boolean {
  return String(entry.academicYear ?? "").trim() === academicYear;
}

function inclusiveDays(entry: EntryRecord): number | null {
  const start = Date.parse(String(entry.startDate ?? ""));
  const end = Date.parse(String(entry.endDate ?? ""));
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function tierPoints(model: AwardPointsModel, tierKey: string): number {
  if (model.kind !== "tiered") return 0;
  return model.tiers.find((t) => t.key === tierKey)?.points ?? 0;
}

/** T'SEDA conference-organizing share by role (50/30/20). */
const CONFERENCE_ROLE_SHARE: Record<string, number> = {
  "Coordinator": 0.5,
  "Co-Coordinator": 0.3,
  "Committee Member": 0.2,
};

function conferenceOrganizedShare(
  entriesByCategory: Map<CategoryKey, EntryRecord[]>,
  model: AwardPointsModel,
  level: "National" | "International",
): { points: number; count: number; notes: string[] } {
  const fixed = model.kind === "fixed" ? model.points : 0;
  let points = 0;
  let count = 0;
  const notes: string[] = [];
  for (const entry of entriesByCategory.get("conferences-organized") ?? []) {
    if (String(entry.level ?? "") !== level) continue;
    const share = CONFERENCE_ROLE_SHARE[String(entry.role ?? "")];
    if (share === undefined) {
      notes.push("1 conference skipped: role not recognised for the point share");
      continue;
    }
    points += Math.round(fixed * share * 10) / 10;
    count += 1;
  }
  return { points: Math.round(points * 10) / 10, count, notes };
}

// ── Per-metric derivers (explicit — no generic rule evaluation) ────────────

type DeriverInput = {
  entriesByCategory: Map<CategoryKey, EntryRecord[]>;
  model: AwardPointsModel;
};

type DeriverResult = { points: number; count: number; notes: string[] };

const DERIVERS: Record<string, (input: DeriverInput) => DeriverResult> = {
  /** Journal publications (record flow): flat per-unit points per committed
   *  paper — the engine already guarantees proofs exist at submit. */
  journal_publication({ entriesByCategory, model }) {
    const entries = entriesByCategory.get("journal-publications") ?? [];
    const perUnit = model.kind === "perUnit" ? model.points : 0;
    return { points: perUnit * entries.length, count: entries.length, notes: [] };
  },

  /** Conference publications (record flow): same flat per-unit rule. */
  conference_publication({ entriesByCategory, model }) {
    const entries = entriesByCategory.get("conference-publications") ?? [];
    const perUnit = model.kind === "perUnit" ? model.points : 0;
    return { points: perUnit * entries.length, count: entries.length, notes: [] };
  },

  /** Books (record flow): books-and-chapters entries with kind = Book. */
  book_publication({ entriesByCategory, model }) {
    const entries = (entriesByCategory.get("books-and-chapters") ?? []).filter(
      (entry) => String(entry.kind ?? "") === "Book",
    );
    const perUnit = model.kind === "perUnit" ? model.points : 0;
    return { points: perUnit * entries.length, count: entries.length, notes: [] };
  },

  /** Chapters (record flow): books-and-chapters entries with kind = Chapter. */
  book_chapter({ entriesByCategory, model }) {
    const entries = (entriesByCategory.get("books-and-chapters") ?? []).filter(
      (entry) => String(entry.kind ?? "") === "Chapter",
    );
    const perUnit = model.kind === "perUnit" ? model.points : 0;
    return { points: perUnit * entries.length, count: entries.length, notes: [] };
  },

  /** Patents (record flow): the status field picks the tier (granted 10 /
   *  published 5). */
  utility_patent({ entriesByCategory, model }) {
    let points = 0;
    let count = 0;
    for (const entry of entriesByCategory.get("patents") ?? []) {
      const tier = String(entry.status ?? "") === "Granted" ? "granted" : "published";
      points += tierPoints(model, tier);
      count += 1;
    }
    return { points, count, notes: [] };
  },

  /** R&D funding (record flow): kind = R&D; the amount (INR → lakhs) picks
   *  the tier (<5L 5 · 5–10L 10 · 10–20L 15 · 20–50L 20 · ≥50L 25). */
  rd_funding({ entriesByCategory, model }) {
    let points = 0;
    let count = 0;
    for (const entry of entriesByCategory.get("research-funding") ?? []) {
      if (String(entry.kind ?? "") !== "R&D") continue;
      const lakhs = (Number(entry.amountInr) || 0) / 100_000;
      const tier =
        lakhs >= 50 ? "gte50" :
        lakhs >= 20 ? "20to50" :
        lakhs >= 10 ? "10to20" :
        lakhs >= 5 ? "5to10" : "lt5";
      points += tierPoints(model, tier);
      count += 1;
    }
    return { points, count, notes: [] };
  },

  /** Non-R&D funding (record flow): kind = Consultancy/Other; amount picks
   *  the tier (<2.5L 3 / ≥2.5L 5). */
  non_rd_funding({ entriesByCategory, model }) {
    let points = 0;
    let count = 0;
    for (const entry of entriesByCategory.get("research-funding") ?? []) {
      const kind = String(entry.kind ?? "");
      if (kind !== "Consultancy" && kind !== "Other") continue;
      const lakhs = (Number(entry.amountInr) || 0) / 100_000;
      points += tierPoints(model, lakhs >= 2.5 ? "gte2_5" : "lt2_5");
      count += 1;
    }
    return { points, count, notes: [] };
  },

  /** Conferences organized (permission flow): fixed points × the T'SEDA
   *  role share — Coordinator 50%, Co-Coordinator 30%, Committee Member 20%.
   *  Split by level into the two metrics. */
  intl_conference_organized({ entriesByCategory, model }) {
    return conferenceOrganizedShare(entriesByCategory, model, "International");
  },

  natl_conference_organized({ entriesByCategory, model }) {
    return conferenceOrganizedShare(entriesByCategory, model, "National");
  },

  /** Editorial roles (record flow): fixed points, awarded ONCE per year when
   *  at least one Editor / Associate Editor role exists. Board memberships
   *  and reviewer roles are recorded but not points-eligible. */
  editorial_role({ entriesByCategory, model }) {
    const entries = entriesByCategory.get("editorial-roles") ?? [];
    const qualifying = entries.filter((entry) => {
      const role = String(entry.role ?? "");
      return role === "Editor" || role === "Associate Editor";
    });
    const fixed = model.kind === "fixed" ? model.points : 0;
    const notes: string[] = [];
    const nonScoring = entries.length - qualifying.length;
    if (nonScoring > 0) {
      notes.push(`${nonScoring} recorded role(s) (board/reviewer) are not points-eligible`);
    }
    return {
      points: qualifying.length > 0 ? fixed : 0,
      count: qualifying.length,
      notes,
    };
  },

  /** Workshops: India vs abroad via the entry's `level` field. */
  collab_workshop({ entriesByCategory, model }) {
    let points = 0;
    let count = 0;
    for (const entry of entriesByCategory.get("workshops") ?? []) {
      const tier = String(entry.level ?? "") === "International" ? "international" : "india";
      points += tierPoints(model, tier);
      count += 1;
    }
    return { points, count, notes: [] };
  },

  /** Guest lectures: same India/abroad split via `level`. */
  collab_guest_lecture({ entriesByCategory, model }) {
    let points = 0;
    let count = 0;
    for (const entry of entriesByCategory.get("guest-lectures") ?? []) {
      const tier = String(entry.level ?? "") === "International" ? "international" : "india";
      points += tierPoints(model, tier);
      count += 1;
    }
    return { points, count, notes: [] };
  },

  /** FDPs conducted: tier by duration; requires > 20 outside participants. */
  fdp_conducted({ entriesByCategory, model }) {
    let points = 0;
    let count = 0;
    let skippedParticipants = 0;
    let skippedDates = 0;
    for (const entry of entriesByCategory.get("fdp-conducted") ?? []) {
      const participants = Number(entry.numberOfParticipants ?? Number.NaN);
      if (!Number.isFinite(participants) || participants <= 20) {
        skippedParticipants += 1;
        continue;
      }
      const days = inclusiveDays(entry);
      if (days === null) {
        skippedDates += 1;
        continue;
      }
      points += tierPoints(model, days <= 5 ? "short" : "long");
      count += 1;
    }
    const notes: string[] = [];
    if (skippedParticipants > 0) {
      notes.push(`${skippedParticipants} not counted: participants not recorded as > 20`);
    }
    if (skippedDates > 0) notes.push(`${skippedDates} not counted: missing dates`);
    return { points, count, notes };
  },
};

// ── Public API ──────────────────────────────────────────────────────────────

/** Academic years present in a faculty member's entries (any status), newest first. */
export async function listFacultyAcademicYears(email: string): Promise<string[]> {
  const years = new Set<string>();
  for (const category of CATEGORY_LIST) {
    const entries = await readCategoryEntries(email, category);
    for (const entry of entries) {
      const year = String((entry as EntryRecord).academicYear ?? "").trim();
      if (year) years.add(year);
    }
  }
  return [...years].sort().reverse();
}

export async function computeFacultyAwardScore(
  email: string,
  academicYear: string,
): Promise<AwardScore> {
  const config = await getAwardPointsConfig();

  // One read per category, committed + in-year only.
  const entriesByCategory = new Map<CategoryKey, EntryRecord[]>();
  for (const category of CATEGORY_LIST) {
    const entries = await readCategoryEntries(email, category);
    entriesByCategory.set(
      category,
      (entries as EntryRecord[]).filter((e) => isCommitted(e) && inYear(e, academicYear)),
    );
  }

  const metrics: MetricScore[] = AWARD_METRICS.map((metric) => {
    const model = resolveEffectivePointsModel(metric, config);
    const base: Omit<MetricScore, "status" | "points" | "count" | "notes"> = {
      id: metric.id,
      section: metric.section,
      label: metric.label,
      source: metric.source,
      effort: metric.effort,
      maxPointsPerInstance: maxPointsOf(model),
    };

    if (metric.source === "entry") {
      const deriver = DERIVERS[metric.id];
      if (!deriver) {
        return { ...base, status: "zero", points: 0, count: 0, notes: ["No deriver wired"] };
      }
      const { points, count, notes } = deriver({ entriesByCategory, model });
      return {
        ...base,
        status: points > 0 ? "scored" : "zero",
        points,
        count,
        notes,
      } as MetricScore;
    }

    return {
      ...base,
      status: metric.source === "interview" ? "manual" : "untracked",
      points: 0,
      count: 0,
      notes: [],
    } as MetricScore;
  });

  const sections: SectionScore[] = (Object.keys(AWARD_SECTIONS) as AwardSectionId[])
    .sort((a, b) => AWARD_SECTIONS[a].order - AWARD_SECTIONS[b].order)
    .map((section) => {
      const own = metrics.filter((m) => m.section === section);
      return {
        section,
        label: AWARD_SECTIONS[section].label,
        points: own.reduce((sum, m) => sum + m.points, 0),
        scoredMetrics: own.filter((m) => m.status === "scored").length,
        totalMetrics: own.length,
      };
    });

  const scored = metrics.filter((m) => m.status === "scored");
  const strengths = [...scored].sort((a, b) => b.points - a.points).slice(0, 3);
  const quickWins = metrics
    .filter((m) => m.points === 0 && m.effort === "low")
    .sort((a, b) => b.maxPointsPerInstance - a.maxPointsPerInstance)
    .slice(0, 4);

  return {
    academicYear,
    totalPoints: metrics.reduce((sum, m) => sum + m.points, 0),
    sections,
    metrics,
    coverage: {
      tracked: AWARD_METRICS.filter((m) => m.source === "entry").length,
      total: AWARD_METRICS.length,
    },
    strengths,
    quickWins,
  };
}
