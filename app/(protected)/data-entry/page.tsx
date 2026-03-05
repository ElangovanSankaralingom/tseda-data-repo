import Link from "next/link";
import { getServerSession } from "next-auth";
import EntryPageHeader from "@/components/entry/EntryPageHeader";
import NotificationBadge from "@/components/ui/NotificationBadge";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  getDataEntrySummary,
  getUnfinishedCountByCategory,
  type DataEntrySummary,
} from "@/lib/entries/summary";
import { entryList } from "@/lib/navigation";
import { getDataEntryNavigation } from "@/lib/navigationStack";

type EntryItem = {
  key: keyof DataEntrySummary;
  title: string;
  subtitle: string;
  href: string;
};

const ITEMS: EntryItem[] = [
  {
    key: "fdpAttended",
    title: "FDP — Attended",
    subtitle: "Record FDPs you attended with support amount and required supporting documents.",
    href: entryList("fdp-attended"),
  },
  {
    key: "fdpConducted",
    title: "FDP — Conducted",
    subtitle: "Capture FDPs conducted with coordinator details, dates, and required supporting documents.",
    href: entryList("fdp-conducted"),
  },
  {
    key: "caseStudies",
    title: "Case Studies",
    subtitle: "Maintain case study records with academic context, outcomes, and supporting material.",
    href: entryList("case-studies"),
  },
  {
    key: "guestLectures",
    title: "Guest Lectures",
    subtitle: "Record event details and supporting documents.",
    href: entryList("guest-lectures"),
  },
  {
    key: "workshops",
    title: "Workshops",
    subtitle: "Record workshop details and supporting documents.",
    href: entryList("workshops"),
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default async function DataEntryHomePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const navigation = getDataEntryNavigation();
  const summary = email.endsWith("@tce.edu")
    ? await getDataEntrySummary(email)
    : {
        fdpAttended: { active: 0, pending: 0 },
        fdpConducted: { active: 0, pending: 0 },
        caseStudies: { active: 0, pending: 0 },
        guestLectures: { active: 0, pending: 0 },
        workshops: { active: 0, pending: 0 },
      };
  const unfinishedByCategory = getUnfinishedCountByCategory(summary);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <EntryPageHeader
        title="Data Entry"
        subtitle="Choose a category to record faculty activities and supporting documents."
        isViewMode={false}
        backHref={navigation.backHref}
        backDisabled={navigation.backDisabled}
        showBack={false}
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

      <div className="mt-6 rounded-2xl border border-border bg-white/70 p-4 text-sm text-muted-foreground">
        Add entries and upload required documents by category.
      </div>
    </div>
  );
}
