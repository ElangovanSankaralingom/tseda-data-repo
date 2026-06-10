import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { t } from "@/lib/i18n";

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
    return "rounded-lg border border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] px-3 py-2 text-sm text-[var(--color-status-success)]";
  }
  if (level === "warn") {
    return "rounded-lg border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-3 py-2 text-sm text-[var(--color-status-warning)]";
  }
  if (level === "error") {
    return "rounded-lg border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-sm text-[var(--color-status-error)]";
  }
  return "rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass-hover)]/30 px-3 py-2 text-sm text-[var(--color-text-muted)]";
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

  if (!normalizedUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center gap-3">
          <BackTo href={adminIntegrity()} label={t("adminIntegrity.userBackLabel", "en")} />
          <h1 className="text-2xl font-semibold tracking-tight">{t("adminIntegrity.userIntegrityCheck", "en")}</h1>
        </div>
        <div className="rounded-lg border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-sm text-[var(--color-status-error)]">
          {t("adminIntegrity.userInvalidEmail", "en")}
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
    if (!targetUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX) || !isCategoryKey(category)) {
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
    if (!targetUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
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
    if (!targetUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
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
    if (!targetUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
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
    if (!targetUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
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
      title={`${t("adminIntegrity.userTitlePrefix", "en")}: ${normalizedUserEmail}`}
      subtitle={t("adminIntegrity.userPageSubtitle", "en")}
      backHref={adminIntegrity()}
      backLabel={t("adminPages.integrityTitle", "en")}
      iconName="ShieldCheck"
    >
      {notice ? <div className={`mb-4 ${getNoticeClass(level)}`}>{notice}</div> : null}

      <div className="mb-4 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form id="repair-stores-form" action={repairStoresAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <ConfirmSubmitButton
              formId="repair-stores-form"
              title={t("adminIntegrity.confirmRepairStoresTitle", "en")}
              description={t("adminIntegrity.confirmRepairStoresDesc", "en")}
              confirmLabel={t("adminIntegrity.repairStores", "en")}
              variant="destructive"
              className={getButtonClass("context")}
            >
              {t("adminIntegrity.repairStores", "en")}
            </ConfirmSubmitButton>
          </form>

          <form action={rebuildIndexAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <button type="submit" className={getButtonClass("context")}>
              {t("adminIntegrity.rebuildIndex", "en")}
            </button>
          </form>

          <form id="migrate-data-form" action={migrateDataAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <ConfirmSubmitButton
              formId="migrate-data-form"
              title={t("adminIntegrity.confirmMigrateTitle", "en")}
              description={t("adminIntegrity.confirmMigrateDesc", "en")}
              confirmLabel={t("adminIntegrity.runMigrations", "en")}
              variant="destructive"
              className={getButtonClass("context")}
            >
              {t("adminIntegrity.runMigrations", "en")}
            </ConfirmSubmitButton>
          </form>

          <form id="backup-repair-all-form" action={backupRepairAllAction}>
            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
            <ConfirmSubmitButton
              formId="backup-repair-all-form"
              title={t("adminIntegrity.confirmBackupRepairTitle", "en")}
              description={t("adminIntegrity.confirmBackupRepairDesc", "en")}
              confirmLabel={t("adminIntegrity.backupRepairAll", "en")}
              variant="destructive"
              className={getButtonClass("primary")}
            >
              {t("adminIntegrity.backupRepairAll", "en")}
            </ConfirmSubmitButton>
          </form>

          <Link href={adminIntegrityUser(normalizedUserEmail)} className={getButtonClass("ghost")}>
            {t("adminIntegrity.refreshReport", "en")}
          </Link>
        </div>
      </div>

      {reportError ? (
        <div className="rounded-lg border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-sm text-[var(--color-status-error)]">{reportError}</div>
      ) : report ? (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{t("adminIntegrity.totalIssues", "en")}</div>
              <div className="mt-1 text-xl font-semibold">{report.issues.length}</div>
            </div>
            <div className="rounded-xl border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--color-status-error)]">{t("adminIntegrity.errors", "en")}</div>
              <div className="mt-1 text-xl font-semibold text-[var(--color-status-error)]">{severity.error}</div>
            </div>
            <div className="rounded-xl border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--color-status-warning)]">{t("adminIntegrity.warnings", "en")}</div>
              <div className="mt-1 text-xl font-semibold text-[var(--color-status-warning)]">{severity.warn}</div>
            </div>
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-3">
              <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{t("adminIntegrity.info", "en")}</div>
              <div className="mt-1 text-xl font-semibold">{severity.info}</div>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-4">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{t("adminIntegrity.categoryStores", "en")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-glass-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="px-2 py-2 font-medium">{t("adminPages.category", "en")}</th>
                    <th className="px-2 py-2 font-medium">{t("adminIntegrity.colExists", "en")}</th>
                    <th className="px-2 py-2 font-medium">{t("adminIntegrity.colLegacy", "en")}</th>
                    <th className="px-2 py-2 font-medium">{t("adminIntegrity.colEntries", "en")}</th>
                    <th className="px-2 py-2 font-medium">{t("adminIntegrity.colIssues", "en")}</th>
                    <th className="px-2 py-2 font-medium">{t("adminIntegrity.colActions", "en")}</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_KEYS.map((category) => {
                    const categoryReport = report.perCategory[category];
                    return (
                      <tr key={category} className="border-b border-[var(--color-glass-border)]/60">
                        <td className="px-2 py-2 font-medium">{category}</td>
                        <td className="px-2 py-2">{categoryReport.exists ? t("common.yes", "en") : t("common.no", "en")}</td>
                        <td className="px-2 py-2">{categoryReport.legacyFormat ? t("common.yes", "en") : t("common.no", "en")}</td>
                        <td className="px-2 py-2">{categoryReport.totalEntries}</td>
                        <td className="px-2 py-2">{categoryReport.issues.length}</td>
                        <td className="px-2 py-2">
                          <form id={`repair-category-${category}`} action={repairCategoryAction}>
                            <input type="hidden" name="userEmail" value={normalizedUserEmail} />
                            <input type="hidden" name="category" value={category} />
                            <ConfirmSubmitButton
                              formId={`repair-category-${category}`}
                              title={t("adminIntegrity.confirmRepairCategoryTitle", "en").replace("{category}", category)}
                              description={t("adminIntegrity.confirmRepairCategoryDesc", "en")}
                              confirmLabel={t("adminIntegrity.repairCategory", "en")}
                              variant="destructive"
                              className={getButtonClass("context")}
                            >
                              {t("adminIntegrity.repairCategory", "en")}
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
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-4">
              <h2 className="mb-2 text-lg font-semibold tracking-tight">{t("adminIntegrity.indexConsistency", "en")}</h2>
              <div className="text-xs text-[var(--color-text-muted)]">{report.indexReport.filePath}</div>
              <div className="mt-2 text-sm">{t("adminIntegrity.issuesCount", "en").replace("{count}", String(report.indexReport.issues.length))}</div>
            </div>
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-4">
              <h2 className="mb-2 text-lg font-semibold tracking-tight">{t("adminIntegrity.walSanity", "en")}</h2>
              <div className="text-xs text-[var(--color-text-muted)]">{report.walReport.filePath}</div>
              <div className="mt-2 text-sm">
                {t("adminIntegrity.walStats", "en")
                  .replace("{valid}", String(report.walReport.validLines))
                  .replace("{invalid}", String(report.walReport.invalidLines))
                  .replace("{order}", String(report.walReport.outOfOrderLines))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-4">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{t("adminIntegrity.detectedIssues", "en")}</h2>
            {report.issues.length === 0 ? (
              <div className="text-sm text-[var(--color-text-muted)]">{t("adminIntegrity.noIssuesDetected", "en")}</div>
            ) : (
              <div className="space-y-2">
                {report.issues.map((issue, index) => (
                  <div key={`${issue.code}:${issue.category ?? ""}:${issue.entryId ?? ""}:${index}`} className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-sm">
                    <div className="font-medium">
                      [{issue.severity.toUpperCase()}] {issue.code}
                    </div>
                    <div className="mt-1 text-[var(--color-text-muted)]">{issue.message}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {issue.category ? `${t("adminIntegrity.categoryPrefix", "en")} ${issue.category} ` : ""}
                      {issue.entryId ? `${t("adminIntegrity.entryPrefix", "en")} ${issue.entryId} ` : ""}
                      {issue.fixAvailable ? t("adminIntegrity.fixAvailable", "en") : t("adminIntegrity.manualReview", "en")}
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
