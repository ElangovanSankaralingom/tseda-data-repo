"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { useTranslation } from "@/lib/i18n/useTranslation";
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

const ACTION_TYPE_KEYS: Record<ActionType, string> = {
  edit_granted: "admin.editGranted",
  edit_rejected: "admin.editRejected",
  delete_approved: "admin.deleteApproved",
  delete_rejected: "admin.deleteRejected",
  user_cancelled: "admin.userCancelled",
  auto_finalised: "admin.autoFinalised",
  auto_deleted: "admin.autoDeleted",
};

const BADGE_STYLES: Record<ActionType, string> = {
  edit_granted: "bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]",
  edit_rejected: "bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]",
  delete_approved: "bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]",
  delete_rejected: "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]",
  user_cancelled: "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)]",
  auto_finalised: "bg-[var(--color-status-info-bg)] text-[var(--color-status-info)]",
  auto_deleted: "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)]",
};

const CATEGORY_SLUGS = [
  "fdp-attended",
  "fdp-conducted",
  "guest-lectures",
  "case-studies",
  "workshops",
] as const;

const PAGE_SIZE = 20;

export default function ActionHistoryTab() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionType, setActionType] = useState("");
  const [category, setCategory] = useState("");

  const actionTypeOptions = useMemo<readonly SelectDropdownOption[]>(() => [
    { label: t("admin.allActions"), value: "" },
    ...Object.entries(ACTION_TYPE_KEYS).map(([value, key]) => ({
      label: t(key as Parameters<typeof t>[0]),
      value,
    })),
  ], [t]);

  const categoryOptions = useMemo<readonly SelectDropdownOption[]>(() => [
    { label: t("admin.allCategories"), value: "" },
    ...CATEGORY_SLUGS.map((slug) => ({
      label: t(`category.${slug}` as Parameters<typeof t>[0]),
      value: slug,
    })),
  ], [t]);

  function timeAgo(isoString: string): string {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    const now = Date.now();
    const diffMs = now - date.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return t("admin.justNow");
    if (minutes < 60) {
      const key = minutes === 1 ? "admin.minuteAgo" : "admin.minutesAgo";
      return t(key).replace("{count}", String(minutes));
    }
    if (hours < 24) {
      const key = hours === 1 ? "admin.hourAgo" : "admin.hoursAgo";
      return t(key).replace("{count}", String(hours));
    }
    if (days === 1) return t("admin.yesterday");
    if (days < 7) return t("admin.daysAgo").replace("{count}", String(days));

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

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
            options={actionTypeOptions}
            placeholder={t("admin.allActions")}
          />
        </div>
        <div className="w-full sm:w-52">
          <SelectDropdown
            value={category}
            onChange={handleCategoryChange}
            options={categoryOptions}
            placeholder={t("admin.allCategories")}
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
          <div className="rounded-lg border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-sm text-[var(--color-status-error)]">
            {error}
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--color-body-bg)]">
              <Clock className="size-8 text-[var(--color-text-muted)]" />
            </div>
            <p className="mt-4 text-base font-medium text-[var(--color-text-secondary)]">{t("admin.noHistoryFound")}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {actionType || category
                ? t("admin.adjustFilters")
                : t("admin.historyWillAppear")}
            </p>
          </div>
        ) : (
          <>
            {/* Records list */}
            <div className="space-y-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 transition-colors hover:bg-[var(--color-dropdown-hover)]"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[record.actionType]}`}
                      >
                        {t(ACTION_TYPE_KEYS[record.actionType] as Parameters<typeof t>[0])}
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
                        <span>{t("admin.byAdmin").replace("{name}", record.adminEmail.split("@")[0] ?? "")}</span>
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
                  {t("common.showing")} {showFrom}&ndash;{showTo} {t("common.of")} {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" />
                    {t("common.previous")}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("common.next")}
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
