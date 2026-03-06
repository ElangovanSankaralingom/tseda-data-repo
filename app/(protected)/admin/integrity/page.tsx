import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import BackTo from "@/components/nav/BackTo";
import { authOptions } from "@/lib/auth";
import { canRunIntegrityTools } from "@/lib/admin/roles";
import {
  checkAllUsersIntegrity,
  listUsers,
  type IntegritySummary,
} from "@/lib/admin/integrity";
import { toUserMessage } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, adminIntegrity, adminIntegrityUser, dashboard } from "@/lib/navigation";
import { getButtonClass } from "@/lib/ui/buttonRoles";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminIntegrityOverviewPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function badgeClass(summary: IntegritySummary | undefined) {
  if (!summary) {
    return "rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground";
  }
  if (summary.checkFailed || summary.errorCount > 0) {
    return "rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700";
  }
  if (summary.warnCount > 0) {
    return "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800";
  }
  return "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700";
}

export default async function AdminIntegrityOverviewPage({ searchParams }: AdminIntegrityOverviewPageProps) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canRunIntegrityTools(email)) {
    redirect(dashboard());
  }

  const params = searchParams ? await searchParams : {};
  const runAllChecks = getParam(params, "run") === "all";

  const usersResult = await listUsers();
  const users = usersResult.ok ? usersResult.data : [];
  const usersError = usersResult.ok ? null : toUserMessage(usersResult.error);

  const summaryResult = runAllChecks ? await checkAllUsersIntegrity() : null;
  const summaries = summaryResult?.ok ? summaryResult.data : [];
  const summaryError =
    summaryResult && !summaryResult.ok ? toUserMessage(summaryResult.error) : null;
  const summaryByUser = new Map(summaries.map((item) => [item.userEmail, item] as const));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={adminHome()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrity Check &amp; Repair</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin-only tools for store consistency checks across category files, index, and WAL.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form method="get">
            <input type="hidden" name="run" value="all" />
            <button type="submit" className={getButtonClass("context")}>
              Run All Checks
            </button>
          </form>
          {runAllChecks ? (
            <Link href={adminIntegrity()} className={getButtonClass("ghost")}>
              Clear Summary
            </Link>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {users.length} user{users.length === 1 ? "" : "s"} detected
          </span>
        </div>

        {summaryError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{summaryError}</div>
        ) : null}

        {usersError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{usersError}</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-muted-foreground">No user directories found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">User</th>
                  <th className="px-2 py-2 font-medium">Issues</th>
                  <th className="px-2 py-2 font-medium">Severity</th>
                  <th className="px-2 py-2 font-medium">Fixable</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((userEmail) => {
                  const summary = summaryByUser.get(userEmail);
                  const severityLabel = summary
                    ? summary.checkFailed
                      ? "CHECK FAILED"
                      : `E:${summary.errorCount} W:${summary.warnCount} I:${summary.infoCount}`
                    : "-";
                  const issuesLabel = summary ? String(summary.totalIssues) : "-";
                  const fixableLabel = summary ? String(summary.fixableCount) : "-";

                  return (
                    <tr key={userEmail} className="border-b border-border/60">
                      <td className="px-2 py-2 font-medium">{userEmail}</td>
                      <td className="px-2 py-2">{issuesLabel}</td>
                      <td className="px-2 py-2">
                        <span className={badgeClass(summary)}>{severityLabel}</span>
                      </td>
                      <td className="px-2 py-2">{fixableLabel}</td>
                      <td className="px-2 py-2">
                        <Link href={adminIntegrityUser(userEmail)} className={getButtonClass("context")}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
