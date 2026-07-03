import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import BinClient from "@/components/admin/BinClient";
import { authOptions } from "@/lib/auth";
import { isDeleteApprover } from "@/lib/admin/coordinators";
import { listBinForViewer } from "@/lib/admin/bin";
import { inUserUniverse } from "@/lib/demo/demoAware";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminBinPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!isDeleteApprover(email)) {
    redirect(dashboard());
  }

  // Server-side read → runs in the viewer's universe (real or demo).
  const entries = await inUserUniverse(email, () => listBinForViewer(email));

  return (
    <AdminPageShell
      titleKey="adminPages.binTitle"
      subtitleKey="adminPages.binSubtitle"
      backHref={adminHome()}
      iconName="Trash2"
      maxWidthClassName="max-w-5xl"
    >
      <BinClient
        initialEntries={entries.map((m) => ({
          trashId: m.trashId,
          category: m.category,
          entryTitle: m.entryTitle,
          ownerEmail: m.ownerEmail,
          quarantinedAtISO: m.quarantinedAtISO,
        }))}
      />
    </AdminPageShell>
  );
}
