import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { authOptions } from "@/lib/auth";
import { canRunMaintenance } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  getLastMaintenanceRun,
} from "@/lib/jobs/nightly";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { computeSystemStats } from "@/lib/maintenance/stats";
import { readMaintenanceLog } from "@/lib/maintenance/log";
import MaintenanceDashboard from "@/components/admin/MaintenanceDashboard";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canRunMaintenance(email)) {
    redirect(dashboard());
  }

  const [lastRunResult, statsResult, logResult] = await Promise.all([
    getLastMaintenanceRun(),
    computeSystemStats(),
    readMaintenanceLog(15),
  ]);

  const lastRun = lastRunResult.ok ? lastRunResult.data : null;
  const stats = statsResult.ok ? statsResult.data : null;
  const actionLog = logResult.ok ? logResult.data : [];

  return (
    <AdminPageShell
      title="Mission Control"
      subtitle="Monitor system health, run maintenance jobs, and review action history."
      backHref={adminHome()}
      icon={Wrench}
      maxWidthClassName="max-w-7xl"
    >
      <MaintenanceDashboard
        lastRun={lastRun}
        stats={stats}
        actionLog={actionLog}
      />
    </AdminPageShell>
  );
}
