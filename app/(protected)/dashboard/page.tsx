import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import MetricCard from "@/components/layout/MetricCard";
import PageHeader from "@/components/layout/PageHeader";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { authOptions } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/entries/summary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, signin } from "@/lib/entryNavigation";
import { trackEvent } from "@/lib/telemetry/telemetry";

function toSafeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
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

    </div>
  );
}
