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
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { getButtonClass } from "@/lib/ui/buttonRoles";

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

  return (
    <AdminPageShell
      title="Backups"
      subtitle="Create and download zipped snapshots of the entire .data store."
      backHref={adminHome()}
      maxWidthClassName="max-w-6xl"
    >
      {status ? (
        <div
          className={
            status === "ok"
              ? "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {message || (status === "ok" ? "Backup operation completed." : "Backup operation failed.")}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.join(" ")}
        </div>
      ) : null}

      <SectionCard>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Retention</div>
            <div className="mt-1 text-sm font-medium">Keep last {BACKUP_KEEP_LAST_DEFAULT} backups</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest Backup</div>
            <div className="mt-1 text-sm font-medium">{latest ? latest.filename : "None"}</div>
            <div className="text-xs text-muted-foreground">{latest ? formatTime(latest.createdAt) : "-"}</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest Size</div>
            <div className="mt-1 text-sm font-medium">{latest ? formatBytes(latest.sizeBytes) : "0 B"}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/backups/download" className={getButtonClass("context")}>
            Download Backup Now
          </Link>
          <form action="/admin/backups/create" method="post">
            <button type="submit" className={getButtonClass("context")}>
              Create Backup On Server
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard title="Stored Backups">

        {backups.length === 0 ? (
          <div className="text-sm text-muted-foreground">No backups found in <code>.data_backups/</code>.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Filename</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium">Size</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.filename} className="border-b border-border/60 align-top">
                    <td className="px-2 py-2">{backup.filename}</td>
                    <td className="px-2 py-2">{formatTime(backup.createdAt)}</td>
                    <td className="px-2 py-2">{formatBytes(backup.sizeBytes)}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/admin/backups/download?filename=${encodeURIComponent(backup.filename)}`}
                        className={getButtonClass("ghost")}
                      >
                        Download
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
