"use client";

import { useCallback, useState } from "react";
import { Trash2, RotateCcw, X, Inbox } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatDate } from "@/lib/i18n/locale";
import { adminBin } from "@/lib/entryNavigation";

type BinEntry = {
  trashId: string;
  category: string;
  entryTitle: string;
  ownerEmail: string;
  quarantinedAtISO: string;
};

export default function BinClient({ initialEntries }: { initialEntries: BinEntry[] }) {
  const { t, categoryLabel, language } = useTranslation();
  const [entries, setEntries] = useState<BinEntry[]>(initialEntries);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);

  const act = useCallback(async (action: "restore" | "purge", trashId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(adminBin().replace("/admin/", "/api/admin/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, trashId }),
      });
      const data = (await res.json()) as { entries?: BinEntry[]; error?: string };
      if (!res.ok) {
        setError(data.error || t("common.error"));
        return;
      }
      if (data.entries) setEntries(data.entries);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
      setConfirmPurge(null);
    }
  }, [t]);

  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center"
        style={{ background: "var(--color-surface-inset)", border: "1px dashed var(--color-border-default)" }}
      >
        <Inbox className="size-8 text-[var(--color-icon-muted)]" />
        <p className="text-sm text-[var(--color-text-tertiary)]">{t("bin.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--color-status-error-bg)", border: "1px solid var(--color-status-error-border)", color: "var(--color-status-error)" }}
        >
          {error}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-tertiary)]">{t("bin.manualNote")}</p>

      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.trashId} className="flex items-center justify-between gap-3 rounded-2xl p-4" style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border-default)" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{e.entryTitle || e.trashId}</span>
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-subtle)" }}>
                  {categoryLabel(e.category)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                {e.ownerEmail} · {formatDate(e.quarantinedAtISO, language)}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => act("restore", e.trashId)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50"
                style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}
              >
                <RotateCcw className="size-3.5" />
                {t("bin.restore")}
              </button>

              {confirmPurge === e.trashId ? (
                <>
                  <button
                    type="button"
                    onClick={() => act("purge", e.trashId)}
                    disabled={busy}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ background: "var(--color-status-error-bg)", border: "1px solid var(--color-status-error-border)", color: "var(--color-status-error)" }}
                  >
                    {t("bin.purge")}
                  </button>
                  <button type="button" onClick={() => setConfirmPurge(null)} className="rounded-lg p-1.5 text-[var(--color-text-tertiary)]" aria-label={t("common.cancel")}>
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPurge(e.trashId)}
                  className="rounded-lg p-2 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-status-error)]"
                  aria-label={t("bin.purge")}
                  title={t("bin.purgeConfirm")}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
