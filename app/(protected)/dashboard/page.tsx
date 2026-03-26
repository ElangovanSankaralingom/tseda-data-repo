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
import DashboardWelcome from "@/components/dashboard/DashboardWelcome";

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
  const greetingKey = hour < 12 ? "greetingMorning" : hour < 17 ? "greetingAfternoon" : "greetingEvening";

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <DashboardWelcome
        greetingKey={greetingKey}
        firstName={firstName}
        totalEntries={totalEntries}
        streakActivated={streakActivated}
        streakWins={streakWins}
        hasAnyEntries={hasAnyEntries}
      />

      {/* Empty state */}
      {!hasAnyEntries ? (
        <DashboardEmptyState />
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

function DashboardEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-card-border)] bg-[var(--color-body-bg)] p-8 text-center animate-fade-in-up stagger-1">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-[var(--color-dropdown-hover)]">
        <ClipboardList className="size-10 text-[var(--color-text-secondary)]" />
      </div>
      <p className="mt-3 text-base font-medium text-[var(--color-text-secondary)]">
        No entries yet
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Start collecting data to build your streak!
      </p>
      <Link
        href={dataEntryHome()}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-button-primary-bg)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--color-primary-light)] hover:shadow hover:-translate-y-0.5 active:scale-[0.97]"
      >
        Go to Data Entry
      </Link>
    </div>
  );
}
