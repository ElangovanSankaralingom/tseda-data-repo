import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import SectionCard from "@/components/layout/SectionCard";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canAccessSettings(email)) {
    redirect(dashboard());
  }

  return (
    <AdminPageShell
      title="Admin Settings"
      subtitle="Global admin settings and environment-level controls."
      backHref={adminHome()}
      maxWidthClassName="max-w-6xl"
    >
      <SectionCard>
        <p className="text-sm text-muted-foreground">
          Placeholder panel for admin settings.
        </p>
      </SectionCard>
    </AdminPageShell>
  );
}
