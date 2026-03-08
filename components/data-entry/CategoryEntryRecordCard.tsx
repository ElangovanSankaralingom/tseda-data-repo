"use client";

import { Lock } from "lucide-react";
import EntryListCardShell from "@/components/data-entry/EntryListCardShell";
import RequestEditAction from "@/components/entry/RequestEditAction";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  canSendForConfirmation,
  getEntryApprovalStatus,
  isEntryLockedFromStatus,
} from "@/lib/confirmation";
import {
  getEntryEditTime,
  getEntryListGroup,
  type EntryListGroup,
} from "@/lib/entryCategorization";
import { isEntryCommitted } from "@/lib/entries/stateMachine";
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
  streakEligible?: boolean;
  editWindowExpiresAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pdfMeta?: {
    url?: string | null;
  } | null;
};

type CategoryEntryRecordCardProps = {
  group: EntryListGroup;
  index: number;
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  metadata?: React.ReactNode;
  confirmationStatus?: EntryStatus | string | null;
  editTime?: ReturnType<typeof getEntryEditTime>;
  createdAt?: string;
  updatedAt?: string;
  hideActions?: boolean;
  onView: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFinalise?: () => void;
  deleteLabel?: string;
  sendForConfirmation?: SendForConfirmationControls;
  requestEdit?: RequestEditControls;
  children?: React.ReactNode;
};

function getActionLabel(group: EntryListGroup, defaultLabel: string): string {
  if (group === "in_the_works") return "Continue";
  return defaultLabel;
}

export default function CategoryEntryRecordCard({
  group,
  index,
  href,
  title,
  subtitle,
  metadata,
  confirmationStatus,
  editTime,
  createdAt,
  updatedAt,
  hideActions = false,
  onView,
  onPreview,
  onEdit,
  onDelete,
  onFinalise,
  deleteLabel = "Delete",
  sendForConfirmation,
  requestEdit,
  children,
}: CategoryEntryRecordCardProps) {
  const isDraft = group === "in_the_works";
  const isFinalized = group === "locked_in";
  const isUnderReview = group === "under_review";
  const isUnlocked = group === "unlocked";
  const isEditable = !isDraft && !isFinalized && !isUnderReview;

  return (
    <EntryListCardShell
      group={group}
      index={index}
      href={href}
      title={title}
      subtitle={subtitle}
      metadata={metadata}
      editTime={editTime}
      createdAt={createdAt}
      updatedAt={updatedAt}
      actions={
        !hideActions ? (
          <div className="flex items-center gap-2">
            {/* DRAFT: Continue | Delete */}
            {isDraft ? (
              <>
                {onEdit ? (
                  <ActionButton role="primary" onClick={onEdit}>Continue</ActionButton>
                ) : null}
                {onDelete ? (
                  <ActionButton role="ghost" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    {deleteLabel}
                  </ActionButton>
                ) : null}
              </>
            ) : null}

            {/* EDITABLE (generated, streak_runners, on_the_clock, unlocked): Edit | View | Finalise | Delete */}
            {isEditable ? (
              <>
                {onEdit ? (
                  <ActionButton
                    role="primary"
                    onClick={onEdit}
                    className={isUnlocked ? "!bg-purple-600 hover:!bg-purple-700" : undefined}
                  >
                    Edit
                  </ActionButton>
                ) : null}
                <ActionButton role="context" onClick={onView}>View</ActionButton>
                {onFinalise ? (
                  <button
                    type="button"
                    onClick={onFinalise}
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <Lock className="size-3.5" />
                    Finalise Now
                  </button>
                ) : null}
                {onDelete ? (
                  <ActionButton role="ghost" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    {deleteLabel}
                  </ActionButton>
                ) : null}
              </>
            ) : null}

            {/* FINALIZED: View | Request Edit | Delete */}
            {isFinalized ? (
              <>
                <ActionButton role="context" onClick={onView}>View</ActionButton>
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
                {onDelete ? (
                  <ActionButton role="ghost" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    {deleteLabel}
                  </ActionButton>
                ) : null}
              </>
            ) : null}

            {/* UNDER REVIEW: View | Cancel Request | Delete */}
            {isUnderReview ? (
              <>
                <ActionButton role="context" onClick={onView}>View</ActionButton>
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
                {onDelete ? (
                  <ActionButton role="ghost" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    {deleteLabel}
                  </ActionButton>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null
      }
    >
      {children}
    </EntryListCardShell>
  );
}

type CategoryEntryRecordRendererOptions<TEntry extends CategoryEntryRenderEntry> = {
  buildHref: (entry: TEntry) => string;
  buildTitle: (entry: TEntry) => React.ReactNode;
  buildSubtitle?: (entry: TEntry) => React.ReactNode;
  renderBody: (entry: TEntry) => React.ReactNode;
  onView: (entry: TEntry) => void;
  onEdit?: (entry: TEntry) => void;
  onFinalise?: (entry: TEntry) => void;
  canFinalise?: (entry: TEntry) => boolean;
  onPreview?: (entry: TEntry) => void;
  previewUrl?: (entry: TEntry) => string | null | undefined;
  hideActions?: (entry: TEntry, group: EntryListGroup) => boolean;
  enableWorkflowActions?: (entry: TEntry, group: EntryListGroup) => boolean;
  deleteLabel?: string | ((entry: TEntry) => string);
  requestConfirmation?: (request: DeleteConfirmationRequest) => void;
  buildDeleteRequest?: (entry: TEntry) => DeleteConfirmationRequest;
  requestingEditIds: Record<string, boolean | undefined>;
  sendingConfirmationIds: Record<string, boolean | undefined>;
  requestEdit: (entry: TEntry) => void | Promise<void>;
  cancelRequestEdit: (entry: TEntry) => void | Promise<void>;
  sendForConfirmation: (entry: TEntry) => void | Promise<void>;
};

export function createCategoryEntryRecordRenderer<TEntry extends CategoryEntryRenderEntry>({
  buildHref,
  buildTitle,
  buildSubtitle,
  renderBody,
  onView,
  onEdit,
  onFinalise,
  canFinalise,
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
  function RenderCategoryEntryRecord(entry: TEntry, group: EntryListGroup, index: number) {
    const workflowEnabled = enableWorkflowActions?.(entry, group) ?? true;
    const confirmationStatus = workflowEnabled ? getEntryApprovalStatus(entry) : undefined;
    const lockApproved = workflowEnabled ? isEntryLockedFromStatus(entry) : false;
    const canRenderSendAction = workflowEnabled && isEntryCommitted(entry);
    const resolvedDeleteRequest = buildDeleteRequest?.(entry);
    const resolvedPreviewUrl = previewUrl?.(entry) ?? entry.pdfMeta?.url ?? null;
    const editTime = getEntryEditTime(entry);

    return (
      <CategoryEntryRecordCard
        key={entry.id}
        group={group}
        index={index}
        href={buildHref(entry)}
        title={buildTitle(entry)}
        subtitle={buildSubtitle?.(entry)}
        confirmationStatus={confirmationStatus}
        editTime={editTime}
        createdAt={entry.createdAt ?? undefined}
        updatedAt={entry.updatedAt ?? undefined}
        hideActions={hideActions?.(entry, group) ?? false}
        onView={() => onView(entry)}
        onPreview={
          onPreview
            ? () => onPreview(entry)
            : resolvedPreviewUrl
              ? () => window.open(resolvedPreviewUrl, "_blank", "noopener,noreferrer")
              : undefined
        }
        onEdit={lockApproved || !onEdit ? undefined : () => onEdit(entry)}
        onFinalise={
          onFinalise && canFinalise?.(entry)
            ? () => onFinalise(entry)
            : undefined
        }
        onDelete={
          !requestConfirmation || !resolvedDeleteRequest
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
