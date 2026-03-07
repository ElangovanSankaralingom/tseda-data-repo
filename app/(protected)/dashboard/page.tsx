import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Flame,
} from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";
import StatCard from "@/components/dashboard/StatCard";
import StreakCard from "@/components/dashboard/StreakCard";
import ProgressBar from "@/components/dashboard/ProgressBar";
import { CATEGORY_LIST, getCategoryConfig } from "@/data/categoryRegistry";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { authOptions } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/entries/summary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  adminHome,
  dataEntryHome,
  signin,
} from "@/lib/entryNavigation";
import { trackEvent } from "@/lib/telemetry/telemetry";
import { cn } from "@/lib/utils";

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
    meta: { page: "/dashboard" },
  });

  const summary = await getDashboardSummary(email);
  const userName = session?.user?.name?.trim() || email;

  const streakActivated = toSafeCount(summary.totals.streakActivatedCount);
  const streakWins = toSafeCount(summary.totals.streakWinsCount);
  const totalEntries = toSafeCount(summary.totals.totalEntries);
  const pendingCount = toSafeCount(summary.totals.pendingConfirmationCount);
  const approvedCount = toSafeCount(summary.totals.approvedCount);
  const rejectedCount = toSafeCount(summary.totals.rejectedCount);

  const hasAnyEntries = totalEntries > 0;
  const hasActiveStreak = streakActivated > 0;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {userName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s your progress overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveStreak && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
              <Flame className="size-4" />
              {streakActivated}
            </div>
          )}
          {canAccessAdmin && (
            <Link
              href={adminHome()}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted/60"
            >
              Admin Console
            </Link>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasAnyEntries ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-lg font-medium text-slate-600">No entries yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Start collecting data to see your progress here.
          </p>
          <Link
            href={dataEntryHome()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <ClipboardList className="size-4" />
            Go to Data Entry
          </Link>
        </div>
      ) : (
        <>
          {/* Section A — Your Streak */}
          <div>
            <SectionHeader title="Your Streak" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <StreakCard
                type="active"
                value={streakActivated}
                isActive={hasActiveStreak}
                subtext={
                  hasActiveStreak
                    ? "Entries in active streak window"
                    : "Start your streak!"
                }
              />
              <StreakCard
                type="wins"
                value={streakWins}
                isActive={streakWins > 0}
                subtext={
                  streakWins > 0
                    ? "Completed streak milestones"
                    : "Complete streaks to earn wins"
                }
              />
              <StreakCard
                type="current"
                value={streakActivated}
                isActive={hasActiveStreak}
                subtext={
                  hasActiveStreak ? "Keep it going!" : "Start your streak!"
                }
              />
            </div>
          </div>

          {/* Section B — Your Progress */}
          <div>
            <SectionHeader
              title="Your Progress"
              description="Entry status across all categories"
            />
            <div
              className={cn(
                "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                rejectedCount > 0 && "lg:grid-cols-4"
              )}
            >
              <StatCard
                icon={ClipboardList}
                label="Total Entries"
                value={totalEntries}
                description="Across all categories"
              />
              <StatCard
                icon={CheckCircle2}
                label="Approved"
                value={approvedCount}
              />
              <StatCard
                icon={Clock}
                label="Pending"
                value={pendingCount}
              />
              {rejectedCount > 0 && (
                <StatCard
                  icon={XCircle}
                  label="Rejected"
                  value={rejectedCount}
                />
              )}
            </div>
          </div>

          {/* Section C — Categories */}
          <div>
            <SectionHeader
              title="Categories"
              description="Progress per category"
            />
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              {CATEGORY_LIST.map((slug) => {
                const config = getCategoryConfig(slug);
                const catData = summary.byCategory[slug];
                const catTotal = catData ? toSafeCount(catData.totalEntries) : 0;
                const catApproved = catData ? toSafeCount(catData.approvedCount) : 0;

                return (
                  <ProgressBar
                    key={slug}
                    label={config.label}
                    value={catApproved}
                    max={catTotal || 1}
                    color={catTotal === 0 ? "bg-slate-200" : "bg-blue-500"}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Muted streak section shown even with zero entries */}
      {!hasAnyEntries && (
        <div>
          <SectionHeader title="Your Streak" />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <StreakCard
              type="active"
              value={0}
              isActive={false}
              subtext="Start your streak!"
            />
            <StreakCard
              type="wins"
              value={0}
              isActive={false}
              subtext="Complete streaks to earn wins"
            />
            <StreakCard
              type="current"
              value={0}
              isActive={false}
              subtext="Start your streak!"
            />
          </div>
        </div>
      )}
    </div>
  );
}
