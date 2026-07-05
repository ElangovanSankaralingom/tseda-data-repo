import type { CategorySlug } from "@/data/categoryRegistry";

/**
 * FACULTY AWARD METRICS — registry-as-data (single source of truth).
 *
 * Encodes the "Proposed Faculty Award Metrics (2025) for T'SEDA" (11 Feb
 * 2026, COA/NAAC-aligned) — seven sections. Point values here are the
 * DOCUMENT DEFAULTS; live values come from the admin-adjustable overrides in
 * `lib/awards/config.ts` (same defaults-in-code + stored-overrides pattern as
 * the faculty registry). NOTHING outside this file may hardcode a point
 * value.
 *
 * `source` classifies how a metric is scored:
 *  - "entry"     → auto-derived from committed TSEDA entries (wired via
 *                  `categories` + a deriver in lib/awards/scoring.ts)
 *  - "profile"   → auto-derived from the faculty's profile (Research section
 *                  — Ph.D. milestones; deriver reads the research profile)
 *  - "claim"     → needs a future entry category (see docs/AWARDS-ROADMAP.md);
 *                  shows as "not yet tracked" until built
 *  - "interview" → awarded by the department (interview/committee), entered
 *                  by admin — future admin surface
 *
 * `effort` powers the "easily accomplished" suggestions on the dashboard.
 */

export type AwardSectionId = "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7";

export type AwardTier = {
  key: string;
  label: string;
  points: number;
};

export type AwardPointsModel =
  | { kind: "fixed"; points: number; maxPoints?: number }
  | { kind: "tiered"; tiers: readonly AwardTier[] }
  | { kind: "perUnit"; points: number; maxPoints?: number };

export type AwardSourceType = "entry" | "profile" | "claim" | "interview";

export type AwardMetricDefinition = {
  /** Stable id — used by config overrides, scoring, and the appraisal report. */
  id: string;
  section: AwardSectionId;
  label: string;
  details?: string;
  source: AwardSourceType;
  /** For source:"entry" — which TSEDA categories feed this metric. */
  categories?: readonly CategorySlug[];
  /** How reachable this is for a typical faculty member (dashboard quick wins). */
  effort: "low" | "medium" | "high";
  pointsModel: AwardPointsModel;
  proofs: readonly string[];
  /** Sharing note (conference organizing: 50/30/20% by role), display-only for now. */
  sharingNote?: string;
};

export const AWARD_SECTIONS: Record<AwardSectionId, { order: number; label: string }> = {
  s1: { order: 1, label: "Studio-Based Teaching and Course Innovation" },
  s2: { order: 2, label: "Collaborative Teaching and External Engagement" },
  s3: { order: 3, label: "Teaching Effectiveness and Student Development" },
  s4: { order: 4, label: "Design-Based Research and Creative Outputs" },
  s5: { order: 5, label: "Scholarly Publications and Research Output" },
  s6: { order: 6, label: "Grants, Consultancy, and Practice-Led Research" },
  s7: { order: 7, label: "Recognition, Mentorship, and Professional Contributions" },
};

export const AWARD_METRICS: readonly AwardMetricDefinition[] = [
  // ── Section 1: Studio-Based Teaching and Course Innovation ────────────────
  {
    id: "studio_focus_achievement",
    section: "s1",
    label: "Achievement of Studio Focus Area",
    details: "Achievement of the focus stated in syllabus/course plan and evaluation rubrics.",
    source: "interview",
    effort: "medium",
    pointsModel: { kind: "fixed", points: 5 },
    proofs: ["Studio Outcome and Documentation Report"],
  },
  {
    id: "studio_documentation",
    section: "s1",
    label: "Studio Documentation and Curation",
    details: "Systematic curation of student progress and reflections.",
    source: "interview",
    effort: "low",
    pointsModel: { kind: "fixed", points: 3 },
    proofs: ["Studio Outcome and Documentation Report"],
  },
  {
    id: "open_reviews_exhibitions",
    section: "s1",
    label: "Open Reviews and Exhibitions",
    details: "Mid/final juries involving external experts and displays of student work.",
    source: "entry",
    categories: ["studio-contributions"],
    effort: "low",
    pointsModel: { kind: "perUnit", points: 1, maxPoints: 3 },
    proofs: ["Invitations", "Exhibition Proof"],
  },
  {
    id: "beyond_syllabus",
    section: "s1",
    label: "Exploration Beyond Syllabus",
    details: "Integration of SDGs, climate, community, computational tools.",
    source: "interview",
    effort: "medium",
    pointsModel: { kind: "fixed", points: 5 },
    proofs: ["Studio documentation showing exploration"],
  },

  // ── Section 2: Collaborative Teaching and External Engagement ─────────────
  {
    id: "collab_workshop",
    section: "s2",
    label: "Collaborative Workshops (Industry Experts / Reputed Institutions)",
    details:
      "Min 6 hrs — workshops with practicing architects/professionals or faculty from Top 100 NIRF / Top 500 QS institutions (CEPT, SPA, IITs, NITs, international design schools).",
    source: "entry",
    categories: ["workshops"],
    effort: "medium",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "india", label: "India", points: 4 },
        { key: "international", label: "Abroad", points: 8 },
      ],
    },
    proofs: [
      "Course plan indicating collaborative teaching",
      "Proofs of class taken",
      "Permission letter from Principal / remuneration proof",
      "NIRF/QS rank proof (for institutional collaborations)",
    ],
  },
  {
    id: "collab_guest_lecture",
    section: "s2",
    label: "Guest Lectures (Industry Experts / Reputed Institutions)",
    source: "entry",
    categories: ["guest-lectures"],
    effort: "low",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "india", label: "India", points: 1 },
        { key: "international", label: "Abroad", points: 2 },
      ],
    },
    proofs: [
      "Course plan indicating collaborative teaching",
      "Proofs of class taken",
      "Permission letter from Principal / remuneration proof",
    ],
  },

  // ── Section 3: Teaching Effectiveness and Student Development ─────────────
  {
    id: "student_feedback",
    section: "s3",
    label: "Student Feedback (averaged over odd + even semesters, excluding labs)",
    source: "claim",
    effort: "medium",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "gte90", label: "≥ 90%", points: 10 },
        { key: "80to90", label: "80–90%", points: 5 },
      ],
    },
    proofs: ["Feedback screenshot from software", "Letter with average marks signed by HoD"],
  },
  {
    id: "fast_slow_learners",
    section: "s3",
    label: "Mentoring of Fast / Slow Learners",
    details:
      "Fast: research-practice courses, hackathon winners, patents with students. Slow: non-remunerative special classes with arrear-clearing proof.",
    source: "claim",
    effort: "medium",
    pointsModel: { kind: "fixed", points: 5 },
    proofs: ["Mentor proof / winner certificates", "Special class schedule + arrear clearance proof"],
  },
  {
    id: "industry_supported_course",
    section: "s3",
    label: "Industry-Supported Course Development",
    source: "claim",
    effort: "medium",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "one_credit", label: "One Credit", points: 4 },
        { key: "two_credits", label: "Two Credits", points: 8 },
      ],
    },
    proofs: ["Syllabus copy with expert + faculty names", "Course offering proof signed by Dean (III)"],
  },
  {
    id: "tce_online_course",
    section: "s3",
    label: "TCE Online Course Development (new or rerun)",
    source: "claim",
    effort: "high",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "w4", label: "4 weeks", points: 10 },
        { key: "w8", label: "8 weeks", points: 15 },
        { key: "w12", label: "12 weeks", points: 20 },
      ],
    },
    proofs: [
      "Canvas page / enrollment page with date",
      "Course offering proof signed by Dean (A&A)",
      "Completion proof of course development signed by Dean (A&A)",
    ],
  },

  // ── Section 4: Design-Based Research and Creative Outputs ─────────────────
  {
    id: "design_competition",
    section: "s4",
    label: "Design Competitions (apart from NASA)",
    details: "Recognized entries or awards at National / International levels.",
    source: "entry",
    categories: ["design-competitions"],
    effort: "medium",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "award", label: "Recognized entry / award", points: 5 },
        { key: "participation", label: "Participation", points: 2 },
      ],
    },
    proofs: ["Certificate / Competition proof"],
  },
  {
    id: "public_exhibition",
    section: "s4",
    label: "Public Exhibitions / Outreach (beyond academics)",
    source: "claim",
    effort: "low",
    pointsModel: { kind: "perUnit", points: 2, maxPoints: 4 },
    proofs: ["Catalogue / Documentation"],
  },

  // ── Section 5: Scholarly Publications and Research Output ─────────────────
  {
    id: "journal_publication",
    section: "s5",
    label: "Journal Publications (refereed, ISSN)",
    details:
      "Published journal papers (mirrors TCE form T7 / dept R&D–Journals sheet). " +
      "AUTO-TRACKED from the journal-publications category; default 5/unit, admin-adjustable.",
    source: "entry",
    categories: ["journal-publications"],
    effort: "high",
    pointsModel: { kind: "perUnit", points: 5 },
    proofs: ["First page of the paper", "Indexing / listing proof"],
  },
  {
    id: "creative_publication",
    section: "s5",
    label: "Creative Publications and Writing",
    details: "Essays, critiques, visual narratives in reputed design platforms/magazines.",
    source: "entry",
    categories: ["creative-publications"],
    effort: "low",
    pointsModel: { kind: "perUnit", points: 5 },
    proofs: ["Copy / ISSN proof"],
  },
  {
    id: "conference_publication",
    section: "s5",
    label: "Conference Publications (Scopus-indexed / reputed forums)",
    details:
      "First four authors can claim; accepted/presented-only papers not considered. " +
      "AUTO-TRACKED from the conference-publications category.",
    source: "entry",
    categories: ["conference-publications"],
    effort: "medium",
    pointsModel: { kind: "perUnit", points: 5 },
    proofs: ["Publication with clear date", "Scopus index proof"],
  },
  {
    id: "book_publication",
    section: "s5",
    label: "Publication of Book (ISBN, reputed publisher)",
    details: "AUTO-TRACKED from books-and-chapters entries with kind = Book.",
    source: "entry",
    categories: ["books-and-chapters"],
    effort: "high",
    pointsModel: { kind: "perUnit", points: 10 },
    proofs: ["Publication proof with date", "ISBN"],
  },
  {
    id: "book_chapter",
    section: "s5",
    label: "Contributed Chapters / Book Editor (ISBN)",
    details: "AUTO-TRACKED from books-and-chapters entries with kind = Chapter.",
    source: "entry",
    categories: ["books-and-chapters"],
    effort: "medium",
    pointsModel: { kind: "perUnit", points: 5 },
    proofs: ["Publication proof with date", "ISBN"],
  },
  {
    id: "editorial_role",
    section: "s5",
    label: "Editor / Associate Editor in Journals",
    details:
      "AUTO-TRACKED from editorial-roles entries with role Editor / Associate " +
      "Editor (fixed points, awarded once per year; board/reviewer roles are " +
      "recorded but not points-eligible).",
    source: "entry",
    categories: ["editorial-roles"],
    effort: "low",
    pointsModel: { kind: "fixed", points: 6 },
    proofs: ["Proof with clear date"],
  },
  {
    id: "utility_patent",
    details: "AUTO-TRACKED from patents entries; the status field picks the tier.",
    categories: ["patents"],
    section: "s5",
    label: "Utility Patents",
    source: "entry",
    effort: "high",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "granted", label: "Granted", points: 10 },
        { key: "published", label: "Published", points: 5 },
      ],
    },
    proofs: ["Patent proof with inventors' names"],
  },

  // ── Section 6: Grants, Consultancy, and Practice-Led Research ─────────────
  {
    id: "rd_funding",
    categories: ["research-funding"],
    section: "s6",
    label: "Funded / Sponsored R&D Projects",
    details:
      "Seed money not considered. AUTO-TRACKED from research-funding entries " +
      "with kind = R&D; amountInr picks the tier.",
    source: "entry",
    effort: "high",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "lt5", label: "< ₹5L", points: 5 },
        { key: "5to10", label: "₹5–10L", points: 10 },
        { key: "10to20", label: "₹10–20L", points: 15 },
        { key: "20to50", label: "₹20–50L", points: 20 },
        { key: "gte50", label: "≥ ₹50L", points: 25 },
      ],
    },
    proofs: ["Sanction proof with date and claiming faculty name"],
  },
  {
    id: "non_rd_funding",
    categories: ["research-funding"],
    section: "s6",
    label: "Funding from Govt./Agencies (non-R&D)",
    details:
      "Must not be claimed under any other category. AUTO-TRACKED from " +
      "research-funding entries with kind = Consultancy/Other; amountInr picks the tier.",
    source: "entry",
    effort: "medium",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "lt2_5", label: "< ₹2.5L", points: 3 },
        { key: "gte2_5", label: "≥ ₹2.5L", points: 5 },
      ],
    },
    proofs: ["Sanction proof with date and claiming faculty name"],
  },

  // ── Section 7: Recognition, Mentorship, and Professional Contributions ────
  {
    id: "phd_awarded",
    section: "s7",
    label: "Ph.D. Awarded to Faculty",
    details:
      "Only viva date considered. AUTO-TRACKED from the profile's Research " +
      "section (own Ph.D., status Awarded, viva date in the scored year).",
    source: "profile",
    effort: "high",
    pointsModel: { kind: "fixed", points: 15 },
    proofs: ["Proof with viva date"],
  },
  {
    id: "phd_guided",
    section: "s7",
    label: "Ph.D. Guided by the Supervisor",
    details:
      "Only viva date considered. AUTO-TRACKED from the profile's Research " +
      "section (guided scholars whose viva date falls in the scored year).",
    source: "profile",
    effort: "high",
    pointsModel: { kind: "perUnit", points: 12 },
    proofs: ["Proof with viva date"],
  },
  {
    id: "intl_conference_organized",
    section: "s7",
    label: "International Conferences/Seminars/Symposia Organized",
    details: "AUTO-TRACKED from conferences-organized entries (level = International); the role field applies the share.",
    source: "entry",
    categories: ["conferences-organized"],
    effort: "high",
    pointsModel: { kind: "fixed", points: 20 },
    sharingNote:
      "Shared: coordinators/co-coordinators 50%, committee lead/head 30%, members 20% of the points each.",
    proofs: ["Event proof with date and claiming faculty", "Organizing committee composition proof"],
  },
  {
    id: "natl_conference_organized",
    section: "s7",
    label: "National Conferences/Seminars/Symposia Organized",
    details: "AUTO-TRACKED from conferences-organized entries (level = National); the role field applies the share.",
    source: "entry",
    categories: ["conferences-organized"],
    effort: "medium",
    pointsModel: { kind: "fixed", points: 12 },
    sharingNote:
      "Shared among the organizing team: coordinators 50%, lead 30%, members 20% of the points each.",
    proofs: ["Event proof with date and claiming faculty", "Organizing committee composition proof"],
  },
  {
    id: "fdp_conducted",
    section: "s7",
    label: "FDPs / Workshops / Training Programmes Conducted",
    details:
      "Shared among coordinators who do not receive coordination charges; requires > 20 outside participants.",
    source: "entry",
    categories: ["fdp-conducted"],
    effort: "medium",
    pointsModel: {
      kind: "tiered",
      tiers: [
        { key: "short", label: "≤ 5 days (> 20 outside participants)", points: 8 },
        { key: "long", label: "> 5 days (> 20 outside participants)", points: 12 },
      ],
    },
    proofs: [
      "Event proof with date and claiming faculty",
      "Attendance sheet with participants' affiliations",
      "Organizing team composition proof",
    ],
  },
] as const;

// ── Lookup helpers ──────────────────────────────────────────────────────────

const BY_ID = new Map(AWARD_METRICS.map((m) => [m.id, m]));

export function getAwardMetric(id: string): AwardMetricDefinition | null {
  return BY_ID.get(id) ?? null;
}

export function listAwardMetricsBySection(): Array<{
  section: AwardSectionId;
  label: string;
  metrics: AwardMetricDefinition[];
}> {
  return (Object.keys(AWARD_SECTIONS) as AwardSectionId[])
    .sort((a, b) => AWARD_SECTIONS[a].order - AWARD_SECTIONS[b].order)
    .map((section) => ({
      section,
      label: AWARD_SECTIONS[section].label,
      metrics: AWARD_METRICS.filter((m) => m.section === section),
    }));
}

/** Maximum points a single instance of a metric can currently yield (for gap hints). */
export function maxPointsOf(model: AwardPointsModel): number {
  if (model.kind === "fixed") return model.points;
  if (model.kind === "perUnit") return model.maxPoints ?? model.points;
  return Math.max(...model.tiers.map((t) => t.points));
}
