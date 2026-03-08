import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AuditDashboard from "@/components/admin/AuditDashboard";
import { authOptions } from "@/lib/auth";
import { getRecentAuditEvents, getAuditStats } from "@/lib/admin/auditLog";
import { canViewAudit } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canViewAudit(email)) {
    redirect(dashboard());
  }

  const [eventsResult, statsResult] = await Promise.all([
    getRecentAuditEvents({ limit: 500 }),
    getAuditStats(),
  ]);

  const events = eventsResult.ok ? eventsResult.data : [];
  const stats = statsResult.ok ? statsResult.data : null;

  return (
    <AdminPageShell
      title="Audit Trail"
      subtitle="Complete history of all entry mutations, uploads, and workflow changes across all users."
      backHref={adminHome()}
      icon={ScrollText}
    >
      <AuditDashboard initialEvents={events} initialStats={stats} />
    </AdminPageShell>
  );
}
