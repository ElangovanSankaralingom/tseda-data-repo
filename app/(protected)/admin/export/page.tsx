import { getServerSession } from "next-auth";
import AdminPageShell from "@/components/admin/AdminPageShell";
import AdminExportForm from "@/components/admin/AdminExportForm";
import SectionCard from "@/components/layout/SectionCard";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";
import { listUsers } from "@/lib/admin/integrity";
import { toUserMessage } from "@/lib/errors";
import {
  getExportCategoryOptions,
  getExportStatusOptions,
  getExportableFields,
} from "@/lib/export/exportService";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { redirect } from "next/navigation";

export default async function AdminExportPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canExport(email)) {
    redirect(dashboard());
  }

  const usersResult = await listUsers();
  const users = usersResult.ok ? usersResult.data : [];
  const error = usersResult.ok ? null : toUserMessage(usersResult.error);

  const categories = getExportCategoryOptions();

  const fieldOptionsByCategory = categories.reduce<Record<string, { key: string; label: string }[]>>(
    (next, category) => {
      const fields = getExportableFields(category.key);
      next[category.key] = fields.map((field) => ({
        key: field.key,
        label: field.label,
      }));
      return next;
    },
    {}
  );
  const statusOptions = getExportStatusOptions();

  return (
    <AdminPageShell
      title="Export Entries"
      subtitle="Download schema-driven exports from canonical normalized DataStore records."
      backHref={adminHome()}
    >
      <SectionCard>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="text-sm text-muted-foreground">No users available for export.</div>
        ) : (
          <AdminExportForm
            users={users}
            categories={categories}
            statusOptions={statusOptions}
            fieldOptionsByCategory={fieldOptionsByCategory}
            downloadPath="/api/admin/export/entries"
          />
        )}
      </SectionCard>
    </AdminPageShell>
  );
}
