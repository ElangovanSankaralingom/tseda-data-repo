import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import SettingsDashboard from "@/components/admin/SettingsDashboard";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { getAllSettingsWithMeta, getNonDefaultCounts } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canAccessSettings(email)) {
    redirect(dashboard());
  }

  const [settings, counts] = await Promise.all([
    getAllSettingsWithMeta(),
    getNonDefaultCounts(),
  ]);

  return (
    <AdminPageShell
      title="Settings"
      subtitle="Configure T'SEDA to work exactly how you want"
      backHref={adminHome()}
      icon={Settings}
      maxWidthClassName="max-w-6xl"
    >
      <SettingsDashboard initialSettings={settings} initialCounts={counts} />
    </AdminPageShell>
  );
}
