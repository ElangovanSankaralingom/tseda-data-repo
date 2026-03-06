import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import StreakSummaryCard from "@/components/gamification/StreakSummaryCard";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { authOptions } from "@/lib/auth";
import { getDashboardSummary, type DashboardPendingRow } from "@/lib/entries/summary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { signin } from "@/lib/navigation";
import { trackEvent } from "@/lib/telemetry/telemetry";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-2xl border border-border bg-white/70 p-6 transition-all duration-200 hover:scale-[1.01]", className)}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StreakCardShell({
  title,
  subtitle,
  summary,
  action,
  className,
  footer,
}: {
  title: string;
  subtitle?: string;
  summary: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <SectionCard title={title} subtitle={subtitle} className={className}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex flex-wrap items-center gap-3">{summary}</div>
          <div className="shrink-0">
            {action ? (
              action
            ) : (
              <span className="invisible inline-flex h-10 items-center justify-center px-3 text-sm">Action</span>
            )}
          </div>
        </div>
        {footer ? <div>{footer}</div> : null}
      </div>
    </SectionCard>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith("@tce.edu")) {
    redirect(signin());
  }

  void trackEvent({
    event: "page.dashboard_view",
    actorEmail: email,
    role: canAccessAdminConsole(email) ? "admin" : "user",
    meta: {
      page: "/dashboard",
    },
  });

  const summary = await getDashboardSummary(email);
  const globalWinsCount = summary.totals.streakWinsCount;
  const totalActivatedPendingCount = summary.totals.streakActivatedCount;
  const orderedPendingRows = summary.streakActivatedRows;
  const visiblePendingRows = orderedPendingRows.slice(0, 5);
  const hiddenPendingCount = Math.max(0, orderedPendingRows.length - visiblePendingRows.length);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Track pending uploads and streak wins.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StreakCardShell
          title="🔥 Streak Wins"
          subtitle="Keep the momentum alive"
          className={globalWinsCount > 0 ? "border-orange-200 bg-gradient-to-br from-orange-50/80 to-transparent" : undefined}
          summary={<StreakSummaryCard coloredCount={globalWinsCount} animateColored={globalWinsCount > 0} />}
          footer={
            totalActivatedPendingCount === 0 ? (
              <p className="text-sm text-muted-foreground">Start a task to activate your streak.</p>
            ) : null
          }
        />

        <StreakCardShell
          title="Streak Activated"
          subtitle="Active tasks by category"
          className="border-orange-300/80 shadow-[0_0_18px_rgba(249,115,22,0.08)]"
          summary={<StreakSummaryCard greyCount={totalActivatedPendingCount} animateGrey={totalActivatedPendingCount > 0} />}
          footer={
            totalActivatedPendingCount > 0 ? (
              <div className="space-y-2">
                {visiblePendingRows.map((row: DashboardPendingRow) => (
                  <div
                    key={`${row.categoryLabel}-${row.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3"
                  >
                    <div className="min-w-0 text-sm text-foreground">
                      <span className="text-muted-foreground">{row.categoryLabel}</span>
                      <span className="mx-2 text-muted-foreground">•</span>
                      <span className="font-mono text-xs text-muted-foreground">{row.tag}</span>
                    </div>
                    <span
                      className={cx(
                        "whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium",
                        row.remainingDays <= 2
                          ? "bg-red-50 text-red-700"
                          : row.remainingDays <= 5
                            ? "bg-amber-50 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {row.remainingDays} days left
                    </span>
                    <Link
                      href={row.route}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-foreground bg-foreground px-3 text-sm text-background transition-colors duration-150 hover:bg-foreground/90 hover:shadow-[0_0_16px_rgba(15,23,42,0.18)]"
                    >
                      Complete
                    </Link>
                  </div>
                ))}
                {hiddenPendingCount > 0 ? (
                  <p className="text-sm text-muted-foreground">+ {hiddenPendingCount} more active tasks</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active streaks</p>
            )
          }
        />
      </div>
    </div>
  );
}
