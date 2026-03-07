"use client";

import EntryListCardShell from "@/components/data-entry/EntryListCardShell";
import EntryLockBadge from "@/components/entry/EntryLockBadge";
import RequestEditAction from "@/components/entry/RequestEditAction";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  canSendForConfirmation,
  getConfirmationStatusLabel,
  getEntryApprovalStatus,
  isEntryLockedFromStatus,
} from "@/lib/confirmation";
import {
  getEntryStreakDisplayState,
  type EntryDisplayCategory,
  type EntryStreakDisplayState,
} from "@/lib/entries/displayLifecycle";
import { isEntryCommitted } from "@/lib/entries/stateMachine";
import type { StreakDeadlineState } from "@/lib/streakDeadline";
import { getStreakDeadlineState } from "@/lib/streakDeadline";
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

type DeleteConfirmationRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
};

type CategoryEntryRenderEntry = {
  id: string;
  status?: string | null;
  confirmationStatus?: EntryStatus | string | null;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  committedAtISO?: string | null;
  streak?: unknown;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pdfMeta?: {
    url?: string | null;
  } | null;
};

type CategoryEntryRecordRendererOptions<TEntry extends CategoryEntryRenderEntry> = {
  buildHref: (entry: TEntry) => string;
  buildTitle: (entry: TEntry) => React.ReactNode;
  buildSubtitle?: (entry: TEntry) => React.ReactNode;
  renderBody: (entry: TEntry) => React.ReactNode;
  onView: (entry: TEntry) => void;
  onEdit?: (entry: TEntry) => void;
  onPreview?: (entry: TEntry) => void;
  previewUrl?: (entry: TEntry) => string | null | undefined;
  hideActions?: (entry: TEntry, category: EntryDisplayCategory) => boolean;
  enableWorkflowActions?: (entry: TEntry, category: EntryDisplayCategory) => boolean;
  deleteLabel?: string | ((entry: TEntry) => string);
  requestConfirmation?: (request: DeleteConfirmationRequest) => void;
  buildDeleteRequest?: (entry: TEntry) => DeleteConfirmationRequest;
  requestingEditIds: Record<string, boolean | undefined>;
  sendingConfirmationIds: Record<string, boolean | undefined>;
  requestEdit: (entry: TEntry) => void | Promise<void>;
  cancelRequestEdit: (entry: TEntry) => void | Promise<void>;
  sendForConfirmation: (entry: TEntry) => void | Promise<void>;
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

export function createCategoryEntryRecordRenderer<TEntry extends CategoryEntryRenderEntry>({
  buildHref,
  buildTitle,
  buildSubtitle,
  renderBody,
  onView,
  onEdit,
  onPreview,
  previewUrl,
  hideActions,
  enableWorkflowActions,
  deleteLabel,
  requestConfirmation,
  buildDeleteRequest,
  requestingEditIds,
  sendingConfirmationIds,
  requestEdit,
  cancelRequestEdit,
  sendForConfirmation,
}: CategoryEntryRecordRendererOptions<TEntry>) {
  function RenderCategoryEntryRecord(entry: TEntry, category: EntryDisplayCategory, index: number) {
    const workflowEnabled = enableWorkflowActions?.(entry, category) ?? true;
    const confirmationStatus = workflowEnabled ? getEntryApprovalStatus(entry) : undefined;
    const lockApproved = workflowEnabled ? isEntryLockedFromStatus(entry) : false;
    const canRenderSendAction = workflowEnabled && isEntryCommitted(entry);
    const resolvedDeleteRequest = buildDeleteRequest?.(entry);
    const resolvedPreviewUrl = previewUrl?.(entry) ?? entry.pdfMeta?.url ?? null;

    return (
      <CategoryEntryRecordCard
        category={category}
        index={index}
        href={buildHref(entry)}
        title={buildTitle(entry)}
        subtitle={buildSubtitle?.(entry)}
        streakState={getEntryStreakDisplayState(entry)}
        deadlineState={getStreakDeadlineState(entry)}
        confirmationStatus={confirmationStatus}
        createdAt={entry.createdAt ?? undefined}
        updatedAt={entry.updatedAt ?? undefined}
        hideActions={hideActions?.(entry, category) ?? false}
        onView={() => onView(entry)}
        onPreview={
          onPreview
            ? () => onPreview(entry)
            : resolvedPreviewUrl
              ? () => window.open(resolvedPreviewUrl, "_blank", "noopener,noreferrer")
              : undefined
        }
        onEdit={lockApproved || !onEdit ? undefined : () => onEdit(entry)}
        onDelete={
          lockApproved || !requestConfirmation || !resolvedDeleteRequest
            ? undefined
            : () => requestConfirmation(resolvedDeleteRequest)
        }
        deleteLabel={
          typeof deleteLabel === "function" ? deleteLabel(entry) : deleteLabel
        }
        sendForConfirmation={
          canRenderSendAction
            ? {
                disabled: !canSendForConfirmation(entry),
                sending: !!sendingConfirmationIds[entry.id],
                onClick: () => void sendForConfirmation(entry),
              }
            : undefined
        }
        requestEdit={{
          locked: lockApproved,
          status: entry.requestEditStatus,
          requestedAtISO: entry.requestEditRequestedAtISO,
          requesting: !!requestingEditIds[entry.id],
          onRequest: () => void requestEdit(entry),
          onCancel: () => void cancelRequestEdit(entry),
        }}
      >
        {renderBody(entry)}
      </CategoryEntryRecordCard>
    );
  }

  return RenderCategoryEntryRecord;
}
