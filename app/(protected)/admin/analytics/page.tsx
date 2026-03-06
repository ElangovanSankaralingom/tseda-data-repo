import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { authOptions } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { summarizeTelemetry, trackEvent } from "@/lib/telemetry/telemetry";

function formatDuration(durationMs: number | null) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) return "-";
  const hours = durationMs / (1000 * 60 * 60);
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  const minutes = durationMs / (1000 * 60);
  if (minutes >= 1) return `${minutes.toFixed(1)}m`;
  return `${Math.round(durationMs / 1000)}s`;
}

function formatTs(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "-";
  return new Date(parsed).toLocaleString();
}

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canViewAnalytics(email)) {
    redirect(dashboard());
  }

  void trackEvent({
    event: "page.analytics_view",
    actorEmail: email,
    role: "admin",
    meta: {
      page: "/admin/analytics",
    },
  });

  const summaryResult = await summarizeTelemetry({ limit: 30_000 });
  const summary = summaryResult.ok ? summaryResult.data : null;

  return (
    <AdminPageShell
      title="Analytics"
      subtitle="Internal usage telemetry from server-side event tracking."
      backHref={adminHome()}
    >
      {!summary ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load telemetry summary.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Total events</div>
              <div className="mt-1 text-2xl font-semibold">{summary.totalEvents}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="mt-1 text-2xl font-semibold">{summary.funnel.created}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="mt-1 text-2xl font-semibold">{summary.funnel.pending}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Approved</div>
              <div className="mt-1 text-2xl font-semibold">{summary.funnel.approved}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">Most Used Categories</h2>
              <div className="mt-3 space-y-2 text-sm">
                {Object.entries(summary.usageByCategory)
                  .sort((left, right) => right[1] - left[1])
                  .slice(0, 10)
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{category}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">Top Actions</h2>
              <div className="mt-3 space-y-2 text-sm">
                {summary.actionsByCount.slice(0, 12).map((item) => (
                  <div key={item.event} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{item.event}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">Workflow Drop-offs</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created but never sent</span>
                  <span className="font-medium">{summary.dropOff.createdNotSent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending too long</span>
                  <span className="font-medium">{summary.dropOff.pendingTooLong}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Upload started without commit</span>
                  <span className="font-medium">{summary.dropOff.uploadStartedWithoutCommit}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">Average Turnaround</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Draft → Pending</span>
                  <span className="font-medium">
                    {formatDuration(summary.turnaround.draftToPendingAvgMs)} ({summary.turnaround.draftToPendingSamples})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending → Approved</span>
                  <span className="font-medium">
                    {formatDuration(summary.turnaround.pendingToApprovedAvgMs)} ({summary.turnaround.pendingToApprovedSamples})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">Failures by Action</h2>
              <div className="mt-3 space-y-2 text-sm">
                {summary.failuresByAction.slice(0, 12).map((item) => (
                  <div key={item.event} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{item.event}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold">Failures by Error Code</h2>
              <div className="mt-3 space-y-2 text-sm">
                {summary.failuresByErrorCode.slice(0, 12).map((item) => (
                  <div key={item.errorCode} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{item.errorCode}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold">Recent Failures</h2>
            {summary.recentFailures.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No failures captured.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Time</th>
                      <th className="px-2 py-2 font-medium">Event</th>
                      <th className="px-2 py-2 font-medium">Actor</th>
                      <th className="px-2 py-2 font-medium">Category</th>
                      <th className="px-2 py-2 font-medium">Entry</th>
                      <th className="px-2 py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentFailures.map((event, index) => (
                      <tr key={`${event.ts}:${event.event}:${index}`} className="border-b border-border/60">
                        <td className="px-2 py-2">{formatTs(event.ts)}</td>
                        <td className="px-2 py-2">{event.event}</td>
                        <td className="px-2 py-2">{event.actorEmail}</td>
                        <td className="px-2 py-2">{event.category || "-"}</td>
                        <td className="px-2 py-2 font-mono text-xs">{event.entryId || "-"}</td>
                        <td className="px-2 py-2">
                          {typeof event.meta.errorCode === "string" && event.meta.errorCode
                            ? event.meta.errorCode
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
