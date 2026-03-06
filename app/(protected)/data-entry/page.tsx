import Link from "next/link";
import { getServerSession } from "next-auth";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import NotificationBadge from "@/components/ui/NotificationBadge";
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default async function DataEntryHomePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const summary = email.endsWith("@tce.edu")
    ? await getDataEntrySummary(email)
    : { ...EMPTY_DATA_ENTRY_SUMMARY };
  const unfinishedByCategory = getUnfinishedCountByCategory(summary);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Data Entry"
        subtitle="Choose a category to record faculty activities and supporting documents."
        showBack={false}
        actions={
          <Link
            href={dataEntrySearch()}
            className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted/60"
          >
            Search Entries
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {ITEMS.map((it) => {
          const count = unfinishedByCategory[it.key] ?? 0;

          return (
            <Link
              key={it.href}
              href={it.href}
              className={cx(
                "group relative rounded-2xl border border-border bg-white/70 p-5",
                "transition hover:bg-muted/40 active:bg-muted/60"
              )}
            >
              <NotificationBadge count={count} className="-right-2 -top-2" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-base font-semibold">{it.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{it.subtitle}</div>
                </div>

                <div className="shrink-0 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground group-hover:text-foreground">
                  Open →
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <SectionCard>
          <p className="text-sm text-muted-foreground">
            Add entries and upload required documents by category.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
