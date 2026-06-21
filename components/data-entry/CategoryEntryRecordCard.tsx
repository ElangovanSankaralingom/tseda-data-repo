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
import { useTranslation } from "@/lib/i18n/useTranslation";
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
  deleteLabel,
  requestEdit,
  requestDelete,
  requestInFlight = false,
  permanentlyLocked = false,
  requestActionUsed = false,
  children,
}: CategoryEntryRecordCardProps) {
  const { t } = useTranslation();
  const resolvedDeleteLabel = deleteLabel || t('common.delete');
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
                  <ActionButton role="primary" onClick={onEdit}>{t('entry.continue')}</ActionButton>
                ) : null}
                {onDelete ? (
                  <ActionButton role="ghost" onClick={onDelete} className="text-[var(--color-status-error)] hover:text-[var(--color-status-error)] hover:bg-[var(--color-status-error-bg)]">
                    {resolvedDeleteLabel}
                  </ActionButton>
                ) : null}
              </>
            ) : null}

            {/* GENERATED (editable): Edit · Delete */}
            {isEditable && !isUnlocked ? (
              <>
                {onEdit ? (
                  <ActionButton role="primary" onClick={onEdit}>
                    {t('entry.edit')}
                  </ActionButton>
                ) : null}
                {onDelete ? (
                  <ActionButton role="ghost" onClick={onDelete} className="text-[var(--color-status-error)] hover:text-[var(--color-status-error)] hover:bg-[var(--color-status-error-bg)]">
                    {resolvedDeleteLabel}
                  </ActionButton>
                ) : null}
              </>
            ) : null}

            {/* EDIT_GRANTED (unlocked): Continue */}
            {isUnlocked ? (
              <>
                {onEdit ? (
                  <ActionButton role="primary" onClick={onEdit}>
                    {t('entry.continue')}
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
                  className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-surface-panel-tile)] hover:-translate-y-px active:scale-[0.97]"
                >
                  {t('entry.view')}
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
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel-tile)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-badge-bg)] hover:-translate-y-px active:scale-[0.97]"
                >
                  {t('entry.view')}
                </button>
                {confirmationStatus === "EDIT_REQUESTED" && requestEdit?.onCancel ? (
                  <ActionButton role="ghost" onClick={requestEdit.onCancel} disabled={requestInFlight} className="text-[var(--color-status-warning)] hover:text-[var(--color-status-warning)] hover:bg-[var(--color-status-warning-bg)] disabled:opacity-50">
                    {requestInFlight ? t('entry.cancellingRequest') : t('entry.cancelEditRequest')}
                  </ActionButton>
                ) : null}
                {confirmationStatus === "DELETE_REQUESTED" && requestDelete?.onCancel ? (
                  <ActionButton role="ghost" onClick={requestDelete.onCancel} disabled={requestInFlight} className="text-[var(--color-status-error)] hover:text-[var(--color-status-error)] hover:bg-[var(--color-status-error-bg)] disabled:opacity-50">
                    {requestInFlight ? t('entry.cancellingRequest') : t('entry.cancelDeleteRequest')}
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
        {renderBody(entry, group)}
      </CategoryEntryRecordCard>
    );
  }

  return RenderCategoryEntryRecord;
}
