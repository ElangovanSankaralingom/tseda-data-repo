import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminConfirmationsClient from "@/app/(protected)/admin/confirmations/AdminConfirmationsClient";
import { authOptions } from "@/lib/auth";
import { canApproveConfirmations } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dashboard } from "@/lib/navigation";

export default async function AdminConfirmationsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canApproveConfirmations(email)) {
    redirect(dashboard());
  }

  return <AdminConfirmationsClient />;
}
