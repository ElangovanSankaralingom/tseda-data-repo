import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dashboard } from "@/lib/entryNavigation";
import AppearanceSettings from "@/components/settings/AppearanceSettings";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) redirect(dashboard());

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <AppearanceSettings />
    </div>
  );
}
