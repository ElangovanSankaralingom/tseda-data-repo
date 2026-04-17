import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import { authOptions } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { getCachedAnalytics } from "@/lib/analytics/cache";
import { trackEvent } from "@/lib/telemetry/telemetry";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canViewAnalytics(email)) {
    redirect(dashboard());
  }

  void trackEvent({
    event: "page.analytics_view",
    actorEmail: email,
    role: "admin",
    meta: { page: "/admin/analytics" },
  });

  const result = await getCachedAnalytics();

  if (!result.ok) {
    return (
      <AdminPageShell
        title="Analytics"
        subtitle="Charts, trends, and insights across all faculty data"
        backHref={adminHome()}
        iconName="BarChart3"
        maxWidthClassName="max-w-6xl"
      >
        <div className="rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {t("adminPages.analyticsLoadFailed", "en")}
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      titleKey="adminPages.analyticsTitle"
      subtitleKey="adminPages.analyticsSubtitle"
      backHref={adminHome()}
      iconName="BarChart3"
      maxWidthClassName="max-w-6xl"
    >
      <AnalyticsDashboard snapshot={result.data} />
    </AdminPageShell>
  );
}
