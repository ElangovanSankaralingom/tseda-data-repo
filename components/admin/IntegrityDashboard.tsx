"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HardDrive,
  Layers,
  Scale,
  Link2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Wrench,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { IntegrityReport, CheckCategoryStatus } from "@/lib/integrity/report";
import { useCountUp } from "@/hooks/useCountUp";

type Props = {
  initialReport: IntegrityReport | null;
  initialHistory: IntegrityReport[];
};

// ---------- Personality text ----------

function getHealthMessage(status: IntegrityReport["status"] | null, hasReport: boolean) {
  if (!hasReport) return "Run your first scan to check data health.";
  if (status === "healthy") return "Your data is in perfect shape. Nothing to see here.";
  if (status === "warnings") return "A few things need attention, but nothing scary.";
  return "Some issues need your attention ASAP.";
}

function getRepairMessage() {
  return "All patched up. Your data thanks you.";
}

function getCleanScanMessage() {
  return "Spotless. Not a single issue found.";
}

// ---------- Health Ring SVG ----------

function HealthRing({ percentage, status }: { percentage: number; status: IntegrityReport["status"] | null }) {
  const radius = 70;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const [animatedPct, setAnimatedPct] = useState(0);
  const animatedNumber = useCountUp(percentage, 1000);

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setAnimatedPct(percentage);
    });
    return () => cancelAnimationFrame(timer);
  }, [percentage]);

  const offset = circumference - (animatedPct / 100) * circumference;

  const ringColor =
    status === "healthy" ? "stroke-emerald-500" :
    status === "warnings" ? "stroke-amber-500" :
    status === "critical" ? "stroke-red-500" :
    "stroke-slate-200";

  const textColor =
    status === "healthy" ? "text-emerald-600" :
    status === "warnings" ? "text-amber-600" :
    status === "critical" ? "text-red-600" :
    "text-slate-500";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle
          cx="90" cy="90" r={radius}
          fill="none" stroke="#e2e8f0" strokeWidth={stroke}
        />
        <circle
          cx="90" cy="90" r={radius}
          fill="none"
          className={`${ringColor} transition-all duration-1000 ease-out`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${textColor}`}>{animatedNumber}%</span>
      </div>
    </div>
  );
}

// ---------- Category Card ----------

import { type CategoryCardDef } from "./adminLocalTypes";

const CATEGORIES: CategoryCardDef[] = [
  {
    key: "filesystem",
    label: "File System",
    icon: <HardDrive className="size-5" />,
    accentRing: "hover:ring-blue-200",
    iconBg: "bg-blue-50 text-blue-600",
    passText: "All files healthy",
    failText: "corrupt files",
  },
  {
    key: "structure",
    label: "Data Structure",
    icon: <Layers className="size-5" />,
    accentRing: "hover:ring-violet-200",
    iconBg: "bg-violet-50 text-violet-600",
    passText: "All structures valid",
    failText: "structural issues",
  },
  {
    key: "businessRules",
    label: "Business Rules",
    icon: <Scale className="size-5" />,
    accentRing: "hover:ring-amber-200",
    iconBg: "bg-amber-50 text-amber-600",
    passText: "All rules satisfied",
    failText: "rule violations",
  },
  {
    key: "referential",
    label: "References",
    icon: <Link2 className="size-5" />,
    accentRing: "hover:ring-emerald-200",
    iconBg: "bg-emerald-50 text-emerald-600",
    passText: "All references intact",
    failText: "broken references",
  },
  {
    key: "dataQuality",
    label: "Data Quality",
    icon: <Sparkles className="size-5" />,
    accentRing: "hover:ring-rose-200",
    iconBg: "bg-rose-50 text-rose-600",
    passText: "Data quality excellent",
    failText: "quality concerns",
  },
];

function statusBorderColor(status: CheckCategoryStatus) {
  if (status === "pass") return "border-l-emerald-500";
  if (status === "warn") return "border-l-amber-500";
  return "border-l-red-500";
}

function StatusIcon({ status }: { status: CheckCategoryStatus }) {
  if (status === "pass") return <CheckCircle2 className="size-4 text-emerald-500 animate-scale-in" />;
  if (status === "warn") return <ShieldAlert className="size-4 text-amber-500" />;
  return <ShieldX className="size-4 text-red-500" />;
}

function CategoryCard({
  def,
  check,
  index,
}: {
  def: CategoryCardDef;
  check: IntegrityReport["checks"][keyof IntegrityReport["checks"]] | null;
  index: number;
}) {
  const status = check?.status ?? "pass";
  const issues = check?.issueCount ?? 0;
  const checks = check?.checksRun ?? 0;

  return (
    <div
      className={`group border-l-2 ${statusBorderColor(status)} rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${def.accentRing} animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${def.iconBg} transition-transform duration-200 group-hover:scale-110`}>
          {def.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">{def.label}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <StatusIcon status={status} />
            <span className="text-xs text-slate-600">
              {status === "pass" ? def.passText : `${issues} ${def.failText}`}
            </span>
          </div>
          {checks > 0 ? (
            <div className="mt-1 text-xs text-slate-500">{checks} checks run</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- Scan Progress ----------

function ScanProgress() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative flex items-center justify-center">
        <svg width="180" height="180" className="animate-spin" style={{ animationDuration: "3s" }}>
          <circle cx="90" cy="90" r="70" fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle
            cx="90" cy="90" r="70"
            fill="none"
            className="stroke-blue-500"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 70 * 0.3} ${2 * Math.PI * 70 * 0.7}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <RefreshCw className="size-6 text-blue-500 animate-spin" style={{ animationDuration: "2s" }} />
          <span className="mt-1 text-xs font-medium text-slate-500">Scanning...</span>
        </div>
      </div>
      <div className="text-sm text-slate-500">Checking all users and categories...</div>
    </div>
  );
}

// ---------- User Summary Row ----------

function UserSummaryRow({ summary }: { summary: IntegrityReport["userSummaries"][number] }) {
  const hasErrors = summary.checkFailed || summary.errorCount > 0;
  const hasWarnings = summary.warnCount > 0;
  const dotColor = hasErrors ? "bg-red-500" : hasWarnings ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-1 py-2 last:border-0">
      <div className={`size-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1 text-sm text-slate-700 truncate">
        {summary.userEmail}
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        {summary.errorCount > 0 ? <span className="text-red-600">E:{summary.errorCount}</span> : null}
        {summary.warnCount > 0 ? <span className="text-amber-600">W:{summary.warnCount}</span> : null}
        {summary.infoCount > 0 ? <span>I:{summary.infoCount}</span> : null}
        {summary.totalIssues === 0 ? <span className="text-emerald-600">Clean</span> : null}
        {summary.fixableCount > 0 ? (
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-600">{summary.fixableCount} fixable</span>
        ) : null}
      </div>
    </div>
  );
}

// ---------- History Row ----------

function formatTimeAgo(isoString: string) {
  const ms = Date.now() - Date.parse(isoString);
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function HistoryRow({ report }: { report: IntegrityReport }) {
  const dotColor =
    report.status === "healthy" ? "bg-emerald-500" :
    report.status === "warnings" ? "bg-amber-500" :
    "bg-red-500";

  const totalIssues = report.summary.criticalIssues + report.summary.warnings + report.summary.infoItems;
  const pct = report.summary.totalChecks > 0
    ? Math.round((report.summary.passed / report.summary.totalChecks) * 100)
    : 100;

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-1 py-2.5 last:border-0">
      <div className={`size-2.5 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-700">{pct}% healthy</div>
        <div className="text-xs text-slate-500">
          {formatTimeAgo(report.runAt)} &middot; {totalIssues} issue{totalIssues !== 1 ? "s" : ""} &middot; {report.durationMs}ms
        </div>
      </div>
      <div className="text-xs text-slate-500">
        {report.usersScanned} user{report.usersScanned !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ---------- Repair Summary ----------

function RepairSummary({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 animate-scale-in">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Repair Complete</span>
        </div>
        <button onClick={onClose} className="text-xs text-emerald-600 hover:text-emerald-800">
          Dismiss
        </button>
      </div>
      <div className="text-sm text-emerald-700">{getRepairMessage()}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-emerald-600">
        <div>Fixes: {String(data.totalFixes ?? 0)}</div>
        <div>Files: {String(data.totalFiles ?? 0)}</div>
        <div>Backups: {String(data.totalBackups ?? 0)}</div>
      </div>
    </div>
  );
}

// ---------- Main Dashboard ----------

export default function IntegrityDashboard({ initialReport, initialHistory }: Props) {
  const [report, setReport] = useState(initialReport);
  const [history, setHistory] = useState(initialHistory);
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usersExpanded, setUsersExpanded] = useState(false);

  const hasReport = report !== null;
  const totalIssues = report
    ? report.summary.criticalIssues + report.summary.warnings + report.summary.infoItems
    : 0;
  const healthPct = report && report.summary.totalChecks > 0
    ? Math.round((report.summary.passed / report.summary.totalChecks) * 100)
    : hasReport ? 100 : 0;

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setRepairResult(null);
    try {
      const res = await fetch("/api/admin/integrity/scan", { method: "POST" });
      const body = await res.json() as { data?: IntegrityReport; error?: string };
      if (res.ok && body.data) {
        setReport(body.data);
        // Refresh history
        const histRes = await fetch("/api/admin/integrity/history");
        const histBody = await histRes.json() as { data?: IntegrityReport[] };
        if (histBody.data) setHistory(histBody.data);
      } else {
        setError(body.error ?? "Scan failed");
      }
    } catch {
      setError("Network error during scan");
    } finally {
      setScanning(false);
    }
  }, []);

  const runRepair = useCallback(async () => {
    setRepairing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/integrity/repair", { method: "POST" });
      const body = await res.json() as { data?: Record<string, unknown>; error?: string };
      if (res.ok && body.data) {
        setRepairResult(body.data);
        // Auto-rescan after repair
        void runScan();
      } else {
        setError(body.error ?? "Repair failed");
      }
    } catch {
      setError("Network error during repair");
    } finally {
      setRepairing(false);
    }
  }, [runScan]);

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in-up">
          {error}
        </div>
      ) : null}

      {/* Repair summary */}
      {repairResult ? (
        <RepairSummary data={repairResult} onClose={() => setRepairResult(null)} />
      ) : null}

      {/* Hero: Health Ring + Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-fade-in-up">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          {/* Ring */}
          <div className="shrink-0">
            {scanning ? (
              <ScanProgress />
            ) : (
              <HealthRing
                percentage={hasReport ? healthPct : 0}
                status={report?.status ?? null}
              />
            )}
          </div>

          {/* Right side */}
          <div className="flex-1 text-center sm:text-left">
            {/* Status pill */}
            {hasReport && !scanning ? (
              <div className="mb-2">
                {report.status === "healthy" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="size-3.5" /> All Clear
                  </span>
                ) : report.status === "warnings" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    <ShieldAlert className="size-3.5" /> {totalIssues} Warning{totalIssues !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 animate-subtle-pulse">
                    <ShieldX className="size-3.5" /> Critical Issues
                  </span>
                )}
              </div>
            ) : null}

            {/* Health message */}
            <div className="text-sm text-slate-500 mb-1">
              {scanning
                ? "Running full integrity scan..."
                : getHealthMessage(report?.status ?? null, hasReport)}
            </div>

            {/* Sub stats */}
            {hasReport && !scanning ? (
              <div className="text-xs text-slate-500 mb-4">
                {report.summary.passed} of {report.summary.totalChecks} checks passed &middot;{" "}
                Scanned {formatTimeAgo(report.runAt)} &middot; {report.durationMs}ms
              </div>
            ) : !hasReport && !scanning ? (
              <div className="text-xs text-slate-500 mb-4">Never scanned</div>
            ) : null}

            {/* Action buttons */}
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                disabled={scanning}
                onClick={() => void runScan()}
                className="rounded-xl border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="size-3.5 animate-spin" /> Scanning...
                  </span>
                ) : (
                  "Run Full Scan"
                )}
              </button>
              {report && report.summary.autoFixable > 0 ? (
                <button
                  type="button"
                  disabled={repairing || scanning}
                  onClick={() => void runRepair()}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-medium text-emerald-700 transition-all duration-150 hover:bg-emerald-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {repairing ? (
                    <span className="flex items-center gap-1.5">
                      <Wrench className="size-3.5 animate-spin" /> Repairing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Wrench className="size-3.5" /> Auto-Fix All
                      <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-xs">{report.summary.autoFixable}</span>
                    </span>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Check Categories Grid */}
      {hasReport && !scanning ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((cat, index) => (
            <CategoryCard
              key={cat.key}
              def={cat}
              check={report.checks[cat.key]}
              index={index}
            />
          ))}
        </div>
      ) : null}

      {/* Per-User Results (collapsible) */}
      {hasReport && !scanning && report.userSummaries.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up">
          <button
            type="button"
            onClick={() => setUsersExpanded((prev) => !prev)}
            className="flex w-full items-center gap-2 text-sm font-semibold text-slate-800"
          >
            {usersExpanded ? <ChevronDown className="size-4 text-slate-500" /> : <ChevronRight className="size-4 text-slate-500" />}
            Per-User Results ({report.userSummaries.length} users)
          </button>
          {usersExpanded ? (
            <div className="mt-3">
              {report.userSummaries.map((summary) => (
                <UserSummaryRow key={summary.userEmail} summary={summary} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Clean scan celebration */}
      {hasReport && !scanning && totalIssues === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center animate-scale-in">
          <ShieldCheck className="mx-auto size-8 text-emerald-500 mb-2" />
          <div className="text-sm font-medium text-emerald-700">{getCleanScanMessage()}</div>
        </div>
      ) : null}

      {/* Scan History */}
      {history.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Clock className="size-4 text-slate-500" />
            Scan History
          </div>
          {history.map((h) => (
            <HistoryRow key={h.id} report={h} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
