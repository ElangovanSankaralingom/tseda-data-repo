"use client";

import EntryListCardShell from "@/components/data-entry/EntryListCardShell";
import EntryLockBadge from "@/components/entry/EntryLockBadge";
import RequestEditAction from "@/components/entry/RequestEditAction";
import { ActionButton } from "@/components/ui/ActionButton";
import { getConfirmationStatusLabel } from "@/lib/confirmation";
import type { EntryDisplayCategory, EntryStreakDisplayState } from "@/lib/entries/displayLifecycle";
import type { StreakDeadlineState } from "@/lib/streakDeadline";
import type { EntryStatus } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";

type RequestEditControls = {
  locked: boolean;
  status?: RequestEditStatus;
  requestedAtISO?: string | null;
  requesting: boolean;
  onRequest: () => void;
  onCancel: () => void;
};

type SendForConfirmationControls = {
  disabled: boolean;
  sending: boolean;
  onClick: () => void;
  label?: string;
  pendingLabel?: string;
  sendingLabel?: string;
};

type CategoryEntryRecordCardProps = {
  category: EntryDisplayCategory;
  index: number;
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  streakState?: EntryStreakDisplayState;
  deadlineState: StreakDeadlineState;
  confirmationStatus?: EntryStatus | string | null;
  createdAt?: string;
  updatedAt?: string;
  hideActions?: boolean;
  onView: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  sendForConfirmation?: SendForConfirmationControls;
  requestEdit?: RequestEditControls;
  children?: React.ReactNode;
};

function getSendLabel(
  confirmationStatus: CategoryEntryRecordCardProps["confirmationStatus"],
  sendForConfirmation: SendForConfirmationControls
) {
  if (sendForConfirmation.sending) {
    return sendForConfirmation.sendingLabel ?? "Sending...";
  }

  if (confirmationStatus === "PENDING_CONFIRMATION") {
    return sendForConfirmation.pendingLabel ?? "Pending Confirmation";
  }

  return sendForConfirmation.label ?? "Send for Confirmation";
}

export default function CategoryEntryRecordCard({
  category,
  index,
  href,
  title,
  subtitle,
  streakState = "none",
  deadlineState,
  confirmationStatus,
  createdAt,
  updatedAt,
  hideActions = false,
  onView,
  onPreview,
  onEdit,
  onDelete,
  deleteLabel = "Delete Entry",
  sendForConfirmation,
  requestEdit,
  children,
}: CategoryEntryRecordCardProps) {
  const isLocked = requestEdit?.locked ?? false;

  return (
    <EntryListCardShell
      category={category}
      index={index}
      href={href}
      title={title}
      subtitle={subtitle}
      streakState={streakState}
      createdAt={createdAt}
      updatedAt={updatedAt}
      badges={
        <>
          <EntryLockBadge deadlineState={deadlineState} />
          {confirmationStatus ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {getConfirmationStatusLabel(confirmationStatus)}
            </span>
          ) : null}
        </>
      }
      actions={
        !hideActions ? (
          <div className="flex items-center gap-2">
            <ActionButton onClick={onView}>View</ActionButton>

            {isLocked ? (
              <ActionButton role="context" onClick={onPreview} disabled={!onPreview}>
                Preview
              </ActionButton>
            ) : (
              <>
                {onEdit ? <ActionButton onClick={onEdit}>Edit</ActionButton> : null}
                {onDelete ? (
                  <ActionButton role="destructive" onClick={onDelete}>
                    {deleteLabel}
                  </ActionButton>
                ) : null}
                {sendForConfirmation ? (
                  <ActionButton
                    onClick={sendForConfirmation.onClick}
                    disabled={sendForConfirmation.disabled || sendForConfirmation.sending}
                  >
                    {getSendLabel(confirmationStatus, sendForConfirmation)}
                  </ActionButton>
                ) : null}
              </>
            )}

            {requestEdit ? (
              <RequestEditAction
                locked={requestEdit.locked}
                status={requestEdit.status}
                requestedAtISO={requestEdit.requestedAtISO}
                requesting={requestEdit.requesting}
                onRequest={requestEdit.onRequest}
                onCancel={requestEdit.onCancel}
              />
            ) : null}
          </div>
        ) : null
      }
    >
      {children}
    </EntryListCardShell>
  );
}
