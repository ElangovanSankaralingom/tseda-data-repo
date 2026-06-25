import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import CoordinatorsClient from "@/components/admin/CoordinatorsClient";
import { authOptions } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/admin/roles";
import { getCoordinatorsConfig } from "@/lib/admin/coordinators";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { listAllUsers } from "@/lib/users/service";

export const dynamic = "force-dynamic";

export default async function AdminCoordinatorsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(email)) {
    redirect(dashboard());
  }

  const config = getCoordinatorsConfig();
  const users = await listAllUsers();
  const faculty = users.map((u) => ({ email: u.email, name: u.name || u.email }));

  return (
    <AdminPageShell
      titleKey="adminPages.coordinatorsTitle"
      subtitleKey="adminPages.coordinatorsSubtitle"
      backHref={adminHome()}
      iconName="Network"
      maxWidthClassName="max-w-5xl"
    >
      <CoordinatorsClient initialConfig={config} faculty={faculty} />
    </AdminPageShell>
  );
}
