import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import SectionCard from "@/components/layout/SectionCard";
import { authOptions } from "@/lib/auth";
import { canManageBackups } from "@/lib/admin/roles";
import {
  BACKUP_KEEP_LAST_DEFAULT,
  getLatestBackupFile,
  listBackups,
} from "@/lib/backup/backupService";
import { toUserMessage } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminBackupsCreate, adminBackupsDownload, adminHome, dashboard } from "@/lib/entryNavigation";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminBackupsPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default async function AdminBackupsPage({
  searchParams,
}: AdminBackupsPageProps) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageBackups(email)) {
    redirect(dashboard());
  }

  const params = searchParams ? await searchParams : {};
  const status = getParam(params, "status");
  const message = getParam(params, "message");

  const backupsResult = await listBackups();
  const latestResult = await getLatestBackupFile();

  const backups = backupsResult.ok ? backupsResult.data : [];
  const latest = latestResult.ok ? latestResult.data : null;
  const errors = [
    backupsResult.ok ? null : toUserMessage(backupsResult.error),
    latestResult.ok ? null : toUserMessage(latestResult.error),
  ].filter((item): item is string => !!item);

  const s = (key: Parameters<typeof t>[0]) => t(key, "en");

  return (
    <AdminPageShell
      titleKey="adminPages.backupsTitle"
      subtitleKey="adminPages.backupsSubtitle"
      backHref={adminHome()}
      iconName="Shield"
      maxWidthClassName="max-w-6xl"
    >
      {status ? (
        <div
          className={
            status === "ok"
              ? "mb-4 rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 px-3 py-2 text-sm text-[var(--color-success)]"
              : "mb-4 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]"
          }
        >
          {message || (status === "ok" ? s("adminPages.backupSuccessDefault") : s("adminPages.backupFailDefault"))}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="mb-4 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
          {errors.join(" ")}
        </div>
      ) : null}

      <SectionCard>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-glass-border)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{s("adminPages.retention")}</div>
            <div className="mt-1 text-sm font-medium">{s("adminPages.keepLastBackups").replace("{count}", String(BACKUP_KEEP_LAST_DEFAULT))}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{s("adminPages.latestBackup")}</div>
            <div className="mt-1 text-sm font-medium">{latest ? latest.filename : s("adminPages.none")}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{latest ? formatTime(latest.createdAt) : "-"}</div>
          </div>
          <div className="rounded-xl border border-[var(--color-glass-border)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{s("adminPages.latestSize")}</div>
            <div className="mt-1 text-sm font-medium">{latest ? formatBytes(latest.sizeBytes) : "0 B"}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={adminBackupsDownload()} className={getButtonClass("context")}>
            {s("adminPages.downloadBackupNow")}
          </Link>
          <form action={adminBackupsCreate()} method="post">
            <button type="submit" className={getButtonClass("context")}>
              {s("adminPages.createBackupOnServer")}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard title={s("adminPages.storedBackups")}>

        {backups.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">{s("adminPages.noBackupsFound")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-glass-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-2 py-2 font-medium">{s("adminPages.filename")}</th>
                  <th className="px-2 py-2 font-medium">{s("adminPages.created")}</th>
                  <th className="px-2 py-2 font-medium">{s("adminPages.size")}</th>
                  <th className="px-2 py-2 font-medium">{s("adminPages.action")}</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.filename} className="border-b border-[var(--color-glass-border)]/60 align-top">
                    <td className="px-2 py-2">{backup.filename}</td>
                    <td className="px-2 py-2">{formatTime(backup.createdAt)}</td>
                    <td className="px-2 py-2">{formatBytes(backup.sizeBytes)}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={adminBackupsDownload(backup.filename)}
                        className={getButtonClass("ghost")}
                      >
                        {s("adminPages.download")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AdminPageShell>
  );
}
