import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import AdminPageShell from "@/components/admin/AdminPageShell";
import BackTo from "@/components/nav/BackTo";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import { authOptions } from "@/lib/auth";
import {
  checkUserIntegrity,
  migrateUserData,
  rebuildUserIndex,
  repairUserCategoryStore,
  type IntegrityIssue,
} from "@/lib/admin/integrity";
import { canRunIntegrityTools } from "@/lib/admin/roles";
import { CATEGORY_KEYS, isCategoryKey } from "@/lib/categories";
import { toUserMessage } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminIntegrity, adminIntegrityUser } from "@/lib/entryNavigation";
import { getButtonClass } from "@/lib/ui/buttonRoles";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminIntegrityUserPageProps = {
  params: Promise<{ userEmail: string }>;
  searchParams?: Promise<SearchParams>;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function getNoticeClass(level: string) {
  if (level === "success") {
    return "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700";
  }
  if (level === "warn") {
    return "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800";
  }
  if (level === "error") {
    return "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";
  }
  return "rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground";
}

function encodeNoticeUrl(userEmail: string, level: "success" | "warn" | "error" | "info", message: string) {
  const params = new URLSearchParams({
    level,
    notice: message,
  });
  return `${adminIntegrityUser(userEmail)}?${params.toString()}`;
}

async function ensureMasterAdmin() {
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");
  if (!canRunIntegrityTools(actorEmail)) {
    redirect(adminIntegrity());
  }
}

function countBySeverity(issues: IntegrityIssue[]) {
  let info = 0;
  let warn = 0;
  let error = 0;
  for (const issue of issues) {
    if (issue.severity === "info") info += 1;
    if (issue.severity === "warn") warn += 1;
    if (issue.severity === "error") error += 1;
  }
  return { info, warn, error };
}

export default async function AdminIntegrityUserPage({ params, searchParams }: AdminIntegrityUserPageProps) {
  const routeParams = await params;
  const query = searchParams ? await searchParams : {};
  const notice = getParam(query, "notice");
  const level = getParam(query, "level") || "info";

  const normalizedUserEmail = normalizeEmail(
    decodeURIComponent(String(routeParams.userEmail ?? "").trim())
  );

  if (!normalizedUserEmail.endsWith("@tce.edu")) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center gap-3">
          <BackTo href={adminIntegrity()} label="Integrity" />
          <h1 className="text-2xl font-semibold tracking-tight">Integrity Check</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Invalid user email route parameter.
        </div>
      </div>
    );
  }

  await ensureMasterAdmin();

  async function repairCategoryAction(formData: FormData) {
    "use server";
    await ensureMasterAdmin();

    const targetUserEmail = normalizeEmail(String(formData.get("userEmail") ?? ""));
    const category = String(formData.get("category") ?? "").trim();
    if (!targetUserEmail.endsWith("@tce.edu") || !isCategoryKey(category)) {
      redirect(encodeNoticeUrl(normalizedUserEmail, "error", "Invalid repair request."));
    }

    const result = await repairUserCategoryStore(targetUserEmail, category as CategoryKey, { backup: true });
    if (!result.ok) {
      redirect(encodeNoticeUrl(targetUserEmail, "error", `Repair failed: ${toUserMessage(result.error)}`));
    }

    const message = `Repaired ${category}: ${result.data.fixedIssues.length} fix(es), ${result.data.filesTouched.length} file(s) updated.`;
    redirect(encodeNoticeUrl(targetUserEmail, "success", message));
  }

  async function repairStoresAction(formData: FormData) {
    "use server";
    await ensureMasterAdmin();

    const targetUserEmail = normalizeEmail(String(formData.get("userEmail") ?? ""));
    if (!targetUserEmail.endsWith("@tce.edu")) {
      redirect(encodeNoticeUrl(normalizedUserEmail, "error", "Invalid repair request."));
    }

    let totalFixes = 0;
    let totalTouched = 0;
    let totalBackups = 0;
    for (const category of CATEGORY_KEYS) {
      const result = await repairUserCategoryStore(targetUserEmail, category, { backup: true });
      if (!result.ok) {
        redirect(encodeNoticeUrl(targetUserEmail, "error", `Repair failed: ${toUserMessage(result.error)}`));
      }
      totalFixes += result.data.fixedIssues.length;
      totalTouched += result.data.filesTouched.length;
      totalBackups += result.data.backupsCreated.length;
    }

    redirect(
      encodeNoticeUrl(
        targetUserEmail,
        "success",
        `Store repair complete: ${totalFixes} fix(es), ${totalTouched} file write(s), ${totalBackups} backup(s).`
      )
    );
  }

  async function rebuildIndexAction(formData: FormData) {
    "use server";
    await ensureMasterAdmin();

    const targetUserEmail = normalizeEmail(String(formData.get("userEmail") ?? ""));
    if (!targetUserEmail.endsWith("@tce.edu")) {
      redirect(encodeNoticeUrl(normalizedUserEmail, "error", "Invalid rebuild request."));
    }

    const result = await rebuildUserIndex(targetUserEmail);
    if (!result.ok) {
      redirect(encodeNoticeUrl(targetUserEmail, "error", `Index rebuild failed: ${toUserMessage(result.error)}`));
    }

    redirect(
      encodeNoticeUrl(
        targetUserEmail,
        "success",
        `Index rebuilt. Updated at ${result.data.updatedAt}.`
      )
    );
  }

  async function migrateDataAction(formData: FormData) {
    "use server";
    await ensureMasterAdmin();

    const targetUserEmail = normalizeEmail(String(formData.get("userEmail") ?? ""));
    if (!targetUserEmail.endsWith("@tce.edu")) {
      redirect(encodeNoticeUrl(normalizedUserEmail, "error", "Invalid migration request."));
    }

    const result = await migrateUserData(targetUserEmail);
    if (!result.ok) {
      redirect(encodeNoticeUrl(targetUserEmail, "error", `Migration failed: ${toUserMessage(result.error)}`));
    }

    const message = `Migration complete: ${result.data.filesTouched.length} file(s) touched, ${result.data.backupsCreated.length} backup(s).`;
    redirect(encodeNoticeUrl(targetUserEmail, "success", message));
  }

  async function backupRepairAllAction(formData: FormData) {
    "use server";
    await ensureMasterAdmin();

    const targetUserEmail = normalizeEmail(String(formData.get("userEmail") ?? ""));
    if (!targetUserEmail.endsWith("@tce.edu")) {
      redirect(encodeNoticeUrl(normalizedUserEmail, "error", "Invalid full repair request."));
    }

    const migration = await migrateUserData(targetUserEmail);
    if (!migration.ok) {
      redirect(encodeNoticeUrl(targetUserEmail, "error", `Repair failed: ${toUserMessage(migration.error)}`));
    }

    const rebuilt = await rebuildUserIndex(targetUserEmail);
    if (!rebuilt.ok) {
      redirect(encodeNoticeUrl(targetUserEmail, "warn", `Stores repaired, but index rebuild failed: ${toUserMessage(rebuilt.error)}`));
    }

    const message = `Backup + repair completed: ${migration.data.filesTouched.length} file(s) touched, ${migration.data.backupsCreated.length} backup(s).`;
    redirect(encodeNoticeUrl(targetUserEmail, "success", message));
  }

  const reportResult = await checkUserIntegrity(normalizedUserEmail);
  const report = reportResult.ok ? reportResult.data : null;
  const reportError = reportResult.ok ? null : toUserMessage(reportResult.error);
  const severity = report ? countBySeverity(report.issues) : { info: 0, warn: 0, error: 0 };

  return (
    <AdminPageShell
      title={`Integrity: ${normalizedUserEmail}`}
      subtitle="Category-store, index, WAL, and attachment metadata checks with repair actions."
      backHref={adminIntegrity()}
      backLabel="Data Integrity"
      icon={ShieldCheck}
    >
      {notice ? <div className={`mb-4 ${getNoticeClass(level)}`}>{notice}</div> : null}

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form id="repair-stores-form" action={repairStoresAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <ConfirmSubmitButton
              formId="repair-stores-form"
              title="Repair all category stores?"
              description="This will rewrite category files for this user after normalization and create backups."
              confirmLabel="Repair Stores"
              variant="destructive"
              className={getButtonClass("context")}
            >
              Repair Stores
            </ConfirmSubmitButton>
          </form>

          <form action={rebuildIndexAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <button type="submit" className={getButtonClass("context")}>
              Rebuild Index
            </button>
          </form>

          <form id="migrate-data-form" action={migrateDataAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <ConfirmSubmitButton
              formId="migrate-data-form"
              title="Run data migrations?"
              description="This may rewrite legacy data files to the latest schema version and create backups."
              confirmLabel="Run Migrations"
              variant="destructive"
              className={getButtonClass("context")}
            >
              Run Migrations
            </ConfirmSubmitButton>
          </form>

          <form id="backup-repair-all-form" action={backupRepairAllAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <ConfirmSubmitButton
              formId="backup-repair-all-form"
              title="Run backup + repair all?"
              description="This creates backups and performs migration plus index rebuild for this user."
              confirmLabel="Backup + Repair All"
              variant="destructive"
              className={getButtonClass("primary")}
            >
              Backup + Repair All
            </ConfirmSubmitButton>
          </form>

          <Link href={adminIntegrityUser(normalizedUserEmail)} className={getButtonClass("ghost")}>
            Refresh Report
          </Link>
        </div>
      </div>

      {reportError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{reportError}</div>
      ) : report ? (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Issues</div>
              <div className="mt-1 text-xl font-semibold">{report.issues.length}</div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="text-xs uppercase tracking-wide text-red-700">Errors</div>
              <div className="mt-1 text-xl font-semibold text-red-800">{severity.error}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs uppercase tracking-wide text-amber-800">Warnings</div>
              <div className="mt-1 text-xl font-semibold text-amber-900">{severity.warn}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Info</div>
              <div className="mt-1 text-xl font-semibold">{severity.info}</div>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">Category Stores</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Category</th>
                    <th className="px-2 py-2 font-medium">Exists</th>
                    <th className="px-2 py-2 font-medium">Legacy</th>
                    <th className="px-2 py-2 font-medium">Entries</th>
                    <th className="px-2 py-2 font-medium">Issues</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_KEYS.map((category) => {
                    const categoryReport = report.perCategory[category];
                    return (
                      <tr key={category} className="border-b border-border/60">
                        <td className="px-2 py-2 font-medium">{category}</td>
                        <td className="px-2 py-2">{categoryReport.exists ? "Yes" : "No"}</td>
                        <td className="px-2 py-2">{categoryReport.legacyFormat ? "Yes" : "No"}</td>
                        <td className="px-2 py-2">{categoryReport.totalEntries}</td>
                        <td className="px-2 py-2">{categoryReport.issues.length}</td>
                        <td className="px-2 py-2">
                          <form id={`repair-category-${category}`} action={repairCategoryAction}>
                            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
                            <input type="hidden" name="category" value={category} />
                            <ConfirmSubmitButton
                              formId={`repair-category-${category}`}
                              title={`Repair ${category} store?`}
                              description="This rewrites the category file after normalization and creates a backup."
                              confirmLabel="Repair Category"
                              variant="destructive"
                              className={getButtonClass("context")}
                            >
                              Repair Category
                            </ConfirmSubmitButton>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-2 text-lg font-semibold tracking-tight">Index Consistency</h2>
              <div className="text-xs text-muted-foreground">{report.indexReport.filePath}</div>
              <div className="mt-2 text-sm">Issues: {report.indexReport.issues.length}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-2 text-lg font-semibold tracking-tight">WAL Sanity</h2>
              <div className="text-xs text-muted-foreground">{report.walReport.filePath}</div>
              <div className="mt-2 text-sm">
                Valid lines: {report.walReport.validLines} • Invalid lines: {report.walReport.invalidLines} • Out-of-order: {report.walReport.outOfOrderLines}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">Detected Issues</h2>
            {report.issues.length === 0 ? (
              <div className="text-sm text-muted-foreground">No integrity issues detected.</div>
            ) : (
              <div className="space-y-2">
                {report.issues.map((issue, index) => (
                  <div key={`${issue.code}:${issue.category ?? ""}:${issue.entryId ?? ""}:${index}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="font-medium">
                      [{issue.severity.toUpperCase()}] {issue.code}
                    </div>
                    <div className="mt-1 text-muted-foreground">{issue.message}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {issue.category ? `Category: ${issue.category} ` : ""}
                      {issue.entryId ? `Entry: ${issue.entryId} ` : ""}
                      {issue.fixAvailable ? "• Fix available" : "• Manual review"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </AdminPageShell>
  );
}
