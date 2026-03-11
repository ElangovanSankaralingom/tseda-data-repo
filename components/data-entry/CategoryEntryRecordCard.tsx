"use client";

import EntryListCardShell from "@/components/data-entry/EntryListCardShell";
import RequestActionDropdown from "@/components/entry/RequestActionDropdown";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  canSendForConfirmation,
  getEntryApprovalStatus,
  isEntryLockedFromStatus,
} from "@/lib/confirmation";
import {
  getEntryEditTime,
  type EntryListGroup,
} from "@/lib/entryCategorization";
import { isEntryCommitted } from "@/lib/entries/workflow";
import {
  type CategoryEntryRenderEntry,
  type CategoryEntryRecordCardProps,
  type CategoryEntryRecordRendererOptions,
} from "./dataEntryTypes";

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
  onEdit,
  onDelete,
  deleteLabel = "Delete",
  requestEdit,
  requestDelete,
  requestInFlight = false,
  permanentlyLocked = false,
  requestActionUsed = false,
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

            {/* GENERATED (editable): Edit · Delete */}
            {isEditable && !isUnlocked ? (
              <>
                {onEdit ? (
                  <ActionButton role="primary" onClick={onEdit}>
                    Edit
                  </ActionButton>
                ) : null}
                {onDelete ? (
                  <ActionButton role="ghost" onClick={onDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    {deleteLabel}
                  </ActionButton>
                ) : null}
              </>
            ) : null}

            {/* EDIT_GRANTED (unlocked): Continue */}
            {isUnlocked ? (
              <>
                {onEdit ? (
                  <ActionButton role="primary" onClick={onEdit} className="!bg-purple-600 hover:!bg-purple-700">
                    Continue
                  </ActionButton>
                ) : null}
              </>
            ) : null}

            {/* FINALIZED: View · Request Action dropdown */}
            {isFinalized ? (
              <>
                <button
                  type="button"
                  onClick={onView}
                  className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                >
                  View
                </button>
                {!permanentlyLocked && !requestActionUsed && requestEdit && requestDelete ? (
                  <RequestActionDropdown
                    onRequestEdit={requestEdit.onRequest}
                    onRequestDelete={requestDelete.onRequest}
                    requesting={requestInFlight || requestEdit.requesting || requestDelete.requesting}
                  />
                ) : null}
              </>
            ) : null}

            {/* UNDER REVIEW (EDIT_REQUESTED / DELETE_REQUESTED): View · Cancel Request */}
            {isUnderReview ? (
              <>
                <button
                  type="button"
                  onClick={onView}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-[0.97]"
                >
                  View
                </button>
                {confirmationStatus === "EDIT_REQUESTED" && requestEdit?.onCancel ? (
                  <ActionButton role="ghost" onClick={requestEdit.onCancel} disabled={requestInFlight} className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                    {requestInFlight ? "Cancelling..." : "Cancel Edit Request"}
                  </ActionButton>
                ) : null}
                {confirmationStatus === "DELETE_REQUESTED" && requestDelete?.onCancel ? (
                  <ActionButton role="ghost" onClick={requestDelete.onCancel} disabled={requestInFlight} className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50">
                    {requestInFlight ? "Cancelling..." : "Cancel Delete Request"}
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
  requestingDeleteIds,
  requestInFlightIds,
  sendingConfirmationIds,
  requestEdit,
  cancelRequestEdit,
  requestDelete,
  cancelRequestDelete,
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
        requestDelete={{
          requesting: !!requestingDeleteIds[entry.id],
          onRequest: () => void requestDelete(entry),
          onCancel: () => void cancelRequestDelete(entry),
        }}
        requestInFlight={!!requestInFlightIds[entry.id]}
        permanentlyLocked={entry.permanentlyLocked === true}
        requestActionUsed={(entry as Record<string, unknown>).requestActionUsed === true}
      >
        {renderBody(entry)}
      </CategoryEntryRecordCard>
    );
  }

  return RenderCategoryEntryRecord;
}
