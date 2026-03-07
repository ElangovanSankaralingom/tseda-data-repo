import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Mic,
  Presentation,
  Wrench,
} from "lucide-react";
import { CATEGORY_LIST, getCategoryConfig, type CategorySlug } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  EMPTY_DATA_ENTRY_SUMMARY,
  getDataEntrySummary,
  getUnfinishedCountByCategory,
  type DataEntrySummary,
} from "@/lib/entries/summary";
import { entryList } from "@/lib/entryNavigation";

const CATEGORY_ICONS: Record<CategorySlug, typeof BookOpen> = {
  "fdp-attended": BookOpen,
  "fdp-conducted": Presentation,
  "case-studies": FileText,
  "guest-lectures": Mic,
  workshops: Wrench,
};

const ACCENT_COLORS: Record<CategorySlug, { strip: string; badge: string }> = {
  "fdp-attended": { strip: "bg-blue-500", badge: "bg-blue-500" },
  "fdp-conducted": { strip: "bg-emerald-500", badge: "bg-emerald-500" },
  "case-studies": { strip: "bg-amber-500", badge: "bg-amber-500" },
  "guest-lectures": { strip: "bg-purple-500", badge: "bg-purple-500" },
  workshops: { strip: "bg-rose-500", badge: "bg-rose-500" },
};

type EntryItem = {
  key: keyof DataEntrySummary;
  slug: CategorySlug;
  title: string;
  subtitle: string;
  href: string;
};

const ITEMS: EntryItem[] = CATEGORY_LIST.map((categoryKey) => {
  const categoryConfig = getCategoryConfig(categoryKey);
  return {
    key: categoryConfig.summaryKey as keyof DataEntrySummary,
    slug: categoryKey,
    title: categoryConfig.label,
    subtitle: categoryConfig.subtitle || "Record entry details and supporting documents.",
    href: entryList(categoryKey),
  };
});

function toSafeCount(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export default async function DataEntryHomePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const summary = email.endsWith("@tce.edu")
    ? await getDataEntrySummary(email)
    : { ...EMPTY_DATA_ENTRY_SUMMARY };
  const unfinishedByCategory = getUnfinishedCountByCategory(summary);

  const totalEntries = ITEMS.reduce((sum, it) => {
    const catSummary = summary[it.key];
    return sum + toSafeCount(typeof catSummary === "object" && catSummary !== null && "totalEntries" in catSummary ? (catSummary as { totalEntries: number }).totalEntries : 0);
  }, 0);
  const totalDrafts = ITEMS.reduce((sum, it) => sum + (unfinishedByCategory[it.key] ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Gradient Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 mb-6">
        <h1 className="text-2xl font-bold text-white">Data Entry</h1>
        <p className="mt-1 text-sm text-slate-300">Choose a category to start entering data</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {totalEntries > 0 && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
              {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
            </span>
          )}
          {totalDrafts > 0 && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-200">
              {totalDrafts} in progress
            </span>
          )}
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {ITEMS.map((it) => {
          const count = unfinishedByCategory[it.key] ?? 0;
          const Icon = CATEGORY_ICONS[it.slug];
          const accent = ACCENT_COLORS[it.slug];
          const catSummary = summary[it.key];
          const entryCount = toSafeCount(typeof catSummary === "object" && catSummary !== null && "totalEntries" in catSummary ? (catSummary as { totalEntries: number }).totalEntries : 0);

          return (
            <Link
              key={it.href}
              href={it.href}
              className="group relative flex overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-slate-300"
            >
              {/* Left accent strip */}
              <div className={`w-1 shrink-0 transition-all duration-200 group-hover:w-1.5 ${accent.strip}`} />

              <div className="flex flex-1 items-start gap-4 p-5">
                {/* Icon */}
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-slate-200">
                  <Icon className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-slate-900">{it.title}</div>
                  <div className="mt-0.5 text-sm text-slate-500 line-clamp-1">{it.subtitle}</div>
                  {entryCount > 0 && (
                    <div className="mt-1.5 text-xs text-slate-400">
                      {entryCount} {entryCount === 1 ? "entry" : "entries"}
                    </div>
                  )}
                </div>

                <ChevronRight className="mt-1 size-5 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-slate-500" />
              </div>

              {/* Draft count badge — iPhone-style notch */}
              {count > 0 && (
                <span className={`absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white shadow-sm bg-amber-500`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
