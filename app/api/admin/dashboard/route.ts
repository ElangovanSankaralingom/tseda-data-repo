import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";
import { getRecentAuditEvents, getAuditStats } from "@/lib/admin/auditLog";
import { getPendingEditRequestsCount } from "@/lib/admin/pendingConfirmations";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { getCachedAnalytics } from "@/lib/analytics/cache";
import { daysAgo } from "@/lib/analytics/compare";
import type { AnalyticsSnapshot, EntryDataPoint } from "@/lib/analytics/compute";
import { getLatestBackupFile, listBackups } from "@/lib/backup/backupService";
import { CATEGORY_LIST, getCategoryConfig } from "@/data/categoryRegistry";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getLastReport } from "@/lib/integrity/report";
import { getScheduleStatus } from "@/lib/integrity/schedule";
import { getNonDefaultCounts } from "@/lib/settings/store";
import { isMaintenanceMode } from "@/lib/settings/consumer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeNum(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function entryTrend(entries: EntryDataPoint[], days: number): { date: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    counts[daysAgo(i)] = 0;
  }
  for (const e of entries) {
    if (e.date in counts) counts[e.date]++;
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || (!canAccessAdminConsole(email) && !isMasterAdmin(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch everything in parallel — each source is independent
  const [
    analyticsResult,
    pendingCount,
    integrityStatus,
    integrityReport,
    latestBackup,
    backupList,
    auditEventsResult,
    auditStatsResult,
    nonDefaultCounts,
    maintenanceMode,
  ] = await Promise.all([
    getCachedAnalytics().catch(() => null),
    getPendingEditRequestsCount().catch(() => 0),
    getScheduleStatus().catch(() => ({ lastCheckAt: null, daysSinceLastCheck: null, isOverdue: false, lastStatus: null })),
    getLastReport().catch(() => null),
    getLatestBackupFile().catch(() => null),
    listBackups().catch(() => null),
    getRecentAuditEvents({ limit: 10 }).catch(() => null),
    getAuditStats().catch(() => null),
    getNonDefaultCounts().catch(() => ({})),
    isMaintenanceMode().catch(() => false),
  ]);

  const snap: AnalyticsSnapshot | null =
    analyticsResult && "ok" in analyticsResult && analyticsResult.ok
      ? analyticsResult.data
      : null;

  // --- Metrics ---
  const totalUsers = snap?.totalUsers ?? 0;
  const totalEntries = snap?.totalEntries ?? 0;
  const activeStreaks = snap?.streaks?.totalActivated ?? 0;
  const streakWins = snap?.streaks?.totalWins ?? 0;
  const completionRate =
    totalEntries > 0
      ? Math.round(
          ((snap?.entries?.filter((e) => e.status === "GENERATED" || e.status === "EDIT_GRANTED").length ?? 0) /
            totalEntries) *
            100,
        )
      : 0;

  // Entry growth (last 7 days)
  const sevenDaysAgo = daysAgo(7);
  const entryGrowth = snap?.entries?.filter((e) => e.date >= sevenDaysAgo).length ?? 0;

  // User growth approximation — users whose first entry is this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const newUsersThisMonth = snap?.users?.filter((u) => {
    const la = u.lastActivity;
    return la && la >= monthStartStr && u.entryCount <= 3;
  }).length ?? 0;

  // --- Activity feed ---
  const auditEvents =
    auditEventsResult && "ok" in auditEventsResult && auditEventsResult.ok
      ? auditEventsResult.data
      : [];

  const recentActivity = auditEvents.slice(0, 10).map((evt) => ({
    summary: evt.summary ?? `${evt.action} on ${evt.category}`,
    timestamp: evt.ts,
    action: evt.action,
    category: evt.category ?? null,
    actorEmail: evt.actorEmail,
  }));

  // --- Entry trend (14 days) ---
  const trend = snap ? entryTrend(snap.entries, 14) : [];

  // --- Audit stats ---
  const auditStats =
    auditStatsResult && "ok" in auditStatsResult && auditStatsResult.ok
      ? auditStatsResult.data
      : null;

  // --- Backup health ---
  const latestBk =
    latestBackup && "ok" in latestBackup && latestBackup.ok
      ? latestBackup.data
      : null;
  const backups =
    backupList && "ok" in backupList && backupList.ok ? backupList.data : [];
  const backupTotalSize = backups.reduce((sum, b) => sum + (b.sizeBytes ?? 0), 0);
  const lastBackupMs = latestBk?.createdAt ? Date.now() - Date.parse(latestBk.createdAt) : null;
  const backupStatus: "green" | "amber" | "red" =
    !latestBk ? "red" : lastBackupMs && lastBackupMs > 48 * 60 * 60 * 1000 ? "amber" : "green";

  // --- Integrity health ---
  const report =
    integrityReport && "ok" in integrityReport && integrityReport.ok
      ? integrityReport.data
      : null;
  const integrityIssues = report
    ? safeNum((report as Record<string, unknown>)["totalWarnings"]) +
      safeNum((report as Record<string, unknown>)["totalErrors"])
    : 0;
  const integrityScore =
    report && typeof (report as Record<string, unknown>)["healthScore"] === "number"
      ? (report as Record<string, unknown>)["healthScore"] as number
      : null;
  const integrityHealthStatus: "green" | "amber" | "red" =
    integrityStatus.lastStatus === "healthy"
      ? "green"
      : integrityStatus.lastStatus === "warnings"
        ? "amber"
        : integrityStatus.lastStatus === "critical"
          ? "red"
          : !integrityStatus.lastStatus
            ? "amber"
            : "green";

  // --- Storage ---
  const storageStatus: "green" | "amber" | "red" =
    backupTotalSize > 1024 * 1024 * 1024 ? "red" : backupTotalSize > 500 * 1024 * 1024 ? "amber" : "green";

  // --- Audit health ---
  const todayStr = daysAgo(0);
  const eventsToday = auditStats?.recentDays?.find((d) => d.date === todayStr)?.count ?? 0;
  const auditStatus: "green" | "amber" | "red" =
    eventsToday > 0 ? "green" : (auditStats?.totalEvents ?? 0) > 0 ? "amber" : "amber";

  // --- Category overview ---
  const categoryOverview = CATEGORY_LIST.map((slug) => {
    const config = getCategoryConfig(slug);
    const catSnap = snap?.categories?.find((c) => c.slug === slug);
    return {
      slug,
      name: config.label,
      totalEntries: catSnap?.totalEntries ?? 0,
      statusBreakdown: catSnap?.entriesByStatus ?? {},
      streakActivated: catSnap?.streakActivated ?? 0,
      streakWins: catSnap?.streakWins ?? 0,
    };
  });

  // --- Leaderboard (top 5 by entries) ---
  const leaderboard = (snap?.users ?? [])
    .filter((u) => u.entryCount > 0)
    .sort((a, b) => b.entryCount - a.entryCount)
    .slice(0, 5)
    .map((u) => ({
      email: u.email,
      name: u.name,
      entries: u.entryCount,
      streakWins: u.streakWins,
    }));

  // --- Pending items ---
  const pendingItems: { type: string; message: string; actionLabel: string; actionUrl: string }[] = [];
  if (pendingCount > 0) {
    pendingItems.push({
      type: "edit_requests",
      message: `${pendingCount} edit ${pendingCount === 1 ? "request" : "requests"} pending`,
      actionLabel: "Review",
      actionUrl: "/admin/confirmations",
    });
  }
  if (backupStatus === "red") {
    pendingItems.push({
      type: "backup",
      message: "No backups found",
      actionLabel: "Backup Now",
      actionUrl: "/admin/backups",
    });
  } else if (backupStatus === "amber") {
    pendingItems.push({
      type: "backup",
      message: "Backup overdue",
      actionLabel: "Backup Now",
      actionUrl: "/admin/backups",
    });
  }
  if (integrityStatus.isOverdue) {
    pendingItems.push({
      type: "integrity",
      message: "Integrity scan overdue",
      actionLabel: "Run Scan",
      actionUrl: "/admin/integrity",
    });
  }
  if (integrityIssues > 0) {
    pendingItems.push({
      type: "integrity_issues",
      message: `${integrityIssues} integrity ${integrityIssues === 1 ? "issue" : "issues"} found`,
      actionLabel: "View Issues",
      actionUrl: "/admin/integrity",
    });
  }
  if (maintenanceMode) {
    pendingItems.push({
      type: "maintenance",
      message: "Maintenance mode is active",
      actionLabel: "Disable",
      actionUrl: "/admin/settings",
    });
  }

  // --- Non-default settings count ---
  const settingsChanged = Object.values(nonDefaultCounts).reduce((s, c) => s + c, 0);

  return NextResponse.json({
    data: {
      metrics: {
        totalUsers,
        totalEntries,
        activeStreaks,
        streakWins,
        pendingRequests: pendingCount,
        completionRate,
        entryGrowth,
        newUsersThisMonth,
      },
      recentActivity,
      entryTrend: trend,
      health: {
        backup: {
          status: backupStatus,
          lastBackup: latestBk?.createdAt ?? null,
          count: backups.length,
          size: humanSize(backupTotalSize),
        },
        integrity: {
          status: integrityHealthStatus,
          lastScan: integrityStatus.lastCheckAt ?? null,
          score: integrityScore,
          issues: integrityIssues,
          isOverdue: integrityStatus.isOverdue,
        },
        storage: {
          status: storageStatus,
          totalSize: humanSize(backupTotalSize),
          backupSize: humanSize(backupTotalSize),
        },
        audit: {
          status: auditStatus,
          totalEvents: auditStats?.totalEvents ?? 0,
          eventsToday,
        },
        system: {
          maintenanceMode,
        },
      },
      leaderboard,
      categoryOverview,
      pendingItems,
      settingsChanged,
    },
  });
}
