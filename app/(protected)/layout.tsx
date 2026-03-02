import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ShellClient from "@/app/ShellClient";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { findFacultyByEmail } from "@/lib/facultyDirectory";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) redirect("/signin");

  const email = session.user.email.toLowerCase();
  if (!email.endsWith("@tce.edu") || !findFacultyByEmail(email)) {
    redirect("/signin?error=AccessDenied");
  }

  return <ShellClient>{children}</ShellClient>;
}
