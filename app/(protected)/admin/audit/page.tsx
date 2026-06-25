import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AuditDashboard from "@/components/admin/AuditDashboard";
import { authOptions } from "@/lib/auth";
import { getRecentAuditEvents, getAuditStats } from "@/lib/admin/auditLog";
import { canViewAudit } from "@/lib/admin/roles";
import { isApprovalCoordinator, getCoordinatorScope } from "@/lib/admin/coordinators";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const isGlobal = canViewAudit(email);
  if (!isGlobal && !isApprovalCoordinator(email)) {
    redirect(dashboard());
  }

  // Master/reviewer see the whole trail + aggregate stats; a coordinator sees only
  // their categories' events and no global stats.
  const allowedCategories = isGlobal ? undefined : getCoordinatorScope(email).categories;
  const [eventsResult, statsResult] = await Promise.all([
    getRecentAuditEvents({ limit: 500, allowedCategories }),
    isGlobal ? getAuditStats() : Promise.resolve(null),
  ]);

  const events = eventsResult.ok ? eventsResult.data : [];
  const stats = statsResult && statsResult.ok ? statsResult.data : null;

  return (
    <AdminPageShell
      titleKey="adminPages.auditTitle"
      subtitleKey="adminPages.auditSubtitle"
      backHref={adminHome()}
      iconName="ScrollText"
    >
      <AuditDashboard initialEvents={events} initialStats={stats} />
    </AdminPageShell>
  );
}
