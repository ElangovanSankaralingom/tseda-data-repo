"use client";

import { isWithinRequestEditWindow } from "@/lib/entryLock";

type RequestEditStatus = "none" | "pending" | "approved" | "rejected" | undefined;

export default function RequestEditAction({
  locked,
  status,
  requestedAtISO,
  requesting,
  onRequest,
  onCancel,
}: {
  locked: boolean;
  status: RequestEditStatus;
  requestedAtISO?: string | null;
  requesting: boolean;
  onRequest: () => void;
  onCancel: () => void;
}) {
  if (!locked) return null;

  const currentStatus = status ?? "none";
  const canCancelRequest =
    currentStatus === "pending" &&
    isWithinRequestEditWindow(requestedAtISO ?? null, 5) &&
    !requesting;

  if (currentStatus === "approved") {
    return (
      <button
        type="button"
        disabled
        className="pointer-events-none inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-border px-3 text-sm opacity-60"
      >
        Approved
      </button>
    );
  }

  if (currentStatus === "pending" || requesting) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          className="pointer-events-none inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-border px-3 text-sm opacity-60"
        >
          Request Sent
        </button>
        {canCancelRequest ? (
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer text-xs text-muted-foreground underline transition-colors hover:text-foreground"
          >
            Cancel Request
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onRequest}
        className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border px-3 text-sm transition hover:bg-muted"
      >
        Request Edit
      </button>
      {currentStatus === "rejected" ? (
        <span className="text-xs text-muted-foreground">Request was rejected</span>
      ) : null}
    </div>
  );
}
