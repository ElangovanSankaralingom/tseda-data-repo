import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminConsoleDashboard from "@/components/admin/AdminConsoleDashboard";
import { authOptions } from "@/lib/auth";
import {
  canAccessAdminSearch,
  canAccessSettings,
  canApproveConfirmations,
  canExport,
  canManageAdminUsers,
  canManageBackups,
  canRunIntegrityTools,
  canRunMaintenance,
  canViewAnalytics,
  canViewAudit,
} from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dashboard } from "@/lib/entryNavigation";
import { isMasterAdmin } from "@/lib/admin";
import { isApprovalCoordinator } from "@/lib/admin/coordinators";
import { trackEvent } from "@/lib/telemetry/telemetry";

export const dynamic = "force-dynamic";

export default async function AdminConsolePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  const coordinator = isApprovalCoordinator(email);
  if (!email || (!isMasterAdmin(email) && !canApproveConfirmations(email) && !canViewAudit(email) && !coordinator)) {
    redirect(dashboard());
  }

  void trackEvent({
    event: "page.admin_console_view",
    actorEmail: email,
    role: "admin",
    meta: { page: "/admin" },
  });

  const permissions: Record<string, boolean> = {
    confirmations: canApproveConfirmations(email) || coordinator,
    users: canManageAdminUsers(email),
    coordinators: canManageAdminUsers(email),
    settings: canAccessSettings(email),
    audit: canViewAudit(email),
    analytics: canViewAnalytics(email),
    search: canAccessAdminSearch(email),
    export: canExport(email),
    integrity: canRunIntegrityTools(email),
    backups: canManageBackups(email),
    maintenance: canRunMaintenance(email),
  };

  return <AdminConsoleDashboard permissions={permissions} />;
}
