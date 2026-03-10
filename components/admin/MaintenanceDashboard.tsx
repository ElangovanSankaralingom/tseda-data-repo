"use client";

import { useCallback, useState } from "react";
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

type Props = {
  lastRun: NightlyMaintenanceSummary | null;
  stats: SystemStats | null;
  actionLog: MaintenanceAction[];
};

import { type JobDef } from "./adminLocalTypes";

const JOBS: JobDef[] = [
  {
    id: "backup",
    label: "Backup",
    description: "Create a full .data backup zip",
    icon: <FileArchive className="size-5" />,
    endpoint: "/api/admin/maintenance/backup",
    method: "POST",
    accent: "hover:ring-blue-200",
    iconBg: "bg-blue-50 text-blue-600",
  },
  {
    id: "integrity-check",
    label: "Integrity Check",
    description: "Scan all users for data issues",
    icon: <Shield className="size-5" />,
    endpoint: "/api/admin/maintenance/integrity-check",
    method: "POST",
    accent: "hover:ring-emerald-200",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "wal-compact",
    label: "WAL Compact",
    description: "Trim old event log entries",
    icon: <Database className="size-5" />,
    endpoint: "/api/admin/maintenance/wal-compact",
    method: "POST",
    accent: "hover:ring-amber-200",
    iconBg: "bg-amber-50 text-amber-600",
  },
  {
    id: "cleanup",
    label: "Cleanup",
    description: "Remove temp files and empty dirs",
    icon: <Trash2 className="size-5" />,
    endpoint: "/api/admin/maintenance/cleanup",
    method: "POST",
    accent: "hover:ring-red-200",
    iconBg: "bg-red-50 text-red-600",
  },
  {
    id: "rebuild-indexes",
    label: "Rebuild Indexes",
    description: "Rebuild user index files from stores",
    icon: <RefreshCw className="size-5" />,
    endpoint: "/api/admin/maintenance/rebuild-indexes",
    method: "POST",
    accent: "hover:ring-violet-200",
    iconBg: "bg-violet-50 text-violet-600",
  },
  {
    id: "migrate",
    label: "Run Migrations",
    description: "Apply data migrations to all users",
    icon: <ArrowUpDown className="size-5" />,
    endpoint: "/api/admin/maintenance/migrate",
    method: "POST",
    accent: "hover:ring-indigo-200",
    iconBg: "bg-indigo-50 text-indigo-600",
  },
];

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

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-transform duration-200 group-hover:scale-110">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-lg font-bold text-slate-900">{value}</div>
        {sub ? <div className="text-xs text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}

function AnimatedStatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  const animated = useCountUp(value);
  return <StatTile icon={icon} label={label} value={animated.toLocaleString("en-IN")} sub={sub} />;
}

function LastRunBadge({ lastRun }: { lastRun: NightlyMaintenanceSummary | null }) {
  if (!lastRun) {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
        No runs yet
      </span>
    );
  }

  const isOk = lastRun.overallSuccess;
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        isOk
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {isOk ? "All systems healthy" : "Partial failure"} &middot; {formatTimeAgo(lastRun.finishedAt)}
    </span>
  );
}

function NightlyStepRow({ label, step }: { label: string; step: { ok: true; data: Record<string, unknown> } | { ok: false; errorCode: string; message: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      {step.ok ? (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="size-3.5" /> OK
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-medium text-red-600" title={step.message}>
          <XCircle className="size-3.5" /> {step.errorCode}
        </span>
      )}
    </div>
  );
}

function ActionLogRow({ entry }: { entry: MaintenanceAction }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-1 py-2.5 last:border-0">
      <div className={`flex size-6 shrink-0 items-center justify-center rounded-full ${entry.success ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500"}`}>
        {entry.success ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-700">{entry.action}</div>
        <div className="text-xs text-slate-500">
          {entry.actorEmail.split("@")[0]} &middot; {formatTimeAgo(entry.ts)} &middot; {entry.durationMs}ms
        </div>
      </div>
    </div>
  );
}

export default function MaintenanceDashboard({ lastRun, stats, actionLog }: Props) {
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});

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
        setResults((prev) => ({ ...prev, [job.id]: { ok: true, message: "Completed successfully" } }));
      } else {
        setResults((prev) => ({ ...prev, [job.id]: { ok: false, message: body.error ?? "Unknown error" } }));
      }
    } catch {
      setResults((prev) => ({ ...prev, [job.id]: { ok: false, message: "Network error" } }));
    } finally {
      setRunning((prev) => ({ ...prev, [job.id]: false }));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* System Health Strip */}
      <div className="flex flex-wrap items-center gap-3">
        <LastRunBadge lastRun={lastRun} />
        {lastRun ? (
          <span className="text-xs text-slate-500">
            Last run: {new Date(lastRun.finishedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {/* Stats Grid */}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedStatTile
            icon={<Users className="size-5" />}
            label="Users"
            value={stats.users.total}
          />
          <AnimatedStatTile
            icon={<HardDrive className="size-5" />}
            label="Data Store"
            value={stats.storage.dataBytes}
            sub={formatBytes(stats.storage.dataBytes)}
          />
          <AnimatedStatTile
            icon={<Server className="size-5" />}
            label="WAL Files"
            value={stats.wal.totalFiles}
            sub={formatBytes(stats.wal.totalBytes)}
          />
          <StatTile
            icon={<FileArchive className="size-5" />}
            label="Backups"
            value={String(stats.backups.total)}
            sub={stats.backups.latestAt ? `Latest: ${formatTimeAgo(stats.backups.latestAt)}` : "None yet"}
          />
        </div>
      ) : null}

      {/* Last Nightly Run Summary */}
      {lastRun ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Activity className="size-4 text-slate-500" />
            Last Nightly Run
          </div>
          <div className="space-y-2">
            <NightlyStepRow label="Backup" step={lastRun.backup} />
            <NightlyStepRow label="Integrity Check" step={lastRun.integrity} />
            <NightlyStepRow label="Export Housekeeping" step={lastRun.housekeeping} />
            {lastRun.autoArchive ? <NightlyStepRow label="Auto-Archive" step={lastRun.autoArchive} /> : null}
            {lastRun.editGrantExpiry ? <NightlyStepRow label="Edit Grant Expiry" step={lastRun.editGrantExpiry} /> : null}
            {lastRun.timerWarnings ? <NightlyStepRow label="Timer Warnings" step={lastRun.timerWarnings} /> : null}
            {lastRun.walCompaction ? <NightlyStepRow label="WAL Compaction" step={lastRun.walCompaction} /> : null}
          </div>
        </div>
      ) : null}

      {/* Job Controls */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Server className="size-4 text-slate-500" />
          Maintenance Jobs
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOBS.map((job, index) => (
            <div
              key={job.id}
              className={`group relative rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${job.accent} animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${job.iconBg} transition-transform duration-200 group-hover:scale-110`}>
                  {job.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">{job.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{job.description}</div>
                </div>
              </div>

              {results[job.id] ? (
                <div className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  results[job.id].ok
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}>
                  {results[job.id].message}
                </div>
              ) : null}

              <button
                type="button"
                disabled={running[job.id]}
                onClick={() => void runJob(job)}
                className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running[job.id] ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <RefreshCw className="size-3 animate-spin" />
                    Running...
                  </span>
                ) : (
                  "Run Now"
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Run Full Nightly */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <form action="/admin/maintenance/run" method="post">
            <button
              type="submit"
              className="rounded-xl border border-[#1E3A5F] bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-[#162d4a] active:scale-[0.97]"
            >
              Run Full Nightly Maintenance
            </button>
          </form>
          <span className="text-xs text-slate-500">
            Runs backup + integrity check + housekeeping + auto-archive + edit grant expiry in sequence. Rate limited to 2/hour.
          </span>
        </div>
      </div>

      {/* Action History */}
      {actionLog.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Clock className="size-4 text-slate-500" />
            Recent Actions
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
