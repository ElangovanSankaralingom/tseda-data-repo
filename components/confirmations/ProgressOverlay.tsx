"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import type { ProgressNotification } from "@/lib/confirmations/types";

export default function ProgressOverlay({ progress: p, onDismiss }: { progress: ProgressNotification; onDismiss: () => void }) {
  const isComplete = p.status !== "running";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-in">
        {/* Status icon */}
        <div className="flex justify-center mb-4">
          {p.status === "running" && (
            <Loader2 className="size-10 text-slate-600 animate-spin" />
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

        <h3 className="text-center text-base font-semibold text-slate-900">{p.title}</h3>

        {p.message && (
          <p className="mt-1 text-center text-sm text-slate-500">{p.message}</p>
        )}

        {/* Progress bar */}
        {p.status === "running" && p.progress != null && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-300"
                style={{ width: `${Math.min(p.progress, 100)}%` }}
              />
            </div>
            <div className="mt-1 text-center text-xs text-slate-400 tabular-nums">
              {Math.round(p.progress)}%
            </div>
          </div>
        )}

        {/* Result */}
        {isComplete && p.result && (
          <p className={`mt-3 text-center text-sm ${p.status === "error" ? "text-red-600" : "text-slate-600"}`}>
            {p.result.summary}
          </p>
        )}

        {/* Dismiss button (only when complete) */}
        {isComplete && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              {p.status === "success" ? "Done" : "Close"}
            </button>
          </div>
        )}

        {/* Elapsed time */}
        {p.status === "running" && (
          <div className="mt-3 text-center text-xs text-slate-400">
            Running...
          </div>
        )}
      </div>
    </div>
  );
}
