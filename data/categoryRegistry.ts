import { caseStudiesSchema } from "@/data/schemas/case-studies";
import { conferencePublicationsSchema } from "@/data/schemas/conference-publications";
import { fdpAttendedSchema } from "@/data/schemas/fdp-attended";
import { fdpConductedSchema } from "@/data/schemas/fdp-conducted";
import { guestLecturesSchema } from "@/data/schemas/guest-lectures";
import { journalPublicationsSchema } from "@/data/schemas/journal-publications";
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
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export type CategorySummaryKey =
  | "fdpAttended"
  | "fdpConducted"
  | "caseStudies"
  | "guestLectures"
  | "workshops"
  | "journalPublications"
  | "conferencePublications";

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
export const CATEGORY_GROUP_ORDER = ["professional", "academic", "research"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUP_ORDER)[number];

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

