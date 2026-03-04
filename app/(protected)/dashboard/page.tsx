"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StreakSummaryCard from "@/components/gamification/StreakSummaryCard";
import {
  aggregateGlobalWins,
  isFutureDatedEntry,
  isWithinDueWindow,
  remainingDaysFromDueAtISO,
  type StreakState,
} from "@/lib/gamification";

type FdpAttendedEntry = {
  id: string;
  programName: string;
  startDate: string;
  endDate: string;
  status?: string;
  streak: StreakState;
  createdAt?: string;
  updatedAt?: string;
  completionCertificate?: {
    storedPath: string;
  } | null;
};

type FdpConductedEntry = {
  id: string;
  startDate: string;
  endDate: string;
  status?: string;
  streak: StreakState;
  createdAt?: string;
  updatedAt?: string;
  coordinatorName?: string;
  geotaggedPhotos?: Array<{
    storedPath: string;
  }> | null;
};

type PendingEntryRow = {
  id: string;
  categoryLabel: string;
  tag: string;
  route: string;
  remainingDays: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-2xl border border-border bg-white/70 p-6 transition-all duration-200 hover:scale-[1.01]", className)}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StreakCardShell({
  title,
  subtitle,
  summary,
  action,
  className,
  footer,
}: {
  title: string;
  subtitle?: string;
  summary: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <SectionCard title={title} subtitle={subtitle} className={className}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex flex-wrap items-center gap-3">{summary}</div>
          <div className="shrink-0">
            {action ? (
              action
            ) : (
              <span className="invisible inline-flex h-10 items-center justify-center px-3 text-sm">Action</span>
            )}
          </div>
        </div>
        {footer ? <div>{footer}</div> : null}
      </div>
    </SectionCard>
  );
}

function getSortTime(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getEntrySortTime(primary?: string, fallback?: string) {
  const primaryTime = getSortTime(primary);
  if (primaryTime !== Number.POSITIVE_INFINITY) return primaryTime;
  return getSortTime(fallback);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [attendedEntries, setAttendedEntries] = useState<FdpAttendedEntry[]>([]);
  const [conductedEntries, setConductedEntries] = useState<FdpConductedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const meResponse = await fetch("/api/me", { cache: "no-store" });
        const mePayload = await meResponse.json();

        if (!meResponse.ok || !String(mePayload?.email ?? "").trim()) {
          throw new Error(mePayload?.error || "Failed to load streaks.");
        }

        const email = String(mePayload.email).trim();
        const [attendedResponse, conductedResponse] = await Promise.all([
          fetch("/api/me/fdp-attended", { cache: "no-store" }),
          fetch(`/api/me/fdp-conducted?email=${encodeURIComponent(email)}`, { cache: "no-store" }),
        ]);

        const [attendedPayload, conductedPayload] = await Promise.all([
          attendedResponse.json(),
          conductedResponse.json(),
        ]);

        if (!attendedResponse.ok) {
          throw new Error(attendedPayload?.error || "Failed to load streaks.");
        }

        if (!conductedResponse.ok) {
          throw new Error(conductedPayload?.error || "Failed to load streaks.");
        }

        setAttendedEntries(Array.isArray(attendedPayload) ? (attendedPayload as FdpAttendedEntry[]) : []);
        setConductedEntries(Array.isArray(conductedPayload) ? (conductedPayload as FdpConductedEntry[]) : []);
        setError(null);
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "Failed to load streaks.";
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const globalWins = useMemo(
    () =>
      aggregateGlobalWins({
        fdpAttended: attendedEntries,
        fdpConducted: conductedEntries,
      }),
    [attendedEntries, conductedEntries]
  );
  const pendingAttendedRows = useMemo(
    (): PendingEntryRow[] =>
      attendedEntries
        .filter(
          (entry) =>
            isFutureDatedEntry(entry.startDate, entry.endDate) &&
            entry.status === "final" &&
            !!entry.streak.activatedAtISO &&
            !entry.completionCertificate &&
            isWithinDueWindow(entry.streak.dueAtISO)
        )
        .sort(
          (left, right) =>
            getEntrySortTime(left.createdAt, left.updatedAt) - getEntrySortTime(right.createdAt, right.updatedAt)
        )
        .map((entry, index) => ({
          id: entry.id,
          categoryLabel: "FDP - Attended",
          tag: `P${index + 1}`,
          route: "/data-entry/fdp-attended",
          remainingDays: remainingDaysFromDueAtISO(entry.streak.dueAtISO),
        })),
    [attendedEntries]
  );
  const pendingConductedRows = useMemo(
    (): PendingEntryRow[] =>
      conductedEntries
        .filter(
          (entry) =>
            isFutureDatedEntry(entry.startDate, entry.endDate) &&
            entry.status === "final" &&
            !!entry.streak.activatedAtISO &&
            (!Array.isArray(entry.geotaggedPhotos) || entry.geotaggedPhotos.length === 0) &&
            isWithinDueWindow(entry.streak.dueAtISO)
        )
        .sort(
          (left, right) =>
            getEntrySortTime(left.createdAt, left.updatedAt) - getEntrySortTime(right.createdAt, right.updatedAt)
        )
        .map((entry, index) => ({
          id: entry.id,
          categoryLabel: "FDP - Conducted",
          tag: `P${index + 1}`,
          route: "/data-entry/fdp-conducted",
          remainingDays: remainingDaysFromDueAtISO(entry.streak.dueAtISO),
        })),
    [conductedEntries]
  );
  const orderedPendingRows = useMemo(
    () => [...pendingAttendedRows, ...pendingConductedRows],
    [pendingAttendedRows, pendingConductedRows]
  );
  const totalActivatedPendingCount = orderedPendingRows.length;
  const visiblePendingRows = orderedPendingRows.slice(0, 5);
  const hiddenPendingCount = Math.max(0, orderedPendingRows.length - visiblePendingRows.length);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Track pending uploads and streak wins.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StreakCardShell
          title="🔥 Streak Wins"
          subtitle="Keep the momentum alive"
          className={globalWins.winsCount > 0 ? "border-orange-200 bg-gradient-to-br from-orange-50/80 to-transparent" : undefined}
          summary={
            loading ? (
              <div className="text-sm text-muted-foreground">Loading streaks...</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : (
              <StreakSummaryCard
                coloredCount={globalWins.winsCount}
                animateColored={globalWins.winsCount > 0}
              />
            )
          }
          footer={
            !loading && !error && totalActivatedPendingCount === 0 ? (
              <p className="text-sm text-muted-foreground">Start a task to activate your streak.</p>
            ) : null
          }
        />

        <StreakCardShell
          title="Streak Activated"
          subtitle="Active tasks by category"
          className="border-orange-300/80 shadow-[0_0_18px_rgba(249,115,22,0.08)]"
          summary={
            loading ? (
              <div className="text-sm text-muted-foreground">Loading streaks...</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : (
              <StreakSummaryCard greyCount={totalActivatedPendingCount} animateGrey={totalActivatedPendingCount > 0} />
            )
          }
          footer={
            !loading && !error ? (
              totalActivatedPendingCount > 0 ? (
                <div className="space-y-2">
                  {visiblePendingRows.map((row) => (
                    <div
                      key={`${row.categoryLabel}-${row.id}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3"
                    >
                      <div className="min-w-0 text-sm text-foreground">
                        <span className="text-muted-foreground">{row.categoryLabel}</span>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="font-mono text-xs text-muted-foreground">{row.tag}</span>
                      </div>
                      <span
                        className={cx(
                          "whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium",
                          row.remainingDays <= 2
                            ? "bg-red-50 text-red-700"
                            : row.remainingDays <= 5
                              ? "bg-amber-50 text-amber-700"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {row.remainingDays} days left
                      </span>
                      <Link
                        href={row.route}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-foreground bg-foreground px-3 text-sm text-background transition-colors duration-150 hover:bg-foreground/90 hover:shadow-[0_0_16px_rgba(15,23,42,0.18)]"
                      >
                        Complete
                      </Link>
                    </div>
                  ))}
                  {hiddenPendingCount > 0 ? (
                    <p className="text-sm text-muted-foreground">+ {hiddenPendingCount} more active tasks</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active streaks</p>
              )
            ) : null
          }
        />
      </div>
    </div>
  );
}
