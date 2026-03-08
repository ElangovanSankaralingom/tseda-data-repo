"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { ActionButton } from "@/components/ui/ActionButton";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { toUserMessage } from "@/lib/errors";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { safeAction } from "@/lib/safeAction";

type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: string;
  entryId: string;
  title: string;
  sentForConfirmationAtISO: string | null;
  createdAtISO?: string | null;
  updatedAtISO?: string | null;
  status: string;
  entryHref: string;
};

function formatTimestamp(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

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

export default function AdminConfirmationsClient() {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
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

  const pendingCount = useMemo(() => rows.length, [rows]);

  async function resolve(row: PendingConfirmationRow, decision: "approve" | "reject", reason?: string) {
    const key = getRowKey(row);
    setBusyKey(key);
    setError(null);

    // Map UI decision labels to API values
    const apiDecision = decision === "approve" ? "grant" : "reject";

    const result = await safeAction(
      async () => {
        const response = await fetch("/api/admin/confirmations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerEmail: row.ownerEmail,
            categoryKey: row.categoryKey,
            entryId: row.entryId,
            decision: apiDecision,
            ...(reason ? { reason } : {}),
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to ${decision}.`);
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
      <SectionCard>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="size-8 text-emerald-400" />
            </div>
            <p className="mt-4 text-base font-medium text-slate-600">No pending requests</p>
            <p className="mt-1 text-sm text-slate-400">All caught up! Check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const rowKey = getRowKey(row);
              const busy = busyKey === rowKey;
              const relative = formatRelativeTime(row.sentForConfirmationAtISO);

              return (
                <div
                  key={rowKey}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Avatar + User Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white">
                        {getInitials(row.ownerEmail)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{row.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">{row.categoryKey}</span>
                          <span className="mx-1.5">·</span>
                          <span className="truncate">{row.ownerEmail}</span>
                        </div>
                        {relative && (
                          <div className="mt-0.5 text-xs text-slate-400">Requested {relative}</div>
                        )}
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
                      <ActionButton
                        role="context"
                        onClick={() =>
                          requestConfirmation({
                            title: "Grant edit access?",
                            description:
                              "This will allow the user to edit and re-generate this entry.",
                            confirmLabel: "Grant",
                            cancelLabel: "Cancel",
                            onConfirm: () => resolve(row, "approve"),
                          })
                        }
                        disabled={busy}
                      >
                        {busy ? "Saving..." : "Grant"}
                      </ActionButton>
                      <ActionButton
                        role="destructive"
                        onClick={() =>
                          requestConfirmation({
                            title: "Reject edit request?",
                            description:
                              "This will deny the edit request and return the entry to its finalized state. The user will be notified.",
                            confirmLabel: "Reject",
                            cancelLabel: "Cancel",
                            variant: "destructive",
                            onConfirm: () => resolve(row, "reject"),
                          })
                        }
                        disabled={busy}
                      >
                        Reject
                      </ActionButton>
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
      {confirmationDialog}
    </div>
  );
}
