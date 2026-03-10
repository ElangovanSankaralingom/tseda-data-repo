import { caseStudiesSchema } from "@/data/schemas/case-studies";
import { fdpAttendedSchema } from "@/data/schemas/fdp-attended";
import { fdpConductedSchema } from "@/data/schemas/fdp-conducted";
import { guestLecturesSchema } from "@/data/schemas/guest-lectures";
import type { EntrySchema } from "@/data/schemas/types";
import { workshopsSchema } from "@/data/schemas/workshops";

export const CATEGORY_SLUGS = [
  "fdp-attended",
  "fdp-conducted",
  "case-studies",
  "guest-lectures",
  "workshops",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export type CategorySummaryKey =
  | "fdpAttended"
  | "fdpConducted"
  | "caseStudies"
  | "guestLectures"
  | "workshops";

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
};

export type CategoryConfig = {
  slug: CategorySlug;
  label: string;
  schemaKey: CategorySlug;
  schema: EntrySchema;
  summaryKey: CategorySummaryKey;
  supportsUploads: boolean;
  supportsConfirmation: boolean;
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
    icon: "book-open",
    color: {
      bar: "from-blue-400 to-blue-600",
      bg: "bg-blue-100",
      text: "text-blue-600",
      ring: "hover:ring-blue-200",
      cta: "text-blue-500",
      gradient: "from-blue-600 via-blue-700 to-blue-900",
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
    icon: "presentation",
    color: {
      bar: "from-emerald-400 to-emerald-600",
      bg: "bg-emerald-100",
      text: "text-emerald-600",
      ring: "hover:ring-emerald-200",
      cta: "text-emerald-500",
      gradient: "from-emerald-600 via-emerald-700 to-emerald-900",
    },
    subtitle: "Capture FDPs conducted with coordinator details, dates, and required supporting documents.",
    entryTitleField: "eventName",
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
    icon: "clipboard-list",
    color: {
      bar: "from-amber-400 to-amber-600",
      bg: "bg-amber-100",
      text: "text-amber-600",
      ring: "hover:ring-amber-200",
      cta: "text-amber-500",
      gradient: "from-amber-600 via-amber-700 to-amber-900",
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
    icon: "mic",
    color: {
      bar: "from-purple-400 to-purple-600",
      bg: "bg-purple-100",
      text: "text-purple-600",
      ring: "hover:ring-purple-200",
      cta: "text-purple-500",
      gradient: "from-purple-600 via-purple-700 to-purple-900",
    },
    subtitle: "Record event details and supporting documents.",
    entryTitleField: "eventName",
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
    icon: "hammer",
    color: {
      bar: "from-rose-400 to-rose-600",
      bg: "bg-rose-100",
      text: "text-rose-600",
      ring: "hover:ring-rose-200",
      cta: "text-rose-500",
      gradient: "from-rose-600 via-rose-700 to-rose-900",
    },
    subtitle: "Record workshop details and supporting documents.",
    entryTitleField: "eventName",
    entryTitleFallback: "Workshop",
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
