import Link from "next/link";

type EntryItem = {
  title: string;
  subtitle: string;
  href: string;
};

const ITEMS: EntryItem[] = [
  {
    title: "FDP — Attended",
    subtitle: "Record FDPs you attended with support amount and required supporting documents.",
    href: "/data-entry/fdp-attended",
  },
  {
    title: "FDP — Conducted",
    subtitle: "Capture FDPs conducted with coordinator details, dates, and required supporting documents.",
    href: "/data-entry/fdp-conducted",
  },
  {
    title: "Case Studies",
    subtitle: "Maintain case study records with academic context, outcomes, and supporting material.",
    href: "/data-entry/case-studies",
  },
  {
    title: "Guest Lectures",
    subtitle: "Record event details and supporting documents.",
    href: "/data-entry/guest-lectures",
  },
  {
    title: "Workshops",
    subtitle: "Record workshop details and supporting documents.",
    href: "/data-entry/workshops",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DataEntryHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Entry</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a category to record faculty activities and supporting documents.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={cx(
              "group rounded-2xl border border-border bg-white/70 dark:bg-black/20 p-5",
              "transition hover:bg-muted/40 active:bg-muted/60"
            )}
          >
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
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white/70 dark:bg-black/20 p-4 text-sm text-muted-foreground">
        Add entries and upload required documents by category.
      </div>
    </div>
  );
}
