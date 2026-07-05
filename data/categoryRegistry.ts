import { booksAndChaptersSchema } from "@/data/schemas/books-and-chapters";
import { caseStudiesSchema } from "@/data/schemas/case-studies";
import { conferencesOrganizedSchema } from "@/data/schemas/conferences-organized";
import { editorialRolesSchema } from "@/data/schemas/editorial-roles";
import { patentsSchema } from "@/data/schemas/patents";
import { researchFundingSchema } from "@/data/schemas/research-funding";
import { conferencePublicationsSchema } from "@/data/schemas/conference-publications";
import { fdpAttendedSchema } from "@/data/schemas/fdp-attended";
import { fdpConductedSchema } from "@/data/schemas/fdp-conducted";
import { guestLecturesSchema } from "@/data/schemas/guest-lectures";
import { journalPublicationsSchema } from "@/data/schemas/journal-publications";
import { creativePublicationsSchema } from "@/data/schemas/creative-publications";
import { designCompetitionsSchema } from "@/data/schemas/design-competitions";
import { exhibitionsOutreachSchema } from "@/data/schemas/exhibitions-outreach";
import { mentoringProgramsSchema } from "@/data/schemas/mentoring-programs";
import { onlineCoursesSchema } from "@/data/schemas/online-courses";
import { studentPlacementsSchema } from "@/data/schemas/student-placements";
import { studioContributionsSchema } from "@/data/schemas/studio-contributions";
import type { EntrySchema } from "@/data/schemas/types";
import { workshopsSchema } from "@/data/schemas/workshops";

export const CATEGORY_SLUGS = [
  "fdp-attended",
  "fdp-conducted",
  "case-studies",
  "guest-lectures",
  "workshops",
  "journal-publications",
  "conference-publications",
  "books-and-chapters",
  "patents",
  "research-funding",
  "editorial-roles",
  "conferences-organized",
  "studio-contributions",
  "creative-publications",
  "design-competitions",
  "exhibitions-outreach",
  "online-courses",
  "mentoring-programs",
  "student-placements",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export type CategorySummaryKey =
  | "fdpAttended"
  | "fdpConducted"
  | "caseStudies"
  | "guestLectures"
  | "workshops"
  | "journalPublications"
  | "conferencePublications"
  | "booksAndChapters"
  | "patents"
  | "researchFunding"
  | "editorialRoles"
  | "conferencesOrganized"
  | "studioContributions"
  | "creativePublications"
  | "designCompetitions"
  | "exhibitionsOutreach"
  | "onlineCourses"
  | "mentoringPrograms"
  | "studentPlacements";

export type CategoryColor = {
  /** Progress bar gradient: "from-blue-400 to-blue-600" */
  bar: string;
  /** Light background: "bg-blue-100" */
  bg: string;
  /** Primary text: "text-blue-600" */
  text: string;
  /** Hover ring: "hover:ring-blue-200" */
  ring: string;
  /** CTA/link text: "text-blue-500" */
  cta: string;
  /** Hero gradient: "from-blue-600 via-blue-700 to-blue-900" */
  gradient: string;
  /** Dashboard card accent background: "bg-blue-500/10" */
  accentBg: string;
  /** Dashboard card top border: "border-t-blue-500" */
  borderTop: string;
  /** Dashboard CTA button background: "bg-blue-600" */
  buttonBg: string;
  /** Dashboard CTA button hover: "hover:bg-blue-700" */
  buttonHover: string;
  /** Raw hex for charts/graphs where Tailwind classes cannot be used */
  chartHex: string;
};

/**
 * The two entry lifecycles (2026-07):
 * - "permission": the original flow — prior-approval activities. Generate a
 *   permission-letter PDF, edit window timer, stage-2 uploads after
 *   generate, finalise/auto-finalise. Streaks: future-dated only, activated
 *   on generate, won when stage 2 completes.
 * - "record": post-facto achievements (publications, grants, patents…). No
 *   PDF, no timer. All fields + proof uploads entered together, SUBMIT
 *   locks the entry and the streak counts immediately. Corrections only via
 *   edit/delete request to the DLC/admin — re-requestable after resolution
 *   (records must stay correctable forever).
 */
export type CategoryFlow = "permission" | "record";

/**
 * Home-page clubbing (2026-07): every category belongs to a display group;
 * the dashboard's tab bar derives its tabs (and counts) from the registry,
 * so a new category — or a whole new club — appears by declaring it HERE.
 * Display names live in i18n as `dashboard.group*` keys (see GROUP_LABEL_KEYS
 * in DashboardClient).
 */
export const CATEGORY_GROUP_ORDER = ["professional", "academic", "research", "department"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUP_ORDER)[number];

/**
 * Entry scope (Elan's B2 ruling, 2026-07): who may CREATE/EDIT entries.
 *  - "faculty" (default): every faculty member enters their own activities.
 *  - "dlc": department records keyed by STUDENT reg no — visible and
 *    enterable ONLY by coordinators holding the `enterData` power for the
 *    category (assigned by the master admin on /admin/coordinators). DLC
 *    entries are record flow with NO streaks, NO feed events, NO award
 *    points — pure department data with full export support.
 */
export type CategoryEntryScope = "faculty" | "dlc";

export type CategoryConfig = {
  slug: CategorySlug;
  label: string;
  schemaKey: CategorySlug;
  schema: EntrySchema;
  summaryKey: CategorySummaryKey;
  supportsUploads: boolean;
  supportsConfirmation: boolean;
  /** Lifecycle archetype; absent = "permission" (all original categories). */
  flow?: CategoryFlow;
  /** Who enters data; absent = "faculty" (self-entered activities). */
  entryScope?: CategoryEntryScope;
  /** Home-page club this category belongs to (tab bar grouping). */
  group: CategoryGroup;
  icon: string;
  color: CategoryColor;
  subtitle?: string;
  entryTitleField?: string;
  entryTitleFallback?: string;
};

export const CATEGORY_REGISTRY: Record<CategorySlug, CategoryConfig> = {
  "fdp-attended": {
    slug: "fdp-attended",
    label: "FDP — Attended",
    schemaKey: "fdp-attended",
    schema: fdpAttendedSchema,
    summaryKey: "fdpAttended",
    supportsUploads: true,
    supportsConfirmation: true,
    group: "professional",
    icon: "book-open",
    color: {
      bar: "from-blue-400 to-blue-600",
      bg: "bg-blue-100",
      text: "text-blue-600",
      ring: "hover:ring-blue-200",
      cta: "text-blue-500",
      gradient: "from-blue-600 via-blue-700 to-blue-900",
      accentBg: "bg-blue-500/10",
      borderTop: "border-t-blue-500",
      buttonBg: "bg-blue-600",
      buttonHover: "hover:bg-blue-700",
      chartHex: "#2A48CE",
    },
    subtitle: "Record FDPs you attended with support amount and required supporting documents.",
    entryTitleField: "programName",
    entryTitleFallback: "FDP Entry",
  },
  "fdp-conducted": {
    slug: "fdp-conducted",
    label: "FDP — Conducted",
    schemaKey: "fdp-conducted",
    schema: fdpConductedSchema,
    summaryKey: "fdpConducted",
    supportsUploads: true,
    supportsConfirmation: true,
    group: "professional",
    icon: "presentation",
    color: {
      bar: "from-emerald-400 to-emerald-600",
      bg: "bg-emerald-100",
      text: "text-emerald-600",
      ring: "hover:ring-emerald-200",
      cta: "text-emerald-500",
      gradient: "from-emerald-600 via-emerald-700 to-emerald-900",
      accentBg: "bg-emerald-500/10",
      borderTop: "border-t-emerald-500",
      buttonBg: "bg-emerald-600",
      buttonHover: "hover:bg-emerald-700",
      chartHex: "#059669",
    },
    subtitle: "Capture FDPs conducted with coordinator details, dates, and required supporting documents.",
    entryTitleField: "programName",
    entryTitleFallback: "FDP Entry",
  },
  "case-studies": {
    slug: "case-studies",
    label: "Case Studies",
    schemaKey: "case-studies",
    schema: caseStudiesSchema,
    summaryKey: "caseStudies",
    supportsUploads: true,
    supportsConfirmation: true,
    group: "academic",
    icon: "clipboard-list",
    color: {
      bar: "from-amber-400 to-amber-600",
      bg: "bg-amber-100",
      text: "text-amber-600",
      ring: "hover:ring-amber-200",
      cta: "text-amber-500",
      gradient: "from-amber-600 via-amber-700 to-amber-900",
      accentBg: "bg-amber-500/10",
      borderTop: "border-t-amber-500",
      buttonBg: "bg-amber-600",
      buttonHover: "hover:bg-amber-700",
      chartHex: "#D97706",
    },
    subtitle: "Maintain case study records with academic context, outcomes, and supporting material.",
    entryTitleField: "placeOfVisit",
    entryTitleFallback: "Case Study",
  },
  "guest-lectures": {
    slug: "guest-lectures",
    label: "Guest Lectures",
    schemaKey: "guest-lectures",
    schema: guestLecturesSchema,
    summaryKey: "guestLectures",
    supportsUploads: true,
    supportsConfirmation: true,
    group: "academic",
    icon: "mic",
    color: {
      bar: "from-purple-400 to-purple-600",
      bg: "bg-purple-100",
      text: "text-purple-600",
      ring: "hover:ring-purple-200",
      cta: "text-purple-500",
      gradient: "from-purple-600 via-purple-700 to-purple-900",
      accentBg: "bg-purple-500/10",
      borderTop: "border-t-purple-500",
      buttonBg: "bg-purple-600",
      buttonHover: "hover:bg-purple-700",
      chartHex: "#9333EA",
    },
    subtitle: "Record event details and supporting documents.",
    entryTitleField: "topicOfLecture",
    entryTitleFallback: "Guest Lecture",
  },
  workshops: {
    slug: "workshops",
    label: "Workshops",
    schemaKey: "workshops",
    schema: workshopsSchema,
    summaryKey: "workshops",
    supportsUploads: true,
    supportsConfirmation: true,
    group: "academic",
    icon: "hammer",
    color: {
      bar: "from-rose-400 to-rose-600",
      bg: "bg-rose-100",
      text: "text-rose-600",
      ring: "hover:ring-rose-200",
      cta: "text-rose-500",
      gradient: "from-rose-600 via-rose-700 to-rose-900",
      accentBg: "bg-rose-500/10",
      borderTop: "border-t-rose-500",
      buttonBg: "bg-rose-600",
      buttonHover: "hover:bg-rose-700",
      chartHex: "#E11D48",
    },
    subtitle: "Record workshop details and supporting documents.",
    entryTitleField: "workshopName",
    entryTitleFallback: "Workshop",
  },
  "journal-publications": {
    slug: "journal-publications",
    label: "Journal Publications",
    schemaKey: "journal-publications",
    schema: journalPublicationsSchema,
    summaryKey: "journalPublications",
    supportsUploads: true,
    supportsConfirmation: true,
    group: "research",
    // RECORD FLOW: post-facto achievement — no permission PDF, no timer;
    // submit locks + streak counts immediately (see CategoryFlow).
    flow: "record",
    icon: "book-open",
    color: {
      bar: "from-teal-400 to-teal-600",
      bg: "bg-teal-100",
      text: "text-teal-600",
      ring: "hover:ring-teal-200",
      cta: "text-teal-500",
      gradient: "from-teal-600 via-teal-700 to-teal-900",
      accentBg: "bg-teal-500/10",
      borderTop: "border-t-teal-500",
      buttonBg: "bg-teal-600",
      buttonHover: "hover:bg-teal-700",
      chartHex: "#0D9488",
    },
    subtitle: "Record published journal papers with proofs — submitted entries count immediately.",
    entryTitleField: "paperTitle",
    entryTitleFallback: "Journal Publication",
  },
  "conference-publications": {
    slug: "conference-publications",
    label: "Conference Publications",
    schemaKey: "conference-publications",
    schema: conferencePublicationsSchema,
    summaryKey: "conferencePublications",
    supportsUploads: true,
    supportsConfirmation: true,
    // RECORD FLOW — post-facto, specially collaborative (S5 ruling).
    flow: "record",
    group: "research",
    icon: "megaphone",
    color: {
      bar: "from-sky-400 to-sky-600",
      bg: "bg-sky-100",
      text: "text-sky-600",
      ring: "hover:ring-sky-200",
      cta: "text-sky-500",
      gradient: "from-sky-600 via-sky-700 to-sky-900",
      accentBg: "bg-sky-500/10",
      borderTop: "border-t-sky-500",
      buttonBg: "bg-sky-600",
      buttonHover: "hover:bg-sky-700",
      chartHex: "#0284C7",
    },
    subtitle: "Record published conference papers with proofs — submitted entries count immediately.",
    entryTitleField: "paperTitle",
    entryTitleFallback: "Conference Publication",
  },
  "books-and-chapters": {
    slug: "books-and-chapters",
    label: "Books & Chapters",
    schemaKey: "books-and-chapters",
    schema: booksAndChaptersSchema,
    summaryKey: "booksAndChapters",
    supportsUploads: true,
    supportsConfirmation: true,
    // RECORD FLOW — post-facto, collaborative; `kind` drives book (10) vs
    // chapter (5) award metrics.
    flow: "record",
    group: "research",
    icon: "library",
    color: {
      bar: "from-indigo-400 to-indigo-600",
      bg: "bg-indigo-100",
      text: "text-indigo-600",
      ring: "hover:ring-indigo-200",
      cta: "text-indigo-500",
      gradient: "from-indigo-600 via-indigo-700 to-indigo-900",
      accentBg: "bg-indigo-500/10",
      borderTop: "border-t-indigo-500",
      buttonBg: "bg-indigo-600",
      buttonHover: "hover:bg-indigo-700",
      chartHex: "#4F46E5",
    },
    subtitle: "Record published books and book chapters with proofs — submitted entries count immediately.",
    entryTitleField: "bookTitle",
    entryTitleFallback: "Book / Chapter",
  },
  patents: {
    slug: "patents",
    label: "Patents",
    schemaKey: "patents",
    schema: patentsSchema,
    summaryKey: "patents",
    supportsUploads: true,
    supportsConfirmation: true,
    // RECORD FLOW — S6 "data enter alone"; status drives granted 10 /
    // published 5 (utility_patent metric).
    flow: "record",
    group: "research",
    icon: "badge-check",
    color: {
      bar: "from-cyan-400 to-cyan-600",
      bg: "bg-cyan-100",
      text: "text-cyan-600",
      ring: "hover:ring-cyan-200",
      cta: "text-cyan-500",
      gradient: "from-cyan-600 via-cyan-700 to-cyan-900",
      accentBg: "bg-cyan-500/10",
      borderTop: "border-t-cyan-500",
      buttonBg: "bg-cyan-600",
      buttonHover: "hover:bg-cyan-700",
      chartHex: "#0891B2",
    },
    subtitle: "Record published and granted patents with documents — submitted entries count immediately.",
    entryTitleField: "patentTitle",
    entryTitleFallback: "Patent",
  },
  "research-funding": {
    slug: "research-funding",
    label: "Research Funding",
    schemaKey: "research-funding",
    schema: researchFundingSchema,
    summaryKey: "researchFunding",
    supportsUploads: true,
    supportsConfirmation: true,
    // RECORD FLOW — S6 "data enter alone"; kind routes to rd_funding /
    // non_rd_funding, amountInr picks the tier (up to 25 points).
    flow: "record",
    group: "research",
    icon: "banknote",
    color: {
      bar: "from-lime-400 to-lime-600",
      bg: "bg-lime-100",
      text: "text-lime-600",
      ring: "hover:ring-lime-200",
      cta: "text-lime-500",
      gradient: "from-lime-600 via-lime-700 to-lime-900",
      accentBg: "bg-lime-500/10",
      borderTop: "border-t-lime-500",
      buttonBg: "bg-lime-600",
      buttonHover: "hover:bg-lime-700",
      chartHex: "#65A30D",
    },
    subtitle: "Record funded projects and consultancy with sanction orders — submitted entries count immediately.",
    entryTitleField: "projectTitle",
    entryTitleFallback: "Funded Project",
  },
  "editorial-roles": {
    slug: "editorial-roles",
    label: "Editorial Roles",
    schemaKey: "editorial-roles",
    schema: editorialRolesSchema,
    summaryKey: "editorialRoles",
    supportsUploads: true,
    supportsConfirmation: true,
    // RECORD FLOW — individual recognition (no fan-out); Editor / Associate
    // Editor roles score the fixed editorial_role points.
    flow: "record",
    group: "research",
    icon: "pen-line",
    color: {
      bar: "from-fuchsia-400 to-fuchsia-600",
      bg: "bg-fuchsia-100",
      text: "text-fuchsia-600",
      ring: "hover:ring-fuchsia-200",
      cta: "text-fuchsia-500",
      gradient: "from-fuchsia-600 via-fuchsia-700 to-fuchsia-900",
      accentBg: "bg-fuchsia-500/10",
      borderTop: "border-t-fuchsia-500",
      buttonBg: "bg-fuchsia-600",
      buttonHover: "hover:bg-fuchsia-700",
      chartHex: "#C026D3",
    },
    subtitle: "Record editor, board, and reviewer roles with appointment proofs — submitted entries count immediately.",
    entryTitleField: "journalName",
    entryTitleFallback: "Editorial Role",
  },
  "conferences-organized": {
    slug: "conferences-organized",
    label: "Conferences Organized",
    schemaKey: "conferences-organized",
    schema: conferencesOrganizedSchema,
    summaryKey: "conferencesOrganized",
    supportsUploads: true,
    supportsConfirmation: true,
    // PERMISSION FLOW (S7 ruling): organizing needs prior approval — letter,
    // timer, stage-2 proofs, finalise. Role drives the 50/30/20 award share.
    group: "academic",
    icon: "calendar-days",
    color: {
      bar: "from-violet-400 to-violet-600",
      bg: "bg-violet-100",
      text: "text-violet-600",
      ring: "hover:ring-violet-200",
      cta: "text-violet-500",
      gradient: "from-violet-600 via-violet-700 to-violet-900",
      accentBg: "bg-violet-500/10",
      borderTop: "border-t-violet-500",
      buttonBg: "bg-violet-600",
      buttonHover: "hover:bg-violet-700",
      chartHex: "#7C3AED",
    },
    subtitle: "Plan and record conferences, seminars, and symposia you organize — permission letter first, proofs after.",
    entryTitleField: "conferenceTitle",
    entryTitleFallback: "Conference",
  },
  "studio-contributions": {
    slug: "studio-contributions",
    label: "Studio Contributions",
    schemaKey: "studio-contributions",
    schema: studioContributionsSchema,
    summaryKey: "studioContributions",
    supportsUploads: true,
    supportsConfirmation: true,
    // RECORD FLOW (S1 ruling): descriptive box + proof per studio event.
    // Open reviews / exhibitions auto-score; documentation and beyond-
    // syllabus entries are the committee's interview evidence base.
    flow: "record",
    group: "academic",
    icon: "palette",
    color: {
      bar: "from-orange-400 to-orange-600",
      bg: "bg-orange-100",
      text: "text-orange-600",
      ring: "hover:ring-orange-200",
      cta: "text-orange-500",
      gradient: "from-orange-600 via-orange-700 to-orange-900",
      accentBg: "bg-orange-500/10",
      borderTop: "border-t-orange-500",
      buttonBg: "bg-orange-600",
      buttonHover: "hover:bg-orange-700",
      chartHex: "#EA580C",
    },
    subtitle: "Describe studio events — open reviews, exhibitions, documentation, beyond-syllabus work — with proof.",
    entryTitleField: "activityTitle",
    entryTitleFallback: "Studio Contribution",
  },
  "creative-publications": {
    slug: "creative-publications",
    label: "Creative Publications",
    schemaKey: "creative-publications",
    schema: creativePublicationsSchema,
    summaryKey: "creativePublications",
    supportsUploads: true,
    supportsConfirmation: true,
    // RECORD FLOW (roadmap #11): essays, critiques, visual narratives in
    // design platforms/magazines — individual, 5 points per unit.
    flow: "record",
    group: "research",
    icon: "brush",
    color: {
      bar: "from-pink-400 to-pink-600",
      bg: "bg-pink-100",
      text: "text-pink-600",
      ring: "hover:ring-pink-200",
      cta: "text-pink-500",
      gradient: "from-pink-600 via-pink-700 to-pink-900",
      accentBg: "bg-pink-500/10",
      borderTop: "border-t-pink-500",
      buttonBg: "bg-pink-600",
      buttonHover: "hover:bg-pink-700",
      chartHex: "#DB2777",
    },
    subtitle: "Record essays, critiques, and visual narratives published in design platforms and magazines.",
    entryTitleField: "workTitle",
    entryTitleFallback: "Creative Publication",
  },
  "design-competitions": {
    slug: "design-competitions",
    label: "Design Competitions",
    schemaKey: "design-competitions",
    schema: designCompetitionsSchema,
    summaryKey: "designCompetitions",
    supportsUploads: true,
    supportsConfirmation: true,
    // PERMISSION FLOW (S4 ruling): participation needs prior approval.
    // Result (Award / Participation) is stage 2 — known only afterwards.
    group: "academic",
    icon: "trophy",
    color: {
      bar: "from-yellow-400 to-yellow-600",
      bg: "bg-yellow-100",
      text: "text-yellow-600",
      ring: "hover:ring-yellow-200",
      cta: "text-yellow-500",
      gradient: "from-yellow-600 via-yellow-700 to-yellow-900",
      accentBg: "bg-yellow-500/10",
      borderTop: "border-t-yellow-500",
      buttonBg: "bg-yellow-600",
      buttonHover: "hover:bg-yellow-700",
      chartHex: "#CA8A04",
    },
    subtitle: "Plan competition participation — permission letter first, certificate and result after.",
    entryTitleField: "competitionName",
    entryTitleFallback: "Design Competition",
  },
  "exhibitions-outreach": {
    slug: "exhibitions-outreach",
    label: "Exhibitions & Outreach",
    schemaKey: "exhibitions-outreach",
    schema: exhibitionsOutreachSchema,
    summaryKey: "exhibitionsOutreach",
    supportsUploads: true,
    supportsConfirmation: true,
    // PERMISSION FLOW (S4 ruling): public-facing events beyond academics
    // need prior approval. Feeds public_exhibition 2/unit, capped at 4.
    group: "academic",
    icon: "landmark",
    color: {
      bar: "from-green-400 to-green-600",
      bg: "bg-green-100",
      text: "text-green-600",
      ring: "hover:ring-green-200",
      cta: "text-green-500",
      gradient: "from-green-600 via-green-700 to-green-900",
      accentBg: "bg-green-500/10",
      borderTop: "border-t-green-500",
      buttonBg: "bg-green-600",
      buttonHover: "hover:bg-green-700",
      chartHex: "#16A34A",
    },
    subtitle: "Plan public exhibitions and community outreach — permission letter first, documentation after.",
    entryTitleField: "eventName",
    entryTitleFallback: "Exhibition / Outreach",
  },
  "online-courses": {
    slug: "online-courses",
    label: "Online Courses",
    schemaKey: "online-courses",
    schema: onlineCoursesSchema,
    summaryKey: "onlineCourses",
    supportsUploads: true,
    supportsConfirmation: true,
    // PERMISSION FLOW (S3 ruling): course development needs prior,
    // Dean-signed approval. courseKind routes tce_online_course (weeks
    // tier) vs industry_supported_course (credits tier).
    group: "professional",
    icon: "monitor-play",
    color: {
      bar: "from-red-400 to-red-600",
      bg: "bg-red-100",
      text: "text-red-600",
      ring: "hover:ring-red-200",
      cta: "text-red-500",
      gradient: "from-red-600 via-red-700 to-red-900",
      accentBg: "bg-red-500/10",
      borderTop: "border-t-red-500",
      buttonBg: "bg-red-600",
      buttonHover: "hover:bg-red-700",
      chartHex: "#DC2626",
    },
    subtitle: "Plan TCE-online and industry-supported course development — Dean-signed approval first, proofs after.",
    entryTitleField: "courseName",
    entryTitleFallback: "Online Course",
  },
  "mentoring-programs": {
    slug: "mentoring-programs",
    label: "Mentoring Programs",
    schemaKey: "mentoring-programs",
    schema: mentoringProgramsSchema,
    summaryKey: "mentoringPrograms",
    supportsUploads: true,
    supportsConfirmation: true,
    // PERMISSION FLOW (S3 ruling): fast/slow-learner programmes need prior
    // approval. Feeds fast_slow_learners fixed 5 (once per year).
    group: "academic",
    icon: "users-round",
    color: {
      bar: "from-stone-400 to-stone-600",
      bg: "bg-stone-100",
      text: "text-stone-600",
      ring: "hover:ring-stone-200",
      cta: "text-stone-500",
      gradient: "from-stone-600 via-stone-700 to-stone-900",
      accentBg: "bg-stone-500/10",
      borderTop: "border-t-stone-500",
      buttonBg: "bg-stone-600",
      buttonHover: "hover:bg-stone-700",
      chartHex: "#57534E",
    },
    subtitle: "Plan fast/slow-learner mentoring programmes — permission letter first, outcome proofs after.",
    entryTitleField: "programName",
    entryTitleFallback: "Mentoring Program",
  },
  "student-placements": {
    slug: "student-placements",
    label: "Student Placements",
    schemaKey: "student-placements",
    schema: studentPlacementsSchema,
    summaryKey: "studentPlacements",
    supportsUploads: true,
    supportsConfirmation: true,
    // DLC-SCOPED department records (B2 ruling): record flow, entered only
    // by coordinators holding the enterData power; no streaks/feed/points.
    flow: "record",
    entryScope: "dlc",
    group: "department",
    icon: "graduation-cap",
    color: {
      bar: "from-zinc-400 to-zinc-600",
      bg: "bg-zinc-100",
      text: "text-zinc-600",
      ring: "hover:ring-zinc-200",
      cta: "text-zinc-500",
      gradient: "from-zinc-600 via-zinc-700 to-zinc-900",
      accentBg: "bg-zinc-500/10",
      borderTop: "border-t-zinc-500",
      buttonBg: "bg-zinc-600",
      buttonHover: "hover:bg-zinc-700",
      chartHex: "#52525B",
    },
    subtitle: "Department placement records keyed by register number — entered by the assigned placement DLC.",
    entryTitleField: "studentName",
    entryTitleFallback: "Placement Record",
  },
};

export const CATEGORY_LIST = CATEGORY_SLUGS as readonly CategorySlug[];

export function isValidCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}

export function getCategoryConfig(slug: string): CategoryConfig {
  const normalized = slug.trim() as CategorySlug;
  if (!isValidCategorySlug(normalized)) {
    throw new Error(`Unsupported category: ${slug}`);
  }
  return CATEGORY_REGISTRY[normalized];
}

export function getCategorySchema(slug: string): EntrySchema {
  return getCategoryConfig(slug).schema;
}

/** Lifecycle archetype of a category — see CategoryFlow. Single source of
 *  truth consumed by the workflow engine, commit path, streak rules, upload
 *  gating, and the entry UI. */
export function getCategoryFlow(slug: string): CategoryFlow {
  return getCategoryConfig(slug).flow ?? "permission";
}

export function getCategoryEntryScope(slug: string): CategoryEntryScope {
  return getCategoryConfig(slug).entryScope ?? "faculty";
}

/** Slugs of dlc-scoped categories (home-page gating + route guards). */
export function listDlcScopedSlugs(): CategorySlug[] {
  return CATEGORY_LIST.filter((slug) => getCategoryEntryScope(slug) === "dlc");
}

export function getCategoryLabel(slug: string): string {
  return getCategoryConfig(slug).label;
}

export function getCategoryTitle(entry: Record<string, unknown>, slug: string): string {
  const config = getCategoryConfig(slug);
  const titleFieldValue = config.entryTitleField
    ? String(entry[config.entryTitleField] ?? "").trim()
    : "";
  return titleFieldValue || config.entryTitleFallback || config.label;
}

