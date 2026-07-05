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
import { feedbackAverage, readFeedbackClaims, readFeedbackClaimForYear } from "@/lib/awards/feedback";
import { readInterviewPointsForYear } from "@/lib/awards/interview";
import { readResearchProfile, type ResearchProfile } from "@/lib/research/researchProfile";
import { academicYearOfDate } from "@/lib/utils/academicYear";
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
  /** Profile-sourced metrics (Ph.D. milestones) read the Research section. */
  researchProfile: ResearchProfile;
  /** The academic year being scored — profile dates bucket against this. */
  academicYear: string;
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

  /** Open reviews & exhibitions (S1, record flow): studio-contributions
   *  entries of the two scoring kinds, 1/unit capped at the model max.
   *  Documentation / beyond-syllabus entries don't score here — they are
   *  the committee's evidence base for the S1 interview metrics. */
  open_reviews_exhibitions({ entriesByCategory, model }) {
    const all = entriesByCategory.get("studio-contributions") ?? [];
    const scoring = all.filter((entry) => {
      const kind = String(entry.contributionKind ?? "");
      return kind === "Open Review / Jury" || kind === "Exhibition of Student Work";
    });
    const perUnit = model.kind === "perUnit" ? model.points : 0;
    const cap = model.kind === "perUnit" ? model.maxPoints ?? Number.POSITIVE_INFINITY : 0;
    const raw = perUnit * scoring.length;
    const points = Math.min(raw, cap);
    const notes: string[] = [];
    if (raw > points) notes.push(`Capped at ${cap} (${scoring.length} qualifying events)`);
    const evidenceOnly = all.length - scoring.length;
    if (evidenceOnly > 0) {
      notes.push(`${evidenceOnly} documentation/beyond-syllabus entries recorded as committee evidence`);
    }
    return { points, count: scoring.length, notes };
  },

  /** Design competitions (permission flow): result picks the tier —
   *  Recognized Entry / Award 5, Participation 2. Entries whose result is
   *  not recorded yet (letter generated, competition pending) score 0 with
   *  an honest note. */
  design_competition({ entriesByCategory, model }) {
    const entries = entriesByCategory.get("design-competitions") ?? [];
    let points = 0;
    let count = 0;
    let pending = 0;
    for (const entry of entries) {
      const result = String(entry.result ?? "");
      if (result === "Recognized Entry / Award") {
        points += tierPoints(model, "award");
        count += 1;
      } else if (result === "Participation") {
        points += tierPoints(model, "participation");
        count += 1;
      } else {
        pending += 1;
      }
    }
    const notes: string[] = [];
    if (pending > 0) notes.push(`${pending} not counted: result not recorded yet`);
    return { points, count, notes };
  },

  /** Fast/slow-learner mentoring (permission flow): fixed 5, awarded ONCE
   *  per year regardless of how many programmes ran (rulebook semantics —
   *  same shape as editorial_role). */
  fast_slow_learners({ entriesByCategory, model }) {
    const entries = entriesByCategory.get("mentoring-programs") ?? [];
    if (entries.length === 0) return { points: 0, count: 0, notes: [] };
    const fixed = model.kind === "fixed" ? model.points : 0;
    const notes: string[] = [];
    if (entries.length > 1) {
      notes.push(`${entries.length} programmes recorded — fixed points awarded once`);
    }
    return { points: fixed, count: entries.length, notes };
  },

  /** TCE online courses (permission flow): duration tier 4w→10 / 8w→15 /
   *  12w→20, new and rerun both count. */
  tce_online_course({ entriesByCategory, model }) {
    const entries = (entriesByCategory.get("online-courses") ?? []).filter(
      (entry) => String(entry.courseKind ?? "") === "TCE Online Course",
    );
    let points = 0;
    let count = 0;
    const notes: string[] = [];
    for (const entry of entries) {
      const weeks = String(entry.durationWeeks ?? "");
      const key = weeks === "4" ? "w4" : weeks === "8" ? "w8" : weeks === "12" ? "w12" : "";
      if (!key) {
        notes.push("1 not counted: duration not recorded");
        continue;
      }
      points += tierPoints(model, key);
      count += 1;
    }
    return { points, count, notes };
  },

  /** Industry-supported courses (permission flow): credits tier 1→4 / 2→8. */
  industry_supported_course({ entriesByCategory, model }) {
    const entries = (entriesByCategory.get("online-courses") ?? []).filter(
      (entry) => String(entry.courseKind ?? "") === "Industry-Supported Course",
    );
    let points = 0;
    let count = 0;
    const notes: string[] = [];
    for (const entry of entries) {
      const credits = String(entry.credits ?? "");
      const key = credits === "1" ? "one_credit" : credits === "2" ? "two_credits" : "";
      if (!key) {
        notes.push("1 not counted: credits not recorded");
        continue;
      }
      points += tierPoints(model, key);
      count += 1;
    }
    return { points, count, notes };
  },

  /** Public exhibitions / outreach (permission flow): 2 per event, cap 4. */
  public_exhibition({ entriesByCategory, model }) {
    const entries = entriesByCategory.get("exhibitions-outreach") ?? [];
    const perUnit = model.kind === "perUnit" ? model.points : 0;
    const cap = model.kind === "perUnit" ? model.maxPoints ?? Number.POSITIVE_INFINITY : 0;
    const raw = perUnit * entries.length;
    const points = Math.min(raw, cap);
    const notes: string[] = [];
    if (raw > points) notes.push(`Capped at ${cap} (${entries.length} events)`);
    return { points, count: entries.length, notes };
  },

  /** Creative publications (record flow): flat per-unit per committed piece. */
  creative_publication({ entriesByCategory, model }) {
    const entries = entriesByCategory.get("creative-publications") ?? [];
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

  /** Ph.D. awarded (profile-sourced): fixed points in the academic year of
   *  the OWN viva date — the only date the T'SEDA rule considers. */
  phd_awarded({ researchProfile, model, academicYear }) {
    const fixed = model.kind === "fixed" ? model.points : 0;
    const own = researchProfile.ownPhd;
    if (own.status !== "Awarded" || !own.vivaDate) {
      return { points: 0, count: 0, notes: [] };
    }
    const vivaYear = academicYearOfDate(own.vivaDate);
    if (vivaYear !== academicYear) {
      return { points: 0, count: 0, notes: [`Ph.D. viva falls in ${vivaYear ?? "an unknown year"}`] };
    }
    return { points: fixed, count: 1, notes: [] };
  },

  /** Ph.D. guided (profile-sourced): per scholar whose viva date falls in
   *  the scored academic year. */
  phd_guided({ researchProfile, model, academicYear }) {
    const perUnit = model.kind === "perUnit" ? model.points : 0;
    const qualifying = researchProfile.guidedScholars.filter(
      (scholar) => academicYearOfDate(scholar.vivaDate) === academicYear,
    );
    const pending = researchProfile.guidedScholars.length - qualifying.length;
    const notes: string[] = [];
    if (pending > 0) {
      notes.push(`${pending} scholar(s) recorded with viva outside this year (or pending)`);
    }
    return { points: perUnit * qualifying.length, count: qualifying.length, notes };
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

  /** FDPs conducted: tier by duration; requires > 20 OUTSIDE participants.
   *  Prefers the dedicated `outsideParticipants` field; falls back to total
   *  `numberOfParticipants` as a proxy (noted honestly). */
  fdp_conducted({ entriesByCategory, model }) {
    let points = 0;
    let count = 0;
    let skippedParticipants = 0;
    let skippedDates = 0;
    let proxied = 0;
    for (const entry of entriesByCategory.get("fdp-conducted") ?? []) {
      const outside = Number(entry.outsideParticipants ?? Number.NaN);
      const total = Number(entry.numberOfParticipants ?? Number.NaN);
      const participants = Number.isFinite(outside) ? outside : total;
      if (!Number.isFinite(participants) || participants <= 20) {
        skippedParticipants += 1;
        continue;
      }
      const days = inclusiveDays(entry);
      if (days === null) {
        skippedDates += 1;
        continue;
      }
      if (!Number.isFinite(outside)) proxied += 1;
      points += tierPoints(model, days <= 5 ? "short" : "long");
      count += 1;
    }
    const notes: string[] = [];
    if (proxied > 0) {
      notes.push(`${proxied} judged on TOTAL participants (outside count not recorded — rule wants > 20 outside)`);
    }
    if (skippedParticipants > 0) {
      notes.push(`${skippedParticipants} not counted: participants not recorded as > 20`);
    }
    if (skippedDates > 0) notes.push(`${skippedDates} not counted: missing dates`);
    return { points, count, notes };
  },
};

// ── Public API ──────────────────────────────────────────────────────────────

/** Academic years present in a faculty member's entries (any status) and
 *  profile viva dates, newest first. */
export async function listFacultyAcademicYears(email: string): Promise<string[]> {
  const years = new Set<string>();
  for (const category of CATEGORY_LIST) {
    const entries = await readCategoryEntries(email, category);
    for (const entry of entries) {
      const year = String((entry as EntryRecord).academicYear ?? "").trim();
      if (year) years.add(year);
    }
  }
  const research = await readResearchProfile(email);
  const vivaDates = [
    research.ownPhd.vivaDate,
    ...research.guidedScholars.map((scholar) => scholar.vivaDate),
  ];
  for (const date of vivaDates) {
    const year = academicYearOfDate(date);
    if (year) years.add(year);
  }
  // Feedback claims can exist before any entry does — their years count too.
  const feedback = await readFeedbackClaims(email);
  for (const year of Object.keys(feedback.years)) years.add(year);
  return [...years].sort().reverse();
}

/** Committed, in-year entries per category — THE data the award sees. The
 *  appraisal report consumes this too, so report and score can never drift. */
export async function listCommittedEntriesForYear(
  email: string,
  academicYear: string,
): Promise<Map<CategoryKey, EntryRecord[]>> {
  const entriesByCategory = new Map<CategoryKey, EntryRecord[]>();
  for (const category of CATEGORY_LIST) {
    const entries = await readCategoryEntries(email, category);
    entriesByCategory.set(
      category,
      (entries as EntryRecord[]).filter((e) => isCommitted(e) && inYear(e, academicYear)),
    );
  }
  return entriesByCategory;
}

export async function computeFacultyAwardScore(
  email: string,
  academicYear: string,
): Promise<AwardScore> {
  const config = await getAwardPointsConfig();

  // One read per category, committed + in-year only.
  const entriesByCategory = await listCommittedEntriesForYear(email, academicYear);

  // Profile-sourced metrics (Ph.D. milestones) read the Research section.
  const researchProfile = await readResearchProfile(email);

  // Committee-awarded points (source: "interview") — entered by the award
  // committee on the admin scores view, merged here so manual metrics stop
  // being 0 once assessed.
  const interviewAwards = await readInterviewPointsForYear(email, academicYear);

  // Student-feedback claim (S3): self-entered ODD/EVEN percentages,
  // averaged into the tier. Auditable against CAMU.
  const feedbackClaim = await readFeedbackClaimForYear(email, academicYear);

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

    if (metric.source === "entry" || metric.source === "profile") {
      const deriver = DERIVERS[metric.id];
      if (!deriver) {
        return { ...base, status: "zero", points: 0, count: 0, notes: ["No deriver wired"] };
      }
      const { points, count, notes } = deriver({ entriesByCategory, model, researchProfile, academicYear });
      return {
        ...base,
        status: points > 0 ? "scored" : "zero",
        points,
        count,
        notes,
      } as MetricScore;
    }

    // Student feedback (claim): ODD/EVEN percentages averaged into the tier.
    if (metric.id === "student_feedback") {
      const average = feedbackAverage(feedbackClaim);
      if (average === null) {
        return { ...base, status: "untracked", points: 0, count: 0, notes: [] } as MetricScore;
      }
      const points = average >= 90 ? tierPoints(model, "gte90") : average >= 80 ? tierPoints(model, "80to90") : 0;
      const parts: string[] = [];
      if (typeof feedbackClaim?.odd === "number") parts.push(`ODD ${feedbackClaim.odd}%`);
      if (typeof feedbackClaim?.even === "number") parts.push(`EVEN ${feedbackClaim.even}%`);
      const notes = [`${parts.join(" + ")} → average ${average}% (labs excluded; auditable vs CAMU)`];
      if (parts.length === 1) notes.push("Only one semester entered so far");
      return {
        ...base,
        status: points > 0 ? "scored" : "zero",
        points,
        count: parts.length,
        notes,
      } as MetricScore;
    }

    if (metric.source === "interview") {
      const award = interviewAwards[metric.id];
      if (!award) {
        return { ...base, status: "manual", points: 0, count: 0, notes: [] } as MetricScore;
      }
      const notes = [
        award.note
          ? `Committee: ${award.note}`
          : "Awarded by the committee",
      ];
      return {
        ...base,
        status: "manual",
        points: Math.min(award.points, base.maxPointsPerInstance),
        count: 1,
        notes,
      } as MetricScore;
    }

    return {
      ...base,
      status: "untracked",
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
      tracked: AWARD_METRICS.filter((m) => m.source === "entry" || m.source === "profile").length,
      total: AWARD_METRICS.length,
    },
    strengths,
    quickWins,
  };
}
