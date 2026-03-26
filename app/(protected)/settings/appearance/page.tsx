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
    <div className="mx-auto max-w-[640px] py-8">
      <AppearanceSettings />
    </div>
  );
}
