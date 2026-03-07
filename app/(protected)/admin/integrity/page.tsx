import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import IntegrityDashboard from "@/components/admin/IntegrityDashboard";
import { authOptions } from "@/lib/auth";
import { canRunIntegrityTools } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { getLastReport, getReportHistory } from "@/lib/integrity/report";

export const dynamic = "force-dynamic";

export default async function AdminIntegrityOverviewPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canRunIntegrityTools(email)) {
    redirect(dashboard());
  }

  const [reportResult, historyResult] = await Promise.all([
    getLastReport(),
    getReportHistory(10),
  ]);

  const report = reportResult.ok ? reportResult.data : null;
  const history = historyResult.ok ? historyResult.data : [];

  return (
    <AdminPageShell
      title="Data Integrity"
      subtitle="Keep your data healthy, consistent, and corruption-free."
      backHref={adminHome()}
      maxWidthClassName="max-w-7xl"
    >
      <IntegrityDashboard
        initialReport={report}
        initialHistory={history}
      />
    </AdminPageShell>
  );
}
