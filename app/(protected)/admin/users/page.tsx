import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import UserManagement from "@/components/admin/UserManagement";
import { authOptions } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { listAllUsers, getUserStats } from "@/lib/users/service";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(email)) {
    redirect(dashboard());
  }

  const [users, stats] = await Promise.all([
    listAllUsers(),
    getUserStats(),
  ]);

  // Sort by totalEntries desc by default
  users.sort((a, b) => b.totalEntries - a.totalEntries);

  return (
    <AdminPageShell
      title="User Management"
      subtitle="Every faculty member, their data, their journey"
      backHref={adminHome()}
    >
      <UserManagement initialUsers={users} initialStats={stats} />
    </AdminPageShell>
  );
}
