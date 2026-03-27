"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { useTranslation } from "@/lib/i18n/useTranslation";

type Props = {
  initialReport: IntegrityReport | null;
  initialHistory: IntegrityReport[];
};

// ---------- Personality text ----------
// These are now resolved via t() in components that use them

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
    "stroke-[var(--color-card-border)]";

  const textColor =
    status === "healthy" ? "text-emerald-600" :
    status === "warnings" ? "text-amber-600" :
    status === "critical" ? "text-red-600" :
    "text-[var(--color-text-secondary)]";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle
          cx="90" cy="90" r={radius}
          fill="none" stroke="var(--color-card-border)" strokeWidth={stroke}
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

const CategoryCard = memo(function CategoryCard({
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
      className={`group border-l-2 ${statusBorderColor(status)} rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${def.accentRing} animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${def.iconBg} transition-transform duration-200 group-hover:scale-110`}>
          {def.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{def.label}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <StatusIcon status={status} />
            <span className="text-xs text-[var(--color-text-secondary)]">
              {status === "pass" ? def.passText : `${issues} ${def.failText}`}
            </span>
          </div>
          {checks > 0 ? (
            <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{checks} checks run</div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

// ---------- Scan Progress ----------

function ScanProgress() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative flex items-center justify-center">
        <svg width="180" height="180" className="animate-spin" style={{ animationDuration: "3s" }}>
          <circle cx="90" cy="90" r="70" fill="none" stroke="var(--color-card-border)" strokeWidth="8" />
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
          <span className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">{t("adminIntegrity.scanning")}</span>
        </div>
      </div>
      <div className="text-sm text-[var(--color-text-secondary)]">{t("adminIntegrity.checkingAllUsers")}</div>
    </div>
  );
}

// ---------- User Summary Row ----------

const UserSummaryRow = memo(function UserSummaryRow({ summary }: { summary: IntegrityReport["userSummaries"][number] }) {
  const hasErrors = summary.checkFailed || summary.errorCount > 0;
  const hasWarnings = summary.warnCount > 0;
  const dotColor = hasErrors ? "bg-red-500/15" : hasWarnings ? "bg-amber-500/15" : "bg-emerald-500/15";

  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-card-border)] px-1 py-2 last:border-0">
      <div className={`size-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1 text-sm text-[var(--color-text-primary)] truncate">
        {summary.userEmail}
      </div>
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
        {summary.errorCount > 0 ? <span className="text-red-600">E:{summary.errorCount}</span> : null}
        {summary.warnCount > 0 ? <span className="text-amber-600">W:{summary.warnCount}</span> : null}
        {summary.infoCount > 0 ? <span>I:{summary.infoCount}</span> : null}
        {summary.totalIssues === 0 ? <span className="text-emerald-600">Clean</span> : null}
        {summary.fixableCount > 0 ? (
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">{summary.fixableCount} fixable</span>
        ) : null}
      </div>
    </div>
  );
});

// ---------- History Row ----------

function formatTimeAgo(isoString: string) {
  const ms = Date.now() - Date.parse(isoString);
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

const HistoryRow = memo(function HistoryRow({ report }: { report: IntegrityReport }) {
  const dotColor =
    report.status === "healthy" ? "bg-emerald-500/15" :
    report.status === "warnings" ? "bg-amber-500/15" :
    "bg-red-500/15";

  const totalIssues = report.summary.criticalIssues + report.summary.warnings + report.summary.infoItems;
  const pct = report.summary.totalChecks > 0
    ? Math.round((report.summary.passed / report.summary.totalChecks) * 100)
    : 100;

  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-card-border)] px-1 py-2.5 last:border-0">
      <div className={`size-2.5 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{pct}% healthy</div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {formatTimeAgo(report.runAt)} &middot; {totalIssues} issue{totalIssues !== 1 ? "s" : ""} &middot; {report.durationMs}ms
        </div>
      </div>
      <div className="text-xs text-[var(--color-text-secondary)]">
        {report.usersScanned} user{report.usersScanned !== 1 ? "s" : ""}
      </div>
    </div>
  );
});

// ---------- Repair Summary ----------

function RepairSummary({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 animate-scale-in">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">{t("adminIntegrity.repairComplete")}</span>
        </div>
        <button onClick={onClose} className="text-xs text-emerald-600 hover:text-emerald-800">
          {t("adminIntegrity.dismiss")}
        </button>
      </div>
      <div className="text-sm text-emerald-700">{t("adminIntegrity.repairMsg")}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-emerald-600">
        <div>{t("adminIntegrity.fixes")}: {String(data.totalFixes ?? 0)}</div>
        <div>{t("adminIntegrity.files")}: {String(data.totalFiles ?? 0)}</div>
        <div>{t("adminIntegrity.backups")}: {String(data.totalBackups ?? 0)}</div>
      </div>
    </div>
  );
}

// ---------- Main Dashboard ----------

export default function IntegrityDashboard({ initialReport, initialHistory }: Props) {
  const { t } = useTranslation();
  const [report, setReport] = useState(initialReport);
  const [history, setHistory] = useState(initialHistory);
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usersExpanded, setUsersExpanded] = useState(false);

  const CATEGORIES: CategoryCardDef[] = useMemo(() => [
    {
      key: "filesystem",
      label: t("adminIntegrity.fileSystem"),
      icon: <HardDrive className="size-5" />,
      accentRing: "hover:ring-blue-200",
      iconBg: "bg-blue-500/10 text-blue-600",
      passText: t("adminIntegrity.allFilesHealthy"),
      failText: t("adminIntegrity.corruptFiles"),
    },
    {
      key: "structure",
      label: t("adminIntegrity.dataStructure"),
      icon: <Layers className="size-5" />,
      accentRing: "hover:ring-violet-200",
      iconBg: "bg-violet-50 text-violet-600",
      passText: t("adminIntegrity.allStructuresValid"),
      failText: t("adminIntegrity.structuralIssues"),
    },
    {
      key: "businessRules",
      label: t("adminIntegrity.businessRules"),
      icon: <Scale className="size-5" />,
      accentRing: "hover:ring-amber-200",
      iconBg: "bg-amber-500/10 text-amber-600",
      passText: t("adminIntegrity.allRulesSatisfied"),
      failText: t("adminIntegrity.ruleViolations"),
    },
    {
      key: "referential",
      label: t("adminIntegrity.references"),
      icon: <Link2 className="size-5" />,
      accentRing: "hover:ring-emerald-200",
      iconBg: "bg-emerald-500/10 text-emerald-600",
      passText: t("adminIntegrity.allReferencesIntact"),
      failText: t("adminIntegrity.brokenReferences"),
    },
    {
      key: "dataQuality",
      label: t("adminIntegrity.dataQuality"),
      icon: <Sparkles className="size-5" />,
      accentRing: "hover:ring-rose-200",
      iconBg: "bg-rose-500/10 text-rose-600",
      passText: t("adminIntegrity.dataQualityExcellent"),
      failText: t("adminIntegrity.qualityConcerns"),
    },
  ], [t]);

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
        setError(body.error ?? t("adminIntegrity.scanFailed"));
      }
    } catch {
      setError(t("adminIntegrity.networkErrorScan"));
    } finally {
      setScanning(false);
    }
  }, [t]);

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
        setError(body.error ?? t("adminIntegrity.repairFailed"));
      }
    } catch {
      setError(t("adminIntegrity.networkErrorRepair"));
    } finally {
      setRepairing(false);
    }
  }, [runScan, t]);

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 animate-fade-in-up">
          {error}
        </div>
      ) : null}

      {/* Repair summary */}
      {repairResult ? (
        <RepairSummary data={repairResult} onClose={() => setRepairResult(null)} />
      ) : null}

      {/* Hero: Health Ring + Actions */}
      <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-6 animate-fade-in-up">
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
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="size-3.5" /> {t("adminIntegrity.allClear")}
                  </span>
                ) : report.status === "warnings" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-900">
                    <ShieldAlert className="size-3.5" /> {totalIssues} {totalIssues !== 1 ? t("adminIntegrity.warnings") : t("adminIntegrity.warning")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-700 animate-subtle-pulse">
                    <ShieldX className="size-3.5" /> {t("adminIntegrity.criticalIssues")}
                  </span>
                )}
              </div>
            ) : null}

            {/* Health message */}
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">
              {scanning
                ? t("adminIntegrity.runningFullScan")
                : !hasReport
                  ? t("adminIntegrity.noReportMsg")
                  : report?.status === "healthy"
                    ? t("adminIntegrity.healthyMsg")
                    : report?.status === "warnings"
                      ? t("adminIntegrity.warningsMsg")
                      : t("adminIntegrity.criticalMsg")}
            </div>

            {/* Sub stats */}
            {hasReport && !scanning ? (
              <div className="text-xs text-[var(--color-text-secondary)] mb-4">
                {report.summary.passed} {t("adminIntegrity.scannedXOfY")} {report.summary.totalChecks} {t("adminIntegrity.checksPassed")} &middot;{" "}
                {t("adminIntegrity.scannedTimeAgo")} {formatTimeAgo(report.runAt)} &middot; {report.durationMs}ms
              </div>
            ) : !hasReport && !scanning ? (
              <div className="text-xs text-[var(--color-text-secondary)] mb-4">{t("adminIntegrity.neverScanned")}</div>
            ) : null}

            {/* Action buttons */}
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                disabled={scanning}
                onClick={() => void runScan()}
                className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-button-primary-bg)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--color-button-primary-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="size-3.5 animate-spin" /> {t("adminIntegrity.scanning")}
                  </span>
                ) : (
                  t("adminIntegrity.runFullScan")
                )}
              </button>
              {report && report.summary.autoFixable > 0 ? (
                <button
                  type="button"
                  disabled={repairing || scanning}
                  onClick={() => void runRepair()}
                  className="rounded-xl border border-emerald-300 bg-emerald-500/10 px-5 py-2.5 text-sm font-medium text-emerald-700 transition-all duration-150 hover:bg-emerald-500/15 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {repairing ? (
                    <span className="flex items-center gap-1.5">
                      <Wrench className="size-3.5 animate-spin" /> {t("adminIntegrity.repairing")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Wrench className="size-3.5" /> {t("adminIntegrity.autoFixAll")}
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
        <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 animate-fade-in-up">
          <button
            type="button"
            onClick={() => setUsersExpanded((prev) => !prev)}
            className="flex w-full items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]"
          >
            {usersExpanded ? <ChevronDown className="size-4 text-[var(--color-text-secondary)]" /> : <ChevronRight className="size-4 text-[var(--color-text-secondary)]" />}
            {t("adminIntegrity.perUserResults")} ({report.userSummaries.length} {t("adminIntegrity.users")})
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
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center animate-scale-in">
          <ShieldCheck className="mx-auto size-8 text-emerald-500 mb-2" />
          <div className="text-sm font-medium text-emerald-700">{t("adminIntegrity.cleanScanMsg")}</div>
        </div>
      ) : null}

      {/* Scan History */}
      {history.length > 0 ? (
        <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Clock className="size-4 text-[var(--color-text-secondary)]" />
            {t("adminIntegrity.scanHistory")}
          </div>
          {history.map((h) => (
            <HistoryRow key={h.id} report={h} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
