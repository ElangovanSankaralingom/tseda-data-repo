import BackTo from "@/components/nav/BackTo";
import AdminExportForm from "@/components/admin/AdminExportForm";
import { listUsers } from "@/lib/admin/integrity";
import { CATEGORY_LIST, getCategoryConfig } from "@/data/categoryRegistry";
import { toUserMessage } from "@/lib/errors";
import {
  getExportableFields,
  type ExportCategorySelection,
} from "@/lib/export/exportService";
import { adminHome } from "@/lib/navigation";

export default async function AdminExportPage() {
  const usersResult = await listUsers();
  const users = usersResult.ok ? usersResult.data : [];
  const error = usersResult.ok ? null : toUserMessage(usersResult.error);

  const categories: Array<{ key: ExportCategorySelection; label: string }> = [
    { key: "all", label: "All Categories" },
    ...CATEGORY_LIST.map((categoryKey) => ({
      key: categoryKey,
      label: getCategoryConfig(categoryKey).label,
    })),
  ];

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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={adminHome()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Export Entries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Download schema-driven exports from canonical normalized DataStore records.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
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
            fieldOptionsByCategory={fieldOptionsByCategory}
            downloadPath="/api/admin/export/entries"
          />
        )}
      </div>
    </div>
  );
}
