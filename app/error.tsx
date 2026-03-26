"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toUserMessage } from "@/lib/errors";
import { dashboard } from "@/lib/entryNavigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="w-full rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-12 text-red-400" />
        <h2 className="mt-4 text-base font-medium text-[var(--color-text-secondary)]">Something went wrong</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{toUserMessage(error)}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-dropdown-hover)]"
          >
            Try again
          </button>
          <Link
            href={dashboard()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-dropdown-hover)]"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
