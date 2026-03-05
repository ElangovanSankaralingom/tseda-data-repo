"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BackTo from "@/components/nav/BackTo";
import { ActionButton } from "@/components/ui/ActionButton";
import { adminHome } from "@/lib/navigation";

type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: string;
  entryId: string;
  title: string;
  sentForConfirmationAtISO: string | null;
  status: string;
};

function formatTimestamp(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AdminConfirmationsPage() {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rows, setRows] = useState<PendingConfirmationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/confirmations", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load confirmation queue.");
      }
      setRows(Array.isArray(payload) ? (payload as PendingConfirmationRow[]) : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load confirmation queue.");
      setRows([]);
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

    try {
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
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to ${decision}.`);
      }

      setRows((current) => current.filter((item) => !(item.categoryKey === row.categoryKey && item.entryId === row.entryId)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `Failed to ${decision}.`);
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
                      <ActionButton onClick={() => void resolve(row, "approve")} disabled={busy}>
                        {busy ? "Saving..." : "Approve"}
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => void resolve(row, "reject")} disabled={busy}>
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
    </div>
  );
}
