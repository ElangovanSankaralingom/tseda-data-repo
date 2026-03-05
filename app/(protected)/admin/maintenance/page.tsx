import BackTo from "@/components/nav/BackTo";
import { toUserMessage } from "@/lib/errors";
import {
  getLastMaintenanceRun,
  type NightlyMaintenanceSummary,
} from "@/lib/jobs/nightly";
import { adminHome } from "@/lib/navigation";
import { getButtonClass } from "@/lib/ui/buttonRoles";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminMaintenancePageProps = {
  searchParams?: Promise<SearchParams>;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusBadgeClass(status: "ok" | "warn" | "error") {
  if (status === "ok") {
    return "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700";
  }
  if (status === "warn") {
    return "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800";
  }
  return "rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700";
}

function summaryStatus(summary: NightlyMaintenanceSummary) {
  if (summary.overallSuccess) return "ok" as const;
  if (summary.backup.ok || summary.integrity.ok || summary.housekeeping.ok) {
    return "warn" as const;
  }
  return "error" as const;
}

function stepLabel(step: { ok: true } | { ok: false; errorCode: string }) {
  if (step.ok) return "Success";
  return `Failed (${step.errorCode})`;
}

export default async function AdminMaintenancePage({
  searchParams,
}: AdminMaintenancePageProps) {
  const params = searchParams ? await searchParams : {};
  const status = getParam(params, "status");
  const message = getParam(params, "message");

  const lastRunResult = await getLastMaintenanceRun();
  const lastRun = lastRunResult.ok ? lastRunResult.data : null;
  const loadError = lastRunResult.ok ? null : toUserMessage(lastRunResult.error);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={adminHome()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trigger backup and integrity maintenance now, or run it via secure nightly cron.
          </p>
        </div>
      </div>

      {status ? (
        <div
          className={
            status === "ok"
              ? "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : status === "warn"
                ? "mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                : "mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {message || "Maintenance run completed."}
        </div>
      ) : null}

      {loadError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form action="/admin/maintenance/run" method="post">
            <button type="submit" className={getButtonClass("context")}>
              Run Nightly Maintenance Now
            </button>
          </form>
          <span className="text-xs text-muted-foreground">
            Manual run limit: 2 requests per hour.
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-medium">Last Run Summary</div>
        {!lastRun ? (
          <div className="text-sm text-muted-foreground">No maintenance run has been recorded yet.</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Started</div>
                <div className="mt-1 font-medium">{formatDateTime(lastRun.startedAt)}</div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Finished</div>
                <div className="mt-1 font-medium">{formatDateTime(lastRun.finishedAt)}</div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Overall</div>
                <div className="mt-1">
                  <span className={statusBadgeClass(summaryStatus(lastRun))}>
                    {lastRun.overallSuccess ? "Success" : "Partial failure"}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Job</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/60">
                    <td className="px-2 py-2">Nightly Backup</td>
                    <td className="px-2 py-2">{stepLabel(lastRun.backup)}</td>
                    <td className="px-2 py-2">
                      {lastRun.backup.ok
                        ? `${lastRun.backup.data.backupFilename} (${lastRun.backup.data.sizeBytes} bytes)`
                        : lastRun.backup.message}
                    </td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="px-2 py-2">Nightly Integrity Check</td>
                    <td className="px-2 py-2">{stepLabel(lastRun.integrity)}</td>
                    <td className="px-2 py-2">
                      {lastRun.integrity.ok
                        ? `${lastRun.integrity.data.usersScanned} users, ${lastRun.integrity.data.issuesFound} issues, ${lastRun.integrity.data.indexRebuildsSucceeded}/${lastRun.integrity.data.indexRebuildsAttempted} index rebuilds`
                        : lastRun.integrity.message}
                    </td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="px-2 py-2">Export Housekeeping</td>
                    <td className="px-2 py-2">{stepLabel(lastRun.housekeeping)}</td>
                    <td className="px-2 py-2">
                      {lastRun.housekeeping.ok
                        ? `${lastRun.housekeeping.data.tempFilesDeleted} temp file(s) deleted`
                        : lastRun.housekeeping.message}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
