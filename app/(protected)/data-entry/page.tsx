import Link from "next/link";
import { getServerSession } from "next-auth";
import { ChevronRight } from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { CATEGORY_LIST, getCategoryConfig } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  EMPTY_DATA_ENTRY_SUMMARY,
  getDataEntrySummary,
  getUnfinishedCountByCategory,
  type DataEntrySummary,
} from "@/lib/entries/summary";
import { dataEntrySearch, entryList } from "@/lib/entryNavigation";

type EntryItem = {
  key: keyof DataEntrySummary;
  title: string;
  subtitle: string;
  href: string;
};

const ITEMS: EntryItem[] = CATEGORY_LIST.map((categoryKey) => {
  const categoryConfig = getCategoryConfig(categoryKey);
  return {
    key: categoryConfig.summaryKey as keyof DataEntrySummary,
    title: categoryConfig.label,
    subtitle: categoryConfig.subtitle || "Record entry details and supporting documents.",
    href: entryList(categoryKey),
  };
});

export default async function DataEntryHomePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const summary = email.endsWith("@tce.edu")
    ? await getDataEntrySummary(email)
    : { ...EMPTY_DATA_ENTRY_SUMMARY };
  const unfinishedByCategory = getUnfinishedCountByCategory(summary);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader
          title="Data Entry"
          description="Choose a category to start entering data"
        />
        <Link
          href={dataEntrySearch()}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Search Entries
        </Link>
      </div>

      <div className="mt-2 grid gap-4 grid-cols-1 sm:grid-cols-2">
        {ITEMS.map((it) => {
          const count = unfinishedByCategory[it.key] ?? 0;

          return (
            <Link
              key={it.href}
              href={it.href}
              className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-900">{it.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{it.subtitle}</div>
                  {count > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      {count} {count === 1 ? "entry" : "entries"} in progress
                    </div>
                  )}
                </div>
                <ChevronRight className="mt-0.5 size-5 shrink-0 text-slate-400 transition group-hover:text-slate-600" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
