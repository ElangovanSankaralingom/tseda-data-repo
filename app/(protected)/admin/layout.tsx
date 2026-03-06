import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dashboard } from "@/lib/entryNavigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!canAccessAdminConsole(email)) {
    redirect(dashboard());
  }

  return <>{children}</>;
}
