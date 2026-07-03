import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import DemoModeClient from "@/components/admin/DemoModeClient";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin/roles";
import { getDemoState, isDemoActive } from "@/lib/demo/state";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminDemoPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !isMasterAdmin(email)) {
    redirect(dashboard());
  }

  // Demo participation state is SHARED (never universe-forked) — no
  // inUserUniverse wrapper needed for these reads.
  const state = await getDemoState();
  const selfActive = await isDemoActive(email);

  return (
    <AdminPageShell
      titleKey="demo.adminTitle"
      subtitleKey="demo.adminSubtitle"
      backHref={adminHome()}
      iconName="FlaskConical"
      maxWidthClassName="max-w-3xl"
    >
      <DemoModeClient
        initialRoster={state.roster}
        initialActive={Object.entries(state.active).map(([activeEmail, meta]) => ({
          email: activeEmail,
          activatedAt: meta.activatedAt,
        }))}
        selfActive={selfActive}
      />
    </AdminPageShell>
  );
}
