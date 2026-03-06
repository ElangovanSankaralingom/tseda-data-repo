import BackTo from "@/components/nav/BackTo";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={adminHome()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Global admin settings will be configured here.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Placeholder panel for admin settings.
      </div>
    </div>
  );
}
