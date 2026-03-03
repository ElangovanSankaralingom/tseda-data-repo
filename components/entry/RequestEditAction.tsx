"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import { isWithinRequestEditWindow } from "@/lib/entries/lock";

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
      <ActionButton disabled>
        Approved
      </ActionButton>
    );
  }

  if (currentStatus === "pending" || requesting) {
    return (
      <div className="flex items-center gap-2">
        <ActionButton disabled>
          Request Sent
        </ActionButton>
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
      <ActionButton variant="ghost" onClick={onRequest}>
        Request Edit
      </ActionButton>
      {currentStatus === "rejected" ? (
        <span className="text-xs text-muted-foreground">Request was rejected</span>
      ) : null}
    </div>
  );
}
