"use client";

import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { dashboard } from "@/lib/navigation";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h2 className="text-2xl font-semibold">Request failed</h2>
      <p className="max-w-xl text-sm text-muted-foreground">{toUserMessage(error)}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Try again
        </button>
        <Link
          href={dashboard()}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
