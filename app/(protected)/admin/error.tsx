"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toUserMessage } from "@/lib/errors";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-12 text-[var(--color-status-error)]" />
        <h2 className="mt-4 text-base font-medium text-[var(--color-text-secondary)]">{t("adminPages.adminActionFailed")}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{toUserMessage(error)}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-dropdown-hover)]"
          >
            {t("adminPages.tryAgain")}
          </button>
          <Link
            href={adminHome()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-dropdown-hover)]"
          >
            {t("adminPages.backToAdmin")}
          </Link>
          <Link
            href={dashboard()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-dropdown-hover)]"
          >
            {t("nav.dashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
