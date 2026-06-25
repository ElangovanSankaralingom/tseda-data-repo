import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import FacultyClient from "@/components/admin/FacultyClient";
import { authOptions } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/admin/roles";
import { getFacultyRegistry } from "@/lib/admin/facultyRegistry";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminFacultyPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(email)) {
    redirect(dashboard());
  }

  return (
    <AdminPageShell
      titleKey="adminPages.facultyTitle"
      subtitleKey="adminPages.facultySubtitle"
      backHref={adminHome()}
      iconName="UserCog"
      maxWidthClassName="max-w-5xl"
    >
      <FacultyClient initialConfig={getFacultyRegistry()} />
    </AdminPageShell>
  );
}
