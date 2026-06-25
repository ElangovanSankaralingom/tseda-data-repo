import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AdminConfirmationsClient from "@/app/(protected)/admin/confirmations/AdminConfirmationsClient";
import { authOptions } from "@/lib/auth";
import { canApproveConfirmations } from "@/lib/admin/roles";
import { isEditApprovalCoordinator } from "@/lib/admin/coordinators";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminConfirmationsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  // Global approvers (master/reviewer) OR edit-approval coordinators may enter;
  // coordinators see only their scoped edit queue (filtered server-side).
  if (!canApproveConfirmations(email) && !isEditApprovalCoordinator(email)) {
    redirect(dashboard());
  }

  return (
    <AdminPageShell
      titleKey="adminPages.confirmationsTitle"
      subtitleKey="adminPages.confirmationsSubtitle"
      backHref={adminHome()}
      iconName="FileEdit"
      maxWidthClassName="max-w-6xl"
    >
      <AdminConfirmationsClient />
    </AdminPageShell>
  );
}
