import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dashboard } from "@/lib/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!isMasterAdmin(email)) {
    redirect(dashboard());
  }

  return <>{children}</>;
}
