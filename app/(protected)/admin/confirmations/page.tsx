"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import BackTo from "@/components/nav/BackTo";
import { ActionButton } from "@/components/ui/ActionButton";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { toUserMessage } from "@/lib/errors";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { adminHome } from "@/lib/navigation";
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

export default function AdminConfirmationsPage() {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rows, setRows] = useState<PendingConfirmationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await safeAction(async () => {
      const response = await fetch("/api/admin/confirmations", { cache: "no-store" });
      const payload = (await response.json()) as PendingConfirmationRow[] | { error?: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string })?.error || "Failed to load confirmation queue.");
      }
      return Array.isArray(payload) ? payload : [];
    }, {
      context: "admin.confirmations.loadQueue",
    });

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

  async function resolve(row: PendingConfirmationRow, decision: "approve" | "reject") {
    const key = `${row.categoryKey}:${row.entryId}`;
    setBusyKey(key);
    setError(null);

    const result = await safeAction(async () => {
      const response = await fetch("/api/admin/confirmations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: row.ownerEmail,
          categoryKey: row.categoryKey,
          entryId: row.entryId,
          decision,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to ${decision}.`);
      }
    }, {
      context: `admin.confirmations.${decision}`,
    });

    try {
      if (!result.ok) {
        setError(toUserMessage(result.error));
        return;
      }

      setRows((current) => current.filter((item) => !(item.categoryKey === row.categoryKey && item.entryId === row.entryId)));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={adminHome()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entry Confirmations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review entries sent for confirmation. Locked mode activates only after approval.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-4 text-sm text-muted-foreground">
          Pending confirmation requests: <span className="font-medium text-foreground">{pendingCount}</span>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pending confirmations.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const rowKey = `${row.categoryKey}:${row.entryId}`;
              const busy = busyKey === rowKey;

              return (
                <div key={rowKey} className="rounded-xl border border-border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{row.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.categoryKey} • {row.ownerEmail}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Sent: {formatTimestamp(row.sentForConfirmationAtISO)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={row.entryHref}
                        className={getButtonClass("context")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </Link>
                      <ActionButton role="context" onClick={() => void resolve(row, "approve")} disabled={busy}>
                        {busy ? "Saving..." : "Approve"}
                      </ActionButton>
                      <ActionButton
                        role="destructive"
                        onClick={() =>
                          requestConfirmation({
                            title: "Reject confirmation request?",
                            description:
                              "This changes the entry status to Rejected and sends it back for user edits.",
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
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {confirmationDialog}
    </div>
  );
}
