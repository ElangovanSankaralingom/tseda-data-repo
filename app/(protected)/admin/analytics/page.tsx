import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import { authOptions } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { getCachedAnalytics } from "@/lib/analytics/cache";
import { trackEvent } from "@/lib/telemetry/telemetry";

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
        icon={BarChart3}
        maxWidthClassName="max-w-6xl"
      >
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load analytics. Please try again later.
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="Analytics"
      subtitle="Charts, trends, and insights across all faculty data"
      backHref={adminHome()}
      icon={BarChart3}
      maxWidthClassName="max-w-6xl"
    >
      <AnalyticsDashboard snapshot={result.data} />
    </AdminPageShell>
  );
}
