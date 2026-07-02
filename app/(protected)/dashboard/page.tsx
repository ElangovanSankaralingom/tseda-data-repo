import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AwardProgress from "@/components/dashboard/AwardProgress";
import DashboardClient from "@/components/dashboard/DashboardClient";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";
import { canAccessAdminConsole, isMasterAdmin } from "@/lib/admin/roles";
import { authOptions } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";
import { getDashboardSummary } from "@/lib/entries/summary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { signin } from "@/lib/entryNavigation";
import { trackEvent } from "@/lib/telemetry/telemetry";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import DashboardWelcome from "@/components/dashboard/DashboardWelcome";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { isActivityFeedEnabled } from "@/lib/settings/consumer";

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
  const editRequestedCount = toSafeCount(summary.totals.editRequestedCount);
  const draftCount = toSafeCount(summary.totals.draftCount);

  const hasAnyEntries = totalEntries > 0;
  const firstName = userName.split(/\s+/)[0] ?? userName;

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "greetingMorning" : hour < 17 ? "greetingAfternoon" : "greetingEvening";

  // Build per-category summaries for the bento grid
  const categories = CATEGORY_KEYS.map((slug) => {
    const cat = summary.byCategory[slug];
    return {
      slug,
      totalEntries: toSafeCount(cat?.totalEntries ?? 0),
      draftCount: toSafeCount(cat?.draftCount ?? 0),
      generatedCount: toSafeCount(cat?.generatedCount ?? 0),
      editRequestedCount: toSafeCount(cat?.editRequestedCount ?? 0),
      editGrantedCount: toSafeCount(cat?.editGrantedCount ?? 0),
    };
  });

  // Recent entries for the activity sidebar
  const recentEntries = (summary.recentEntries ?? []).slice(0, 6).map((row) => ({
    id: row.id,
    categoryKey: row.categoryKey,
    categoryLabel: row.categoryLabel,
    title: row.title,
    status: String(row.status),
    updatedAtISO: row.updatedAtISO,
    route: row.route,
  }));

  const feedEnabled = await isActivityFeedEnabled();

  return (
    <div className="relative space-y-8 animate-page-enter dot-grid-bg">
      {/* ── Command Strip — dark hero bar ── */}
      <DashboardWelcome
        greetingKey={greetingKey}
        firstName={firstName}
        totalEntries={totalEntries}
        streakActivated={streakActivated}
        streakWins={streakWins}
        hasAnyEntries={hasAnyEntries}
        draftCount={draftCount}
        editRequestedCount={editRequestedCount}
      />

      {/* ── My Award Progress — self-reflection panel (renders only once
             the faculty has entries with an academic year) ── */}
      {hasAnyEntries ? <AwardProgress /> : null}

      {/* ── Content: Empty state or Bento grid ── */}
      {!hasAnyEntries ? (
        <DashboardEmptyState />
      ) : (
        <DashboardClient
          categories={categories}
          recentEntries={recentEntries}
        />
      )}

      {feedEnabled && <ActivityFeed canModerate={isMasterAdmin(email)} />}
    </div>
  );
}

