import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  Flame,
} from "lucide-react";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { authOptions } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/entries/summary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  dataEntryHome,
  signin,
} from "@/lib/entryNavigation";
import { trackEvent } from "@/lib/telemetry/telemetry";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";

export const dynamic = "force-dynamic";

function toSafeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
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
  const generatedCount = toSafeCount(summary.totals.generatedCount);
  const editRequestedCount = toSafeCount(summary.totals.editRequestedCount);

  const hasAnyEntries = totalEntries > 0;
  const firstName = userName.split(/\s+/)[0] ?? userName;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const welcomeSubtext = !hasAnyEntries
    ? "Start your first entry to begin your streak"
    : streakActivated > 0
    ? `You have ${streakActivated} ${streakActivated === 1 ? "entry" : "entries"} to complete`
    : streakWins > 0
    ? "All entries complete!"
    : "Here\u2019s your progress overview";

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 animate-fade-in-up">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {greeting}, {firstName} <span className="animate-wave">👋</span>
            </h1>
            {hasAnyEntries && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {welcomeSubtext}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {streakActivated > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
              <Flame className="size-4" />
              {streakActivated}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasAnyEntries ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center animate-fade-in-up stagger-1">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-slate-100">
            <ClipboardList className="size-10 text-slate-400" />
          </div>
          <p className="mt-3 text-base font-medium text-slate-500">
            No entries yet
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Start collecting data to build your streak!
          </p>
          <Link
            href={dataEntryHome()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#2D5F8A] hover:shadow hover:-translate-y-0.5 active:scale-[0.97]"
          >
            Go to Data Entry
          </Link>
        </div>
      ) : (
        <DashboardClient
          streakActivated={streakActivated}
          streakWins={streakWins}
          totalEntries={totalEntries}
          generatedCount={generatedCount}
          editRequestedCount={editRequestedCount}
        />
      )}
    </div>
  );
}
