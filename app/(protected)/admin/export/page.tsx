import { getServerSession } from "next-auth";
import AdminPageShell from "@/components/admin/AdminPageShell";
import ExportDashboard from "@/components/admin/ExportDashboard";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";
import { listUsers } from "@/lib/admin/integrity";
import {
  getExportCategoryOptions,
  getExportStatusOptions,
  getExportableFields,
} from "@/lib/export/exportService";
import { getExportTemplates } from "@/lib/export/templates";
import { getExportHistory } from "@/lib/export/history";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canExport(email)) {
    redirect(dashboard());
  }

  const [usersResult, historyResult] = await Promise.all([
    listUsers(),
    getExportHistory(10),
  ]);

  const users = usersResult.ok ? usersResult.data : [];
  const templates = getExportTemplates();
  const categories = getExportCategoryOptions();
  const statusOptions = getExportStatusOptions();

  const fieldOptionsByCategory = categories.reduce<Record<string, { key: string; label: string }[]>>(
    (acc, category) => {
      const fields = getExportableFields(category.key);
      acc[category.key] = fields.map((field) => ({
        key: field.key,
        label: field.label,
      }));
      return acc;
    },
    {}
  );

  const initialHistory = historyResult.ok ? historyResult.data : [];

  return (
    <AdminPageShell
      title="Export Center"
      subtitle="Quick templates, custom exports, and download history."
      backHref={adminHome()}
    >
      <ExportDashboard
        templates={templates}
        users={users}
        categories={categories}
        statusOptions={statusOptions}
        fieldOptionsByCategory={fieldOptionsByCategory}
        initialHistory={initialHistory}
      />
    </AdminPageShell>
  );
}
