import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import FormatsClient from "@/components/admin/FormatsClient";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";
import { canCoordinatorExport, getCoordinatorScope } from "@/lib/admin/coordinators";
import { listTemplatesForViewer } from "@/lib/export/formatTemplates";
import { getExportableFields } from "@/lib/export/exportService";
import { CATEGORY_LIST } from "@/data/categoryRegistry";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function AdminExportFormatsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const isGlobal = canExport(email);
  if (!isGlobal && !getCoordinatorScope(email).export) {
    redirect(dashboard());
  }

  // Categories this person may author formats for, each with its exportable fields.
  const categories = CATEGORY_LIST.filter((c) => isGlobal || canCoordinatorExport(email, c)).map(
    (c) => ({
      key: c,
      fields: getExportableFields(c).map((f) => ({ key: f.key, label: f.label })),
    })
  );

  return (
    <AdminPageShell
      titleKey="adminPages.formatsTitle"
      subtitleKey="adminPages.formatsSubtitle"
      backHref={adminHome()}
      iconName="Columns"
      maxWidthClassName="max-w-5xl"
    >
      <FormatsClient initialTemplates={listTemplatesForViewer(email)} categories={categories} />
    </AdminPageShell>
  );
}
