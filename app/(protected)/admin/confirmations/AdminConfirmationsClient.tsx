"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { ActionButton } from "@/components/ui/ActionButton";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { toUserMessage } from "@/lib/errors";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { safeAction } from "@/lib/safeAction";
import ActionHistoryTab from "./ActionHistoryTab";

type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: string;
  entryId: string;
  title: string;
  editRequestedAtISO: string | null;
  deleteRequestedAtISO: string | null;
  editRequestMessage: string | null;
  createdAtISO?: string | null;
  updatedAtISO?: string | null;
  status: string;
  entryHref: string;
};

function formatRelativeTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Less than 1 hour ago";
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function getRowKey(row: Pick<PendingConfirmationRow, "ownerEmail" | "categoryKey" | "entryId">) {
  return `${row.ownerEmail}:${row.categoryKey}:${row.entryId}`;
}

function getInitials(email: string) {
  const name = email.split("@")[0] ?? "";
  return name.slice(0, 2).toUpperCase();
}

function getRequestTimestamp(row: PendingConfirmationRow): string | null {
  if (row.status === "DELETE_REQUESTED") return row.deleteRequestedAtISO ?? row.updatedAtISO ?? null;
  return row.editRequestedAtISO ?? row.updatedAtISO ?? null;
}

type Tab = "pending" | "history";

export default function AdminConfirmationsClient() {
  const { t } = useTranslation();
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rows, setRows] = useState<PendingConfirmationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await safeAction(
      async () => {
        const response = await fetch("/api/admin/confirmations", { cache: "no-store" });
        const payload = (await response.json()) as PendingConfirmationRow[] | { error?: string };
        if (!response.ok) {
          throw new Error(
            (payload as { error?: string })?.error || "Failed to load confirmation queue."
          );
        }
        return Array.isArray(payload) ? payload : [];
      },
      {
        context: "admin.confirmations.loadQueue",
      }
    );

    try {
      if (!result.ok) {
        setError(toUserMessage(result.error));
        setRows([]);
        return;
      }

      setRows(result.data as PendingConfirmationRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function resolve(row: PendingConfirmationRow, decision: "grant" | "reject" | "reject_delete" | "approve_delete", reason?: string) {
    const key = getRowKey(row);
    setBusyKey(key);
    setError(null);

    const result = await safeAction(
      async () => {
        const response = await fetch("/api/admin/confirmations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerEmail: row.ownerEmail,
            categoryKey: row.categoryKey,
            entryId: row.entryId,
            decision,
            ...(reason ? { reason } : {}),
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to process request.`);
        }
      },
      {
        context: `admin.confirmations.${decision}`,
      }
    );

    try {
      if (!result.ok) {
        setError(toUserMessage(result.error));
        return;
      }

      setRows((current) =>
        current.filter(
          (item) =>
            !(
              item.ownerEmail === row.ownerEmail &&
              item.categoryKey === row.categoryKey &&
              item.entryId === row.entryId
            )
        )
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex border-b border-[var(--color-card-border)] mb-6">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "pending"
              ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)] font-medium"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {t('admin.pending')}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm transition-colors ${
            activeTab === "history"
              ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)] font-medium"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {t('admin.history')}
        </button>
      </div>

      {activeTab === "history" ? (
        <ActionHistoryTab />
      ) : (<>
      <SectionCard>
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <p className="mt-4 text-base font-medium text-[var(--color-text-secondary)]">{t('common.noResults')}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('entry.noEntries')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const rowKey = getRowKey(row);
              const busy = busyKey === rowKey;
              const isDeleteRequest = row.status === "DELETE_REQUESTED";
              const relative = formatRelativeTime(getRequestTimestamp(row));

              return (
                <div
                  key={rowKey}
                  className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Avatar + User Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white">
                        {getInitials(row.ownerEmail)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{row.title}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            isDeleteRequest
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {isDeleteRequest ? t('entry.requestDelete') : t('entry.requestEdit')}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                          <span className="rounded bg-[var(--color-dropdown-hover)] px-1.5 py-0.5 text-xs font-medium">{row.categoryKey}</span>
                          <span className="mx-1.5">&middot;</span>
                          <span className="truncate">{row.ownerEmail}</span>
                        </div>
                        {relative && (
                          <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Requested {relative}</div>
                        )}
                        {!isDeleteRequest && row.editRequestMessage ? (
                          <div className="mt-1 text-xs text-[var(--color-text-secondary)] italic">&ldquo;{row.editRequestMessage}&rdquo;</div>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={row.entryHref}
                        className={getButtonClass("context")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </Link>
                      {isDeleteRequest ? (
                        <>
                          <ActionButton
                            role="destructive"
                            onClick={() =>
                              requestConfirmation({
                                title: t('confirm.deleteTitle'),
                                description: t('confirm.deleteMessage'),
                                confirmLabel: t('confirm.deleteConfirm'),
                                cancelLabel: t('confirm.cancel'),
                                variant: "destructive",
                                onConfirm: () => resolve(row, "approve_delete"),
                              })
                            }
                            disabled={busy}
                          >
                            {busy ? t('common.loading') : t('confirm.deleteConfirm')}
                          </ActionButton>
                          <ActionButton
                            role="context"
                            onClick={() =>
                              requestConfirmation({
                                title: t('admin.reject'),
                                description: t('entry.permanentlyLocked'),
                                confirmLabel: t('admin.reject'),
                                cancelLabel: t('confirm.cancel'),
                                onConfirm: () => resolve(row, "reject_delete"),
                              })
                            }
                            disabled={busy}
                          >
                            {t('admin.reject')}
                          </ActionButton>
                        </>
                      ) : (
                        <>
                          <ActionButton
                            role="context"
                            onClick={() =>
                              requestConfirmation({
                                title: t('admin.grant'),
                                description: t('entry.requestEdit'),
                                confirmLabel: t('admin.grant'),
                                cancelLabel: t('confirm.cancel'),
                                onConfirm: () => resolve(row, "grant"),
                              })
                            }
                            disabled={busy}
                          >
                            {busy ? t('entry.saving') : t('admin.grant')}
                          </ActionButton>
                          <ActionButton
                            role="destructive"
                            onClick={() =>
                              requestConfirmation({
                                title: t('admin.reject'),
                                description: t('entry.permanentlyLocked'),
                                confirmLabel: t('admin.reject'),
                                cancelLabel: t('confirm.cancel'),
                                variant: "destructive",
                                onConfirm: () => resolve(row, "reject"),
                              })
                            }
                            disabled={busy}
                          >
                            {t('admin.reject')}
                          </ActionButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      </>)}
      {confirmationDialog}
    </div>
  );
}
