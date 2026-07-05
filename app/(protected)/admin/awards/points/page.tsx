import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AwardPointsClient from "@/components/admin/AwardPointsClient";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminAwards, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

/**
 * Points editor (roadmap #14) — settings-tier, same gate as the API it
 * consumes. Back link goes to the awards admin view, its parent tool.
 */
export default async function AdminAwardPointsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessSettings(email)) {
    redirect(dashboard());
  }

  return (
    <AdminPageShell
      titleKey="awardsAdmin.pointsConfigTitle"
      subtitleKey="awardsAdmin.pointsConfigSubtitle"
      backHref={adminAwards()}
      iconName="SlidersHorizontal"
      maxWidthClassName="max-w-4xl"
    >
      <AwardPointsClient />
    </AdminPageShell>
  );
}
