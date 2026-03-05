import Link from "next/link";
import BackTo from "@/components/nav/BackTo";
import { getRecentAuditEvents, type AuditAction } from "@/lib/admin/auditLog";
import { CATEGORY_KEYS, isCategoryKey } from "@/lib/categories";
import { toUserMessage } from "@/lib/errors";
import { adminAudit, adminHome, entryDetail } from "@/lib/navigation";
import { getButtonClass } from "@/lib/ui/buttonRoles";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminAuditPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function parseAction(value: string): AuditAction | undefined {
  const normalized = value.trim().toUpperCase();
  if (normalized === "APPROVE") return "APPROVE";
  if (normalized === "REJECT") return "REJECT";
  if (normalized === "SEND_FOR_CONFIRMATION") return "SEND_FOR_CONFIRMATION";
  return undefined;
}

function parseLimit(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(500, parsed));
}

function toISODateStart(value: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function toISODateEnd(value: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(`${value}T23:59:59.999Z`);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const params = searchParams ? await searchParams : {};

  const ownerInput = getParam(params, "owner");
  const categoryInput = getParam(params, "category");
  const actionInput = getParam(params, "action");
  const limitInput = getParam(params, "limit");
  const fromInput = getParam(params, "from");
  const toInput = getParam(params, "to");

  const selectedCategory = isCategoryKey(categoryInput) ? categoryInput : undefined;
  const selectedAction = parseAction(actionInput);
  const limit = parseLimit(limitInput);

  const result = await getRecentAuditEvents({
    limit,
    userEmail: ownerInput || undefined,
    category: selectedCategory,
    action: selectedAction,
    fromISO: toISODateStart(fromInput),
    toISO: toISODateEnd(toInput),
  });

  const rows = result.ok ? result.data : [];
  const error = result.ok ? null : toUserMessage(result.error);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={adminHome()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approval workflow history from WAL events across all users and categories.
          </p>
        </div>
      </div>

      <form method="get" className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Owner Email</span>
            <input
              name="owner"
              defaultValue={ownerInput}
              placeholder="faculty@tce.edu"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Category</span>
            <select
              name="category"
              defaultValue={selectedCategory ?? ""}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">All</option>
              {CATEGORY_KEYS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Action</span>
            <select
              name="action"
              defaultValue={selectedAction ?? ""}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">All</option>
              <option value="APPROVE">APPROVE</option>
              <option value="REJECT">REJECT</option>
              <option value="SEND_FOR_CONFIRMATION">SEND_FOR_CONFIRMATION</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <input
              type="date"
              name="from"
              defaultValue={fromInput}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <input
              type="date"
              name="to"
              defaultValue={toInput}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Last N Events</span>
            <input
              type="number"
              min={1}
              max={500}
              name="limit"
              defaultValue={String(limit)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button type="submit" className={getButtonClass("context")}>
            Apply Filters
          </button>
          <Link href={adminAudit()} className={getButtonClass("ghost")}>
            Reset
          </Link>
        </div>
      </form>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{rows.length}</span> events
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No matching audit events.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Timestamp</th>
                  <th className="px-2 py-2 font-medium">Actor</th>
                  <th className="px-2 py-2 font-medium">Owner</th>
                  <th className="px-2 py-2 font-medium">Category</th>
                  <th className="px-2 py-2 font-medium">Entry</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                  <th className="px-2 py-2 font-medium">What Changed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.ts}:${row.userEmail}:${row.category}:${row.entryId}:${row.action}`} className="border-b border-border/60 align-top">
                    <td className="px-2 py-2 whitespace-nowrap">{formatTimestamp(row.ts)}</td>
                    <td className="px-2 py-2">
                      <div>{row.actorEmail || "-"}</div>
                      <div className="text-xs text-muted-foreground">{row.actorRole}</div>
                    </td>
                    <td className="px-2 py-2">{row.userEmail}</td>
                    <td className="px-2 py-2">{row.category}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={entryDetail(row.category, row.entryId)}
                        className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                      >
                        {row.entryId}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{row.action}</td>
                    <td className="px-2 py-2">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
