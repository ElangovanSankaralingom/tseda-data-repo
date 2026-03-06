import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import MetricCard from "@/components/layout/MetricCard";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import EntryStatusBadge from "@/components/entry/EntryStatusBadge";
import { CATEGORY_LIST, getCategoryConfig } from "@/data/categoryRegistry";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { authOptions } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/entries/summary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, entryList, signin } from "@/lib/entryNavigation";
import { trackEvent } from "@/lib/telemetry/telemetry";

function toSafeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "-";
  return new Date(parsed).toLocaleString();
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith("@tce.edu")) {
    redirect(signin());
  }

  const canAccessAdmin = canAccessAdminConsole(email);
  void trackEvent({
    event: "page.dashboard_view",
    actorEmail: email,
    role: canAccessAdmin ? "admin" : "user",
    meta: {
      page: "/dashboard",
    },
  });

  const summary = await getDashboardSummary(email);
  const userName = session?.user?.name?.trim() || email;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${userName}`}
        subtitle="Track your current data-entry progress and continue from recent work."
        actions={
          canAccessAdmin ? (
            <Link
              href={adminHome()}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted/60"
            >
              Open Admin Console
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Streak Activated"
          value={toSafeCount(summary.totals.streakActivatedCount)}
          hint="Display-only motivation metric"
        />
        <MetricCard label="Draft Entries" value={toSafeCount(summary.totals.draftCount)} />
        <MetricCard
          label="Pending Confirmation"
          value={toSafeCount(summary.totals.pendingConfirmationCount)}
          tone="warning"
        />
        <MetricCard
          label="Approved Entries"
          value={toSafeCount(summary.totals.approvedCount)}
          tone="success"
        />
        <MetricCard
          label="Rejected Entries"
          value={toSafeCount(summary.totals.rejectedCount)}
          tone="danger"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent Entries" subtitle="Most recently updated records">
          {summary.recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.recentEntries.map((row) => (
                <Link
                  key={`${row.categoryKey}:${row.id}`}
                  href={row.route}
                  className="block rounded-xl border border-border p-3 transition hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{row.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.categoryLabel}</div>
                    </div>
                    <EntryStatusBadge status={row.status} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Updated: {formatUpdatedAt(row.updatedAtISO)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Quick Actions"
          subtitle="Open a category and continue data entry"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORY_LIST.map((category) => (
              <Link
                key={category}
                href={entryList(category)}
                className="rounded-xl border border-border px-3 py-2 text-sm transition hover:bg-muted/40"
              >
                {getCategoryConfig(category).label}
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
