"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import SelectDropdown from "@/components/controls/SelectDropdown";
import type { SelectDropdownOption } from "@/lib/types/ui";

type ActionType =
  | "edit_granted"
  | "edit_rejected"
  | "delete_approved"
  | "delete_rejected"
  | "user_cancelled"
  | "auto_finalised"
  | "auto_deleted";

type HistoryRecord = {
  id: string;
  timestamp: string;
  actionType: ActionType;
  entryId: string;
  category: string;
  entryTitle: string;
  userEmail: string;
  userName: string;
  adminEmail?: string;
  requestMessage?: string;
};

type HistoryResponse = {
  ok: boolean;
  data: {
    records: HistoryRecord[];
    total: number;
    page: number;
    pageSize: number;
  };
};

const ACTION_TYPE_OPTIONS: readonly SelectDropdownOption[] = [
  { label: "All Actions", value: "" },
  { label: "Edit Granted", value: "edit_granted" },
  { label: "Edit Rejected", value: "edit_rejected" },
  { label: "Delete Approved", value: "delete_approved" },
  { label: "Delete Rejected", value: "delete_rejected" },
  { label: "User Cancelled", value: "user_cancelled" },
  { label: "Auto-Finalised", value: "auto_finalised" },
  { label: "Auto-Deleted", value: "auto_deleted" },
];

const CATEGORY_OPTIONS: readonly SelectDropdownOption[] = [
  { label: "All Categories", value: "" },
  { label: "FDP \u2014 Attended", value: "fdp-attended" },
  { label: "FDP \u2014 Conducted", value: "fdp-conducted" },
  { label: "Guest Lectures", value: "guest-lectures" },
  { label: "Case Studies", value: "case-studies" },
  { label: "Workshops", value: "workshops" },
];

const BADGE_STYLES: Record<ActionType, string> = {
  edit_granted: "bg-emerald-500/15 text-emerald-700",
  edit_rejected: "bg-red-500/15 text-red-700",
  delete_approved: "bg-red-500/15 text-red-700",
  delete_rejected: "bg-amber-500/15 text-amber-700",
  user_cancelled: "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)]",
  auto_finalised: "bg-blue-500/15 text-blue-700",
  auto_deleted: "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)]",
};

const BADGE_LABELS: Record<ActionType, string> = {
  edit_granted: "Edit Granted",
  edit_rejected: "Edit Rejected",
  delete_approved: "Delete Approved",
  delete_rejected: "Delete Rejected",
  user_cancelled: "User Cancelled",
  auto_finalised: "Auto-Finalised",
  auto_deleted: "Auto-Deleted",
};

function timeAgo(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PAGE_SIZE = 20;

export default function ActionHistoryTab() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionType, setActionType] = useState("");
  const [category, setCategory] = useState("");

  const fetchHistory = useCallback(async (p: number, at: string, cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (at) params.set("actionType", at);
      if (cat) params.set("category", cat);
      const res = await fetch(`/api/admin/action-history?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load action history.");
      const json = (await res.json()) as HistoryResponse;
      if (!json.ok) throw new Error("Failed to load action history.");
      setRecords(json.data.records);
      setTotal(json.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load action history.");
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory(page, actionType, category);
  }, [fetchHistory, page, actionType, category]);

  function handleActionTypeChange(value: string) {
    setActionType(value);
    setPage(1);
  }

  function handleCategoryChange(value: string) {
    setCategory(value);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-52">
          <SelectDropdown
            value={actionType}
            onChange={handleActionTypeChange}
            options={ACTION_TYPE_OPTIONS}
            placeholder="All Actions"
          />
        </div>
        <div className="w-full sm:w-52">
          <SelectDropdown
            value={category}
            onChange={handleCategoryChange}
            options={CATEGORY_OPTIONS}
            placeholder="All Categories"
          />
        </div>
      </div>

      <SectionCard>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-[var(--color-divider)] p-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-24 rounded bg-[var(--color-dropdown-hover)]" />
                  <div className="h-4 w-40 rounded bg-[var(--color-dropdown-hover)]" />
                  <div className="ml-auto h-4 w-20 rounded bg-[var(--color-dropdown-hover)]" />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-3 w-32 rounded bg-[var(--color-divider)]" />
                  <div className="h-3 w-24 rounded bg-[var(--color-divider)]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--color-body-bg)]">
              <Clock className="size-8 text-[var(--color-text-muted)]" />
            </div>
            <p className="mt-4 text-base font-medium text-[var(--color-text-secondary)]">No history records found</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {actionType || category
                ? "Try adjusting your filters."
                : "Action history will appear here as requests are processed."}
            </p>
          </div>
        ) : (
          <>
            {/* Records list */}
            <div className="space-y-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 transition-colors hover:bg-[var(--color-dropdown-hover)]"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[record.actionType]}`}
                      >
                        {BADGE_LABELS[record.actionType]}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {record.entryTitle}
                      </span>
                    </div>
                    <span
                      className="shrink-0 text-xs text-[var(--color-text-secondary)]"
                      title={new Date(record.timestamp).toLocaleString()}
                    >
                      {timeAgo(record.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                    <span className="rounded bg-[var(--color-dropdown-hover)] px-1.5 py-0.5 font-medium">
                      {record.category}
                    </span>
                    <span>{record.userName || record.userEmail}</span>
                    {record.adminEmail ? (
                      <>
                        <span>&middot;</span>
                        <span>by {record.adminEmail.split("@")[0]}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-divider)] pt-4">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Showing {showFrom}\u2013{showTo} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-card-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" />
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-card-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
