"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  Database,
  HardDrive,
  Shield,
  Trash2,
  FileArchive,
  RefreshCw,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Users,
  Server,
} from "lucide-react";
import type { NightlyMaintenanceSummary } from "@/lib/jobs/nightly";
import type { SystemStats } from "@/lib/maintenance/stats";
import type { MaintenanceAction } from "@/lib/maintenance/log";
import { useCountUp } from "@/hooks/useCountUp";
import { formatNumber } from "@/lib/i18n/locale";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Props = {
  lastRun: NightlyMaintenanceSummary | null;
  stats: SystemStats | null;
  actionLog: MaintenanceAction[];
};

import { type JobDef } from "./adminLocalTypes";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTimeAgo(isoString: string) {
  const ms = Date.now() - Date.parse(isoString);
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function StatTile({ icon, label, value, sub, accent = "var(--color-primary)" }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--color-text-on-accent)] transition-transform duration-200 group-hover:scale-110"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</div>
        <div className="text-lg font-bold text-[var(--color-text-primary)]">{value}</div>
        {sub ? <div className="text-xs text-[var(--color-text-secondary)]">{sub}</div> : null}
      </div>
    </div>
  );
}

function AnimatedStatTile({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: number; sub?: string; accent?: string }) {
  const animated = useCountUp(value);
  return <StatTile icon={icon} label={label} value={formatNumber(animated, "en")} sub={sub} accent={accent} />;
}

function LastRunBadge({ lastRun }: { lastRun: NightlyMaintenanceSummary | null }) {
  const { t } = useTranslation();
  if (!lastRun) {
    return (
      <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)]">
        {t("adminMaintenance.noRunsYet")}
      </span>
    );
  }

  const isOk = lastRun.overallSuccess;
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        isOk
          ? "border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]"
          : "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]"
      }`}
    >
      {isOk ? t("adminMaintenance.allSystemsHealthy") : t("adminMaintenance.partialFailure")} &middot; {formatTimeAgo(lastRun.finishedAt)}
    </span>
  );
}

const NightlyStepRow = memo(function NightlyStepRow({ label, step }: { label: string; step: { ok: true; data: Record<string, unknown> } | { ok: false; errorCode: string; message: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-card-bg)] px-3 py-2">
      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
      {step.ok ? (
        <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-status-success)]">
          <CheckCircle2 className="size-3.5" /> OK
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-status-error)]" title={step.message}>
          <XCircle className="size-3.5" /> {step.errorCode}
        </span>
      )}
    </div>
  );
});

const ActionLogRow = memo(function ActionLogRow({ entry }: { entry: MaintenanceAction }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-glass-border)] px-1 py-2.5 last:border-0">
      <div className={`flex size-6 shrink-0 items-center justify-center rounded-full ${entry.success ? "bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]" : "bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]"}`}>
        {entry.success ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{entry.action}</div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {entry.actorEmail.split("@")[0]} &middot; {formatTimeAgo(entry.ts)} &middot; {entry.durationMs}ms
        </div>
      </div>
    </div>
  );
});

export default function MaintenanceDashboard({ lastRun, stats, actionLog }: Props) {
  const { t } = useTranslation();
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const JOBS: JobDef[] = useMemo(() => [
    {
      id: "backup",
      label: t("adminMaintenance.jobBackup"),
      description: t("adminMaintenance.jobBackupDesc"),
      icon: <FileArchive className="size-5" />,
      endpoint: "/api/admin/maintenance/backup",
      method: "POST",
      accent: "hover:ring-[var(--color-status-info-border)]",
      iconBg: "bg-[var(--color-status-info-bg)] text-[var(--color-status-info)]",
    },
    {
      id: "integrity-check",
      label: t("adminMaintenance.jobIntegrityCheck"),
      description: t("adminMaintenance.jobIntegrityCheckDesc"),
      icon: <Shield className="size-5" />,
      endpoint: "/api/admin/maintenance/integrity-check",
      method: "POST",
      accent: "hover:ring-[var(--color-status-success-border)]",
      iconBg: "bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]",
    },
    {
      id: "wal-compact",
      label: t("adminMaintenance.jobWalCompact"),
      description: t("adminMaintenance.jobWalCompactDesc"),
      icon: <Database className="size-5" />,
      endpoint: "/api/admin/maintenance/wal-compact",
      method: "POST",
      accent: "hover:ring-[var(--color-status-warning-border)]",
      iconBg: "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]",
    },
    {
      id: "cleanup",
      label: t("adminMaintenance.jobCleanup"),
      description: t("adminMaintenance.jobCleanupDesc"),
      icon: <Trash2 className="size-5" />,
      endpoint: "/api/admin/maintenance/cleanup",
      method: "POST",
      accent: "hover:ring-[var(--color-status-error-border)]",
      iconBg: "bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]",
    },
    {
      id: "rebuild-indexes",
      label: t("adminMaintenance.jobRebuildIndexes"),
      description: t("adminMaintenance.jobRebuildIndexesDesc"),
      icon: <RefreshCw className="size-5" />,
      endpoint: "/api/admin/maintenance/rebuild-indexes",
      method: "POST",
      accent: "hover:ring-[var(--color-palette-violet-border)]",
      iconBg: "bg-[var(--color-palette-violet-bg)] text-[var(--color-palette-violet-fg)]",
    },
    {
      id: "migrate",
      label: t("adminMaintenance.jobRunMigrations"),
      description: t("adminMaintenance.jobRunMigrationsDesc"),
      icon: <ArrowUpDown className="size-5" />,
      endpoint: "/api/admin/maintenance/migrate",
      method: "POST",
      accent: "hover:ring-[var(--color-palette-indigo-border)]",
      iconBg: "bg-[var(--color-palette-indigo-bg)] text-[var(--color-palette-indigo-fg)]",
    },
  ], [t]);

  const runJob = useCallback(async (job: JobDef) => {
    setRunning((prev) => ({ ...prev, [job.id]: true }));
    setResults((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });

    try {
      const res = await fetch(job.endpoint, { method: job.method });
      const body = await res.json() as { data?: unknown; error?: string };
      if (res.ok) {
        setResults((prev) => ({ ...prev, [job.id]: { ok: true, message: t("adminMaintenance.completedSuccessfully") } }));
      } else {
        setResults((prev) => ({ ...prev, [job.id]: { ok: false, message: body.error ?? t("adminMaintenance.unknownError") } }));
      }
    } catch {
      setResults((prev) => ({ ...prev, [job.id]: { ok: false, message: t("adminMaintenance.networkError") } }));
    } finally {
      setRunning((prev) => ({ ...prev, [job.id]: false }));
    }
  }, [t]);

  return (
    <div className="space-y-6">
      {/* System Health Strip */}
      <div className="flex flex-wrap items-center gap-3">
        <LastRunBadge lastRun={lastRun} />
        {lastRun ? (
          <span className="text-xs text-[var(--color-text-secondary)]">
            Last run: {new Date(lastRun.finishedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {/* Stats Grid */}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedStatTile
            icon={<Users className="size-5" />}
            label={t("adminMaintenance.statsUsers")}
            value={stats.users.total}
            accent="var(--color-status-info)"
          />
          <AnimatedStatTile
            icon={<HardDrive className="size-5" />}
            label={t("adminMaintenance.statsDataStore")}
            value={stats.storage.dataBytes}
            sub={formatBytes(stats.storage.dataBytes)}
            accent="var(--color-primary)"
          />
          <AnimatedStatTile
            icon={<Server className="size-5" />}
            label={t("adminMaintenance.statsWalFiles")}
            value={stats.wal.totalFiles}
            sub={formatBytes(stats.wal.totalBytes)}
            accent="var(--color-status-warning)"
          />
          <StatTile
            icon={<FileArchive className="size-5" />}
            label={t("adminMaintenance.statsBackups")}
            value={String(stats.backups.total)}
            sub={stats.backups.latestAt ? `${t("adminMaintenance.statsLatest")} ${formatTimeAgo(stats.backups.latestAt)}` : t("adminMaintenance.statsNoneYet")}
            accent="var(--color-status-success)"
          />
        </div>
      ) : null}

      {/* Last Nightly Run Summary */}
      {lastRun ? (
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Activity className="size-4 text-[var(--color-text-secondary)]" />
            {t("adminMaintenance.lastNightlyRun")}
          </div>
          <div className="space-y-2">
            <NightlyStepRow label={t("adminMaintenance.nightlyBackup")} step={lastRun.backup} />
            <NightlyStepRow label={t("adminMaintenance.nightlyIntegrityCheck")} step={lastRun.integrity} />
            <NightlyStepRow label={t("adminMaintenance.nightlyExportHousekeeping")} step={lastRun.housekeeping} />
            {lastRun.autoArchive ? <NightlyStepRow label={t("adminMaintenance.nightlyAutoArchive")} step={lastRun.autoArchive} /> : null}
            {lastRun.editGrantExpiry ? <NightlyStepRow label={t("adminMaintenance.nightlyEditGrantExpiry")} step={lastRun.editGrantExpiry} /> : null}
            {lastRun.timerWarnings ? <NightlyStepRow label={t("adminMaintenance.nightlyTimerWarnings")} step={lastRun.timerWarnings} /> : null}
            {lastRun.walCompaction ? <NightlyStepRow label={t("adminMaintenance.nightlyWalCompaction")} step={lastRun.walCompaction} /> : null}
          </div>
        </div>
      ) : null}

      {/* Job Controls */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          <Server className="size-4 text-[var(--color-text-secondary)]" />
          {t("adminMaintenance.maintenanceJobs")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOBS.map((job, index) => (
            <div
              key={job.id}
              className={`group relative rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${job.accent} animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${job.iconBg} transition-transform duration-200 group-hover:scale-110`}>
                  {job.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">{job.label}</div>
                  <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{job.description}</div>
                </div>
              </div>

              {results[job.id] ? (
                <div className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  results[job.id].ok
                    ? "border border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]"
                    : "border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]"
                }`}>
                  {results[job.id].message}
                </div>
              ) : null}

              <button
                type="button"
                disabled={running[job.id]}
                onClick={() => void runJob(job)}
                className="mt-3 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-all duration-150 hover:bg-[var(--color-dropdown-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running[job.id] ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <RefreshCw className="size-3 animate-spin" />
                    {t("adminMaintenance.running")}
                  </span>
                ) : (
                  t("adminMaintenance.runNow")
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Run Full Nightly */}
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <form action="/admin/maintenance/run" method="post">
            <button
              type="submit"
              className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-button-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--color-button-primary-text)] transition-all duration-150 hover:bg-[var(--color-button-primary-hover)] active:scale-[0.97]"
            >
              {t("adminMaintenance.runFullNightly")}
            </button>
          </form>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {t("adminMaintenance.runFullNightlyDesc")}
          </span>
        </div>
      </div>

      {/* Action History */}
      {actionLog.length > 0 ? (
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Clock className="size-4 text-[var(--color-text-secondary)]" />
            {t("adminMaintenance.recentActions")}
          </div>
          <div className="divide-y-0">
            {actionLog.map((entry, i) => (
              <ActionLogRow key={`${entry.ts}-${i}`} entry={entry} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
