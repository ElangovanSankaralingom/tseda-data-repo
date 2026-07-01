"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Check, Clock, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "@/lib/i18n/useTranslation";

type BetaStatus = "none" | "requested" | "member";
type BetaResponse = { data: { status: BetaStatus } };

export default function BetaProgramCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, mutate } = useApi<BetaResponse>("/api/me/beta");
  const [status, setStatus] = useState<BetaStatus>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.data?.status) setStatus(data.data.status);
  }, [data]);

  const act = useCallback(
    async (method: "POST" | "DELETE") => {
      setBusy(true);
      const wasMember = status === "member";
      try {
        const res = await fetch("/api/me/beta", { method });
        if (res.ok) {
          const body = (await res.json()) as BetaResponse;
          setStatus(body.data.status);
          void mutate();
          // Leaving as a member drops beta features (dark/Tamil) — reload so the
          // server layout re-clamps the theme.
          if (wasMember && body.data.status === "none") router.refresh();
        }
      } finally {
        setBusy(false);
      }
    },
    [status, mutate, router],
  );

  const isMember = status === "member";
  const isRequested = status === "requested";

  return (
    <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-5">
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--color-palette-violet-bg)", color: "var(--color-palette-violet-fg)" }}
        >
          <FlaskConical className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("beta.programTitle")}</h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("beta.programDesc")}</p>

          <div className="mt-3">
            {isMember ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-status-success)]">
                  <Check className="size-3.5" />
                  {t("beta.member")}
                </span>
                <button
                  type="button"
                  onClick={() => act("DELETE")}
                  disabled={busy}
                  className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-60"
                >
                  {t("beta.leave")}
                </button>
              </div>
            ) : isRequested ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-warning-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-status-warning)]">
                  <Clock className="size-3.5" />
                  {t("beta.pending")}
                </span>
                <button
                  type="button"
                  onClick={() => act("DELETE")}
                  disabled={busy}
                  className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-60"
                >
                  {t("beta.cancelRequest")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => act("POST")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-button-primary-bg)] px-3.5 py-2 text-xs font-semibold text-[var(--color-button-primary-text)] transition-colors hover:bg-[var(--color-button-primary-hover)] disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
                {t("beta.join")}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
