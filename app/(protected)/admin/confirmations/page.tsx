import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { FileEdit } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AdminConfirmationsClient from "@/app/(protected)/admin/confirmations/AdminConfirmationsClient";
import { authOptions } from "@/lib/auth";
import { canApproveConfirmations } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminConfirmationsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canApproveConfirmations(email)) {
    redirect(dashboard());
  }

  return (
    <AdminPageShell
      title="Entry Confirmations"
      subtitle="Review entries sent for confirmation. Locked mode activates only after approval."
      backHref={adminHome()}
      icon={FileEdit}
      maxWidthClassName="max-w-6xl"
    >
      <AdminConfirmationsClient />
    </AdminPageShell>
  );
}
