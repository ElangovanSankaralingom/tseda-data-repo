"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createCategoryEntryRecordRenderer } from "@/components/data-entry/CategoryEntryRecordCard";
import CategoryEntryRuntime from "@/components/data-entry/CategoryEntryRuntime";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { createGroupedEntryListCard } from "@/components/data-entry/GroupedEntrySections";
import AutoSaveIndicator from "@/components/entry/AutoSaveIndicator";
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

import { entryDetail, entryList, entryNew, safeBack } from "@/lib/entryNavigation";
import {
  createDeleteEntry,
  createPersistProgress,
  createRefreshList,
} from "@/lib/entries/adapterOrchestration";
import { getCategoryConfig } from "@/data/categoryRegistry";
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

function uuid() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  formTitle: formTitleProp,
  formSubtitle: formSubtitleProp,
  deleteDescription,
}: BaseEntryAdapterProps<T>) {
  const config = getCategoryConfig(category);
  const title = titleProp ?? config.label;
  const subtitle = subtitleProp ?? config.subtitle ?? "";
  const formTitle = formTitleProp ?? `${config.label} Entry`;
  const formSubtitle = formSubtitleProp ?? "Add the entry details and upload the required documents.";
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
  // IMPORTANT: isFinalized comes from the SERVER response (via entryToApiResponse).
  // Do NOT recompute on the client — the server is the single source of truth.
  const isViewMode = isViewModeRaw || (entryForFinalizationCheck as Record<string, unknown> | null)?.isFinalized === true;

  const {
    draft: form,
    setDraft: setForm,
    dirty: formDirty,
    pdfState,
    currentHash: prePdfFieldsHash,
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
    normalizePersistedEntry: (entry) => hydrateEntry(entry),
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
        pdfSourceHash: prePdfFieldsHash,
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
        const listResponse = await fetch(endpoint, { cache: "no-store" });
        const items = await listResponse.json();
        if (!listResponse.ok) {
          throw new Error(items?.error || `Failed to load ${title} records.`);
        }
        setList(Array.isArray(items) ? items.map((item) => hydrateEntry(item as T)) : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Form management ---
  function resetForm() {
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextForm = createEmptyForm();
    setEditorSeed(nextForm);
    loadEditorEntry(nextForm);
    resetUploadState();
  }

  function closeForm(targetHref = categoryPath) {
    resetForm();
    setFormOpen(false);
    safeBack(router, targetHref);
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
      if (activeEntryId === id) closeForm();
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
    deleteLabel: "Delete entry",
    requestConfirmation,
    buildDeleteRequest: (entry) => ({
      title: "Delete entry?",
      description: deleteDescription ?? `This permanently deletes this ${config.label} entry and its associated uploaded files.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: () => deleteEntry(entry.id),
    }),
    requestingEditIds,
    requestingDeleteIds: controller.requestingDeleteIds,
    sendingConfirmationIds,
    requestEdit: (entry) => void requestEdit(entry),
    cancelRequestEdit: (entry) => void cancelRequestEdit(entry),
    requestDelete: (entry) => void controller.requestDelete(entry),
    cancelRequestDelete: (entry) => void controller.cancelRequestDelete(entry),
    sendForConfirmation: (entry) => void sendForConfirmation(entry),
    renderBody: renderListEntryBody
      ? (entry: T) => renderListEntryBody({ entry })
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
          if (!showForm || isViewMode) return undefined;
          const pdfExists = !!form.pdfMeta || form.pdfGenerated === true || !!form.pdfGeneratedAt;
          const showGenerate = !pdfExists || pdfState.pdfStale;
          if (!showGenerate) return undefined;
          return {
            label: "Generate Entry",
            onClick: () => controller.generateEntry(),
            disabled: controller.actionState.generateDisabled,
            busyLabel: "Generating...",
          };
        })(),
        finalise: (() => {
          if (!showForm || isViewMode) return undefined;
          const hasPdf = !!form.pdfMeta || form.pdfGenerated === true || !!form.pdfGeneratedAt;
          if (!hasPdf) return undefined;
          if (pdfState.pdfStale) return undefined;
          return {
            canFinalise: true,
            onFinalise: () => finaliseEntry(form),
            onAfterFinalise: () => closeForm(categoryPath),
            disabledReason: undefined,
          };
        })(),
        entryStatus: form.confirmationStatus,
        onRequestEdit: () => void controller.requestEdit(form),
        onCancelRequestEdit: () => void controller.cancelRequestEdit(form),
        onRequestDelete: () => void controller.requestDelete(form),
        onCancelRequestDelete: () => void controller.cancelRequestDelete(form),
        onBack: () => closeForm(categoryPath),
        permanentlyLocked: form.permanentlyLocked === true,
      })}
      loading={loading}
      showForm={showForm}
      toast={toast}
      formCard={
        showForm
          ? {
              className: "bg-white/70 p-5",
              title: isViewMode ? formTitle : `New ${formTitle}`,
              subtitle: formSubtitle,
              content: (
                <>
                  {pendingCoreLocked ? (
                    <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Pending confirmation — core fields cannot be edited.
                    </p>
                  ) : null}

                  {renderFormFields(formFieldsCtx)}

                  <div className="mt-5 space-y-4">
                    <EntryDocumentSection
                      pdfMeta={form.pdfMeta ?? null}
                      pdfStale={pdfState.pdfStale}
                      canPreview={getPdfActionProps(form.pdfMeta ?? null).canPreview}
                      canDownload={getPdfActionProps(form.pdfMeta ?? null).canDownload}
                      onRegenerate={() => void controller.generateEntry()}
                      generating={controller.saving}
                      isViewMode={isViewMode}
                    />
                  </div>
                </>
              ),
            }
          : null
      }
      listCard={
        !loading && !isEditing
          ? createGroupedEntryListCard({
              title: `Saved ${config.label} Entries`,
              subtitle: "Your saved records are stored locally and keyed by your signed-in email.",
              groupedEntries: smartGroupedEntries,
              renderEntry: renderSavedEntry,
            })
          : null
      }
      confirmationDialog={confirmationDialog}
      onRequestEdit={() => void controller.requestEdit(form)}
      onCancelRequestEdit={() => void controller.cancelRequestEdit(form)}
    />
  );
}
