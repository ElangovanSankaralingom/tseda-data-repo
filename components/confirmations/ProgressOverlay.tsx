"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import type { ProgressNotification } from "@/lib/confirmations/types";

export default function ProgressOverlay({ progress: p, onDismiss }: { progress: ProgressNotification; onDismiss: () => void }) {
  const isComplete = p.status !== "running";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--color-modal-overlay)] backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-modal-bg)] p-6 shadow-2xl animate-scale-in">
        {/* Status icon */}
        <div className="flex justify-center mb-4">
          {p.status === "running" && (
            <Loader2 className="size-10 text-[var(--color-text-secondary)] animate-spin" />
          )}
          {p.status === "success" && (
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="size-6 text-emerald-600" />
            </div>
          )}
          {p.status === "error" && (
            <div className="flex size-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="size-6 text-red-600" />
            </div>
          )}
        </div>

        <h3 className="text-center text-base font-semibold text-[var(--color-text-primary)]">{p.title}</h3>

        {p.message && (
          <p className="mt-1 text-center text-sm text-[var(--color-text-secondary)]">{p.message}</p>
        )}

        {/* Progress bar */}
        {p.status === "running" && p.progress != null && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-dropdown-hover)]">
              <div
                className="h-full rounded-full bg-[var(--color-button-primary-bg)] transition-all duration-300"
                style={{ width: `${Math.min(p.progress, 100)}%` }}
              />
            </div>
            <div className="mt-1 text-center text-xs text-[var(--color-text-secondary)] tabular-nums">
              {Math.round(p.progress)}%
            </div>
          </div>
        )}

        {/* Result */}
        {isComplete && p.result && (
          <p className={`mt-3 text-center text-sm ${p.status === "error" ? "text-red-600" : "text-[var(--color-text-secondary)]"}`}>
            {p.result.summary}
          </p>
        )}

        {/* Dismiss button (only when complete) */}
        {isComplete && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg bg-[var(--color-button-primary-bg)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-button-primary-hover)]"
            >
              {p.status === "success" ? "Done" : "Close"}
            </button>
          </div>
        )}

        {/* Elapsed time */}
        {p.status === "running" && (
          <div className="mt-3 text-center text-xs text-[var(--color-text-secondary)]">
            Running...
          </div>
        )}
      </div>
    </div>
  );
}
