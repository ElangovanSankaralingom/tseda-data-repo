import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AwardScoresClient from "@/components/admin/AwardScoresClient";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

/**
 * Admin faculty scores (roadmap #15) — same gate as /api/admin/awards, so
 * the page never renders for someone the API would refuse anyway.
 */
export default async function AdminAwardsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessAdminConsole(email)) {
    redirect(dashboard());
  }

  return (
    <AdminPageShell
      titleKey="awardsAdmin.title"
      subtitleKey="awardsAdmin.subtitle"
      backHref={adminHome()}
      iconName="Award"
      maxWidthClassName="max-w-4xl"
    >
      <AwardScoresClient />
    </AdminPageShell>
  );
}
