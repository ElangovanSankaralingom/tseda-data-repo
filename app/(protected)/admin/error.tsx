"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toUserMessage } from "@/lib/errors";
import { adminHome, dashboard } from "@/lib/entryNavigation";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-12 text-red-400" />
        <h2 className="mt-4 text-base font-medium text-slate-700">Admin action failed</h2>
        <p className="mt-2 text-sm text-slate-500">{toUserMessage(error)}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Try again
          </button>
          <Link
            href={adminHome()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to Admin
          </Link>
          <Link
            href={dashboard()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
