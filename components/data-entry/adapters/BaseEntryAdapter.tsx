"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { SYSTEM } from "@/lib/constants/messages";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { createCategoryEntryRecordRenderer } from "@/components/data-entry/CategoryEntryRecordCard";
import FormErrorBoundary from "@/components/ErrorBoundaryFallback";
import CancelConfirmationModal from "@/components/data-entry/CancelConfirmationModal";
import CategoryEntryRuntime from "@/components/data-entry/CategoryEntryRuntime";
import EntryListSkeleton from "@/components/data-entry/EntryListSkeleton";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { createGroupedEntryListCard } from "@/components/data-entry/GroupedEntrySections";
import AutoSaveIndicator from "@/components/entry/AutoSaveIndicator";
import SharedProvenanceBanner from "@/components/entry/SharedProvenanceBanner";
import EntryDocumentSection from "@/components/data-entry/EntryDocumentSection";
import { useCategoryEntryPageController } from "@/hooks/useCategoryEntryPageController";
import { getEntryApprovalStatus } from "@/lib/confirmation";
import { useEntryEditor } from "@/hooks/useEntryEditor";
import { useCommitDraft } from "@/hooks/useCommitDraft";
import { useGenerateEntry } from "@/hooks/useGenerateEntry";
import { useSeedEntry } from "@/hooks/useSeedEntry";
import { useEntryViewMode } from "@/hooks/useEntryViewMode";
import { useEntryFormAccess } from "@/hooks/useEntryFormAccess";
import { useEntryPageModeTelemetry } from "@/hooks/useEntryPageModeTelemetry";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { validatePreUploadFields } from "@/lib/categoryRequirements";
import { entryDetail, entryList, entryNew } from "@/lib/entryNavigation";
import {
  createDeleteEntry,
  createPersistProgress,
  createRefreshList,
} from "@/lib/entries/adapterOrchestration";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";
import { computeWorkflowState } from "@/lib/workflow";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/workflow/workflowConfig";
import type { CategoryKey } from "@/lib/entries/types";
import type { EntryRecord } from "@/components/data-entry/adapters/adapterTypes";

export type { EntryRecord };

/**
 * Context passed to the renderFormFields callback so the adapter
 * can render its category-specific form fields.
 */
export type FormFieldsContext<T extends EntryRecord> = {
  form: T;
  setForm: React.Dispatch<React.SetStateAction<T>>;
  submitted: boolean;
  submitAttemptedFinal: boolean;
  errors: Record<string, string>;
  isViewMode: boolean;
  coreFieldDisabled: (fieldKey: string) => boolean;
  controlsDisabled: boolean;
  pendingCoreLocked: boolean;
  pdfState: { pdfStale: boolean; canGenerate: boolean; canPreviewDownload: boolean };
  uploadsVisible: boolean;
  /** Call to persist a mutation to the entry (e.g., after upload) */
  persistCurrentMutation: <TResult = T>(opts: {
    buildNextEntry: (current: T) => T;
    selectResult?: (persisted: T) => TResult;
  }) => Promise<TResult>;
  showToast: (type: "ok" | "err", msg: string, ms?: number) => void;
  uploadPersisting: boolean;
  setUploadPersistingCount: React.Dispatch<React.SetStateAction<number>>;
  /** Authenticated user email */
  email: string;
  /** Display name of the authenticated user */
  userDisplayName: string;
};

/**
 * Context passed to renderListEntryBody for category-specific list card rendering.
 */
export type ListEntryBodyContext<T extends EntryRecord> = {
  entry: T;
  group?: import("@/lib/entryCategorization").EntryListGroup;
};

export type BaseEntryAdapterProps<T extends EntryRecord> = CategoryAdapterPageProps & {
  /** Category key (e.g., "fdp-attended") */
  category: CategoryKey;
  /** Create an empty form object for a new entry */
  emptyForm: () => T;
  /** Normalize/hydrate an entry loaded from API (e.g., withAcademicProgressionCompatibility) */
  hydrateEntry?: (entry: T) => T;
  /** Category-specific field validation — return errors keyed by field name */
  validateFields: (form: T) => Record<string, string>;
  /** Render the category-specific form fields */
  renderFormFields: (ctx: FormFieldsContext<T>) => ReactNode;
  /** Build the title for list card entries */
  buildListEntryTitle: (entry: T) => string;
  /** Build the subtitle for list card entries */
  buildListEntrySubtitle?: (entry: T) => string;
  /** Render custom body content in list entry cards */
  renderListEntryBody?: (ctx: ListEntryBodyContext<T>) => ReactNode;
  /** Upload slots configuration for busy state tracking */
  uploadBusySources?: boolean[];
  /** Whether required uploads are complete (for completion tracking) */
  requiredUploadsComplete?: boolean;
  /** Callback to reset upload controllers when form is reset */
  resetUploadState?: () => void;
  /** File upload endpoint for this category */
  fileEndpoint?: string;
  /** Page title */
  title?: string;
  /** Page subtitle */
  subtitle?: string;
  /** Form card title */
  formTitle?: string;
  /** Form card subtitle */
  formSubtitle?: string;
  /** Delete confirmation description */
  deleteDescription?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BaseEntryAdapter<T extends EntryRecord>({
  category,
  viewEntryId,
  editEntryId,
  startInNewMode = false,
  emptyForm: createEmptyForm,
  hydrateEntry = (e) => e,
  validateFields,
  renderFormFields,
  buildListEntryTitle,
  buildListEntrySubtitle,
  renderListEntryBody,
  uploadBusySources = [],
  requiredUploadsComplete = true,
  resetUploadState: resetUploadStateProp,
  title: titleProp,
  subtitle: subtitleProp,
  deleteDescription,
}: BaseEntryAdapterProps<T>) {
  const { t } = useTranslation();
  const config = getCategoryConfig(category);
  const title = titleProp ?? config.label;
  const subtitle = subtitleProp ?? config.subtitle ?? "";
  const endpoint = `/api/me/${category}`;
  const categoryPath = entryList(category);

  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(startInNewMode);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [email, setEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [list, setList] = useState<T[]>([]);
  const [editorSeed, setEditorSeed] = useState<T>(() => createEmptyForm());
  const [uploadPersistingCount, setUploadPersistingCount] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelModalTarget, setCancelModalTarget] = useState(categoryPath);
  const [cancelSaving, setCancelSaving] = useState(false);
  const activeEntryId = editEntryId?.trim() || viewEntryId?.trim() || "";

  useEntryPageModeTelemetry({
    category,
    pagePath: `/data-entry/${category}`,
    editEntryId,
    startInNewMode,
  });


  const { isPreviewMode: isViewModeRaw, backHref, backDisabled } = useEntryViewMode(
    categoryPath,
    viewEntryId,
  );
  const entryForFinalizationCheck = activeEntryId ? list.find((e) => e.id === activeEntryId) : null;

  // Compute workflow state for the viewed entry (server response)
  const viewedWorkflow = useMemo(
    () => entryForFinalizationCheck ? computeWorkflowState(entryForFinalizationCheck as Record<string, unknown>, category, DEFAULT_WORKFLOW_CONFIG) : null,
    [entryForFinalizationCheck, category]
  );

  const isViewMode = isViewModeRaw || (viewedWorkflow?.isViewMode ?? false);

  const {
    draft: form,
    setDraft: setForm,
    dirty: formDirty,
    pdfState,
    fieldsGateOk: generateReady,
    actions: editorActions,
  } = useEntryEditor<T>({
    initialEntry: editorSeed,
    category,
    validatePrePdfFields: (draft) => validatePreUploadFields(category, draft as Record<string, unknown>),
  });

  const generateEntrySnapshot = useGenerateEntry<T>({
    category,
    hydrateEntry: (entry) => hydrateEntry(entry),
  });
  const commitDraftEntry = useCommitDraft<T>({
    category,
    hydrateEntry: (entry) => hydrateEntry(entry),
  });

  const viewedEntry = useMemo(
    () => (activeEntryId ? list.find((item) => item.id === activeEntryId) ?? null : null),
    [activeEntryId, list],
  );
  const loadedEntryId = viewedEntry?.id ?? null;
  const loadEditorEntry = editorActions.loadEntry;
  const isEditing = formOpen || !!activeEntryId;
  const showForm = formOpen || (!!activeEntryId && (!isViewMode || !!viewedEntry));
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const errors = useMemo(() => validateFields(form), [form, validateFields]);

  const { entryLocked, controlsDisabled, pendingCoreLocked, coreFieldDisabled } = useEntryFormAccess({
    entry: form,
    category,
    isViewMode,
  });

  const uploadPersisting = uploadPersistingCount > 0;
  const uploadsVisible = !!form.pdfMeta;

  const resetUploadState = useCallback(() => {
    resetUploadStateProp?.();
  }, [resetUploadStateProp]);

  const refreshList = createRefreshList<T>({
    endpoint,
    normalizeItems: (items) => items.map((item) => hydrateEntry(item as T)),
    setList,
  });

  const persistProgress = createPersistProgress<T>({
    endpoint,
    category,
    buildBody: (entry) => ({ entry: hydrateEntry(entry) }),
    normalizeResponse: (data) => hydrateEntry(data as T),
  });

  const controller = useCategoryEntryPageController<T>({
    category,
    list,
    setList,
    form,
    formRef,
    showForm,
    isViewMode,
    entryLocked,
    controlsDisabled,
    loading,
    busyUploadSources: [...uploadBusySources, uploadPersisting],
    coreValid: generateReady,
    hasPdfSnapshot: uploadsVisible,
    pdfStale: pdfState.pdfStale,
    completionValid: requiredUploadsComplete,
    fieldDirty: formDirty,
    autoSaveSynced: !formDirty,
    defaultCancelTargetHref: categoryPath,
    closeForm,
    buildEntryToSave: () => hydrateEntry({ ...formRef.current }),
    buildOptimisticEntry: (entryToSave) => ({
      ...entryToSave,
      updatedAt: new Date().toISOString(),
    }),
    persistProgress,
    normalizePersistedEntry: (entry) => {
      const hydrated = hydrateEntry(entry);
      // After server normalization, recompute pdfSourceHash so it matches
      // the hash of the server's normalized stage 1 fields.
      // This prevents false "Document outdated" from server-side normalization.
      if (hydrated.pdfMeta?.url && hydrated.pdfMeta?.storedPath) {
        const serverHash = hashPrePdfFields(hydrated, category);
        return { ...hydrated, pdfSourceHash: serverHash } as typeof hydrated;
      }
      return hydrated;
    },
    persistRequestEdit: async (entry) => {
      const response = await fetch("/api/me/entry/confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: category, entryId: entry.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(String(payload?.error || "Request failed."));
      }
      return payload as T;
    },
    persistCancelRequestEdit: async (entry) => {
      const status = getEntryApprovalStatus(entry);
      if (status === "EDIT_GRANTED") {
        const response = await fetch(`/api/me/${category}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel_edit_grant", id: entry.id }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(String(payload?.error || "Cancel edit grant failed."));
        }
        return payload as T;
      }
      const response = await fetch("/api/me/entry/confirmation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: category, entryId: entry.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(String(payload?.error || "Cancel request failed."));
      }
      return payload as T;
    },
    persistRequestDelete: async (entry) => {
      const response = await fetch("/api/me/entry/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: category, entryId: entry.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(String(payload?.error || "Request failed."));
      }
      return payload as T;
    },
    persistCancelRequestDelete: async (entry) => {
      const response = await fetch("/api/me/entry/delete-request", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: category, entryId: entry.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(String(payload?.error || "Cancel request failed."));
      }
      return payload as T;
    },
    commitDraft: commitDraftEntry,
    applyPersistedEntry: (entry) => {
      setEditorSeed(entry);
      editorActions.saveDraft(entry);
      markAutoSaveSaved(entry);
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
    },
    afterPersistSuccess: async () => {
      void refreshList();
    },
    setSubmitAttemptedFinal,
    hasValidationErrors: Object.keys(errors).length > 0,
    markGenerateAttempted: () => setSubmitted(true),
    buildDraftEntry: () => {
      const latestForm = formRef.current;
      return {
        ...latestForm,
        pdfStale: pdfState.pdfStale,
        pdfSourceHash: latestForm.pdfSourceHash || "",
      };
    },
    generateEntrySnapshot,
    applyGeneratedEntry: async (generatedEntry) => {
      const nextEntry = {
        ...generatedEntry,
        pdfSourceHash: hashPrePdfFields(generatedEntry, category),
        pdfStale: false,
      };
      setEditorSeed(nextEntry);
      editorActions.generatePdf(nextEntry);
      markAutoSaveSaved(nextEntry);
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      await refreshList();
    },
  });

  const {
    autoSaveFailed,
    autoSaveStatus,
    cancelRequestEdit,
    finaliseEntry,
    getHeaderActionProps,
    getPdfActionProps,
    smartGroupedEntries,
    handleCancel,
    hasUnsavedChanges,
    markAutoSaveSaved,
    persistCurrentMutation,
    requestEdit,
    requestingEditIds,
    sendForConfirmation,
    sendingConfirmationIds,
    setToast,
    showToast,
    toast,
  } = controller;

  // Warn user before closing tab/navigating away with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Compute workflow state from the current form (for button states)
  const workflowState = useMemo(
    () => computeWorkflowState(
      form as Record<string, unknown>,
      category,
      DEFAULT_WORKFLOW_CONFIG,
      { saving: controller.saving, loading, hasBusyUploads: uploadBusySources.length > 0, fieldsDirty: formDirty },
    ),
    [form, category, controller.saving, loading, uploadBusySources.length, formDirty]
  );

  // --- Initial data load ---
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const meResponse = await fetch("/api/me", { cache: "no-store" });
        const me = await meResponse.json();
        const nextEmail = String(me?.email ?? "").trim();
        if (!meResponse.ok || !nextEmail) {
          throw new Error("Missing email. Please sign in again.");
        }
        setEmail(nextEmail);
        setUserDisplayName(
          String(me?.officialName ?? me?.userPreferredName ?? nextEmail.split("@")[0]).trim(),
        );
        const listResponse = await fetch(`${endpoint}?_t=${Date.now()}`, { cache: "no-store" });
        const body = await listResponse.json();
        if (!listResponse.ok) {
          throw new Error(body?.error?.message || body?.error || `Failed to load ${title} records.`);
        }
        // Support both envelope { data: [...] } and legacy plain array responses
        const items = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setList(items.map((item: unknown) => hydrateEntry(item as T)));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch list when navigating back to list view (e.g. closing a form)
  const prevActiveEntryIdRef = useRef(activeEntryId);
  useEffect(() => {
    const prev = prevActiveEntryIdRef.current;
    prevActiveEntryIdRef.current = activeEntryId;
    // When activeEntryId transitions from a value to empty, we navigated back to the list
    if (prev && !activeEntryId && !loading) {
      void refreshList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntryId]);

  // --- Form management ---
  function resetForm() {
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextForm = createEmptyForm();
    setEditorSeed(nextForm);
    loadEditorEntry(nextForm);
    resetUploadState();
  }

  function closeForm(targetHref = categoryPath, skipConfirm = false) {
    if (!skipConfirm && hasUnsavedChanges) {
      setCancelModalTarget(targetHref);
      setCancelModalOpen(true);
      return;
    }
    resetForm();
    setFormOpen(false);
    router.push(targetHref);
  }

  function handleCancelDiscard() {
    setCancelModalOpen(false);
    resetForm();
    setFormOpen(false);
    router.push(cancelModalTarget);
  }

  async function handleCancelSaveDraft() {
    setCancelSaving(true);
    try {
      await controller.saveDraftChanges?.();
    } finally {
      setCancelSaving(false);
      setCancelModalOpen(false);
      resetForm();
      setFormOpen(false);
      router.push(cancelModalTarget);
    }
  }

  const seedLoadedEntry = useCallback(
    (loadedEntry: T) => {
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      setEditorSeed(loadedEntry);
      loadEditorEntry(loadedEntry);
      resetUploadState();
      setFormOpen(true);
    },
    [loadEditorEntry, resetUploadState],
  );

  useSeedEntry({
    loading,
    loadedEntry: viewedEntry,
    loadedEntryId,
    editorSeedId: editorSeed?.id ?? null,
    onSeed: seedLoadedEntry,
  });

  // --- Delete ---
  const deleteEntry = createDeleteEntry<T>({
    endpoint,
    category,
    buildBody: (id) => ({ id }),
    setList,
    refreshList,
    onDeletedActiveEntry: (id) => {
      if (activeEntryId === id) closeForm(categoryPath, true);
    },
    showToast,
  });

  // --- List entry rendering ---
  const renderSavedEntry = createCategoryEntryRecordRenderer<T>({
    buildHref: (entry) => entryDetail(category, entry.id),
    buildTitle: buildListEntryTitle,
    buildSubtitle: buildListEntrySubtitle,
    onView: (entry) => router.push(entryDetail(category, entry.id)),
    onEdit: (entry) => {
      router.push(entryDetail(category, entry.id), { scroll: false });
    },
    hideActions: (entry) => !!(activeEntryId && entry.id === activeEntryId),
    enableWorkflowActions: (_entry, group) => group === "locked_in",
    deleteLabel: t('entry.delete'),
    requestConfirmation,
    buildDeleteRequest: (entry) => ({
      title: t('confirm.deleteTitle'),
      description: deleteDescription ?? t('confirm.deleteMessage'),
      confirmLabel: t('confirm.deleteConfirm'),
      cancelLabel: t('confirm.cancel'),
      variant: "destructive",
      onConfirm: () => deleteEntry(entry.id),
    }),
    requestingEditIds,
    requestingDeleteIds: controller.requestingDeleteIds,
    requestInFlightIds: controller.requestInFlightIds,
    sendingConfirmationIds,
    requestEdit: (entry) => void requestEdit(entry),
    cancelRequestEdit: (entry) => void cancelRequestEdit(entry),
    requestDelete: (entry) => void controller.requestDelete(entry),
    cancelRequestDelete: (entry) => void controller.cancelRequestDelete(entry),
    sendForConfirmation: (entry) => void sendForConfirmation(entry),
    renderBody: renderListEntryBody
      ? (entry: T, group?: import("@/lib/entryCategorization").EntryListGroup) => renderListEntryBody({ entry, group })
      : () => null,
  });

  // --- Form fields context ---
  const formFieldsCtx: FormFieldsContext<T> = {
    form,
    setForm,
    submitted,
    submitAttemptedFinal,
    errors,
    isViewMode,
    coreFieldDisabled,
    controlsDisabled,
    pendingCoreLocked,
    pdfState,
    uploadsVisible,
    persistCurrentMutation,
    showToast,
    uploadPersisting,
    setUploadPersistingCount,
    email,
    userDisplayName,
  };

  // --- Render ---
  return (
    <>
    {autoSaveFailed && (
      <div className="sticky top-0 z-40 mx-[-1rem] flex items-center gap-2 rounded-none border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-4 py-2.5 text-sm text-[var(--color-status-warning)] shadow-sm sm:mx-0 sm:rounded-lg">
        <AlertTriangle className="size-4 shrink-0" />
        <span>{SYSTEM.autoSaveFailed}</span>
      </div>
    )}
    <CategoryEntryRuntime
      entryShell={{
        category,
        mode: isViewMode ? "view" : showForm ? (activeEntryId ? "edit" : "new") : "preview",
        entry: showForm ? (form as Record<string, unknown>) : null,
        title,
        subtitle,
        status: showForm ? getEntryApprovalStatus(form) : undefined,
        meta: showForm && !isViewMode ? <AutoSaveIndicator status={autoSaveStatus} /> : null,
        showUnsavedChanges: showForm && !isViewMode && hasUnsavedChanges,
        backHref,
        backDisabled,
        onBack: showForm || isViewMode ? () => handleCancel(categoryPath) : undefined,
      }}
      headerActions={getHeaderActionProps({
        onAdd: () => {
          resetForm();
          router.push(entryNew(category), { scroll: false });
        },
        addLabel: `Add ${config.label} Entry`,
        formHasData: formDirty,
        workflowAction: (() => {
          if (!showForm || workflowState.isViewMode) return undefined;
          if (!workflowState.buttons.generate.visible) return undefined;
          if (workflowState.buttons.generate.enabled || !workflowState.completion.pdfExists || !workflowState.completion.pdfFresh) {
            return {
              label: workflowState.buttons.generate.label,
              onClick: () => controller.generateEntry(),
              disabled: !workflowState.buttons.generate.enabled,
              busyLabel: t('entry.generating'),
            };
          }
          return undefined;
        })(),
        finalise: (() => {
          if (!showForm || workflowState.isViewMode) return undefined;
          if (!workflowState.buttons.finalise.visible) return undefined;
          return {
            canFinalise: workflowState.buttons.finalise.enabled,
            onFinalise: () => finaliseEntry(form),
            onAfterFinalise: () => closeForm(categoryPath, true),
            disabledReason: workflowState.buttons.finalise.disabledReason,
          };
        })(),
        entryStatus: form.confirmationStatus,
        editRequestPending: workflowState.requestState.hasActiveRequest && workflowState.requestState.requestType === "edit",
        deleteRequestPending: workflowState.requestState.hasActiveRequest && workflowState.requestState.requestType === "delete",
        onRequestEdit: () => void controller.requestEdit(form).then(() => {
          setForm((prev) => ({ ...prev, confirmationStatus: "EDIT_REQUESTED", requestEditStatus: "pending", requestActionUsed: true } as T));
        }),
        onCancelRequestEdit: () => void controller.cancelRequestEdit(form).then(() => {
          setForm((prev) => ({ ...prev, confirmationStatus: "GENERATED", requestEditStatus: "none", permanentlyLocked: true } as T));
        }),
        onRequestDelete: () => void controller.requestDelete(form).then(() => {
          setForm((prev) => ({ ...prev, confirmationStatus: "DELETE_REQUESTED", requestActionUsed: true } as T));
        }),
        onCancelRequestDelete: () => void controller.cancelRequestDelete(form).then(() => {
          setForm((prev) => ({ ...prev, confirmationStatus: "GENERATED", permanentlyLocked: true } as T));
        }),
        onBack: () => closeForm(categoryPath),
        permanentlyLocked: workflowState.isPermanentlyLocked,
        requestActionUsed: workflowState.requestState.requestActionUsed,
      })}
      loading={loading}
      showForm={showForm}
      toast={toast}
      onDismissToast={() => setToast(null)}
      formCard={
        showForm
          ? {
              className: "bg-[var(--color-glass-bg)]/70 p-5",
              content: (
                <>
                  <SharedProvenanceBanner
                    sourceEmail={(form as { sourceEmail?: string | null }).sourceEmail}
                  />
                  <FormErrorBoundary fallbackMessage="Something went wrong loading the form.">
                    {renderFormFields(formFieldsCtx)}
                  </FormErrorBoundary>

                  {/* Compact document bar */}
                  <div className="mt-5">
                    <EntryDocumentSection
                      pdfMeta={form.pdfMeta ?? null}
                      pdfStale={pdfState.pdfStale}
                      canPreview={getPdfActionProps(form.pdfMeta ?? null).canPreview}
                      canDownload={getPdfActionProps(form.pdfMeta ?? null).canDownload}
                      onRegenerate={() => void controller.generateEntry()}
                      generating={controller.saving}
                      isViewMode={isViewMode}
                      permanentlyLocked={form.permanentlyLocked === true}
                    />
                  </div>
                </>
              ),
            }
          : null
      }
      listCard={
        isEditing
          ? null
          : loading && list.length === 0
            ? {
                title: `Saved ${config.label} Entries`,
                subtitle: "Your saved records are stored locally and keyed by your signed-in email.",
                content: <EntryListSkeleton count={3} />,
                stats: { total: 1, drafts: 0, active: 0, finalized: 0, pending: 0, streakActive: 0 },
              }
            : createGroupedEntryListCard({
                title: `Saved ${config.label} Entries`,
                subtitle: "Your saved records are stored locally and keyed by your signed-in email.",
                groupedEntries: smartGroupedEntries,
                renderEntry: renderSavedEntry,
              })
      }
      confirmationDialog={confirmationDialog}
      onRequestEdit={() => void controller.requestEdit(form).then(() => {
        setForm((prev) => ({ ...prev, confirmationStatus: "EDIT_REQUESTED", requestEditStatus: "pending", requestActionUsed: true } as T));
      })}
      onCancelRequestEdit={() => void controller.cancelRequestEdit(form).then(() => {
        setForm((prev) => ({ ...prev, confirmationStatus: "GENERATED", requestEditStatus: "none", permanentlyLocked: true } as T));
      })}
      onCancelRequestDelete={() => void controller.cancelRequestDelete(form).then(() => {
        setForm((prev) => ({ ...prev, confirmationStatus: "GENERATED", permanentlyLocked: true } as T));
      })}
    />
    <CancelConfirmationModal
      open={cancelModalOpen}
      onSaveDraft={() => void handleCancelSaveDraft()}
      onDiscard={handleCancelDiscard}
      onClose={() => setCancelModalOpen(false)}
      saving={cancelSaving}
    />
    </>
  );
}
