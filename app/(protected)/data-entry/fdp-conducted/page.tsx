"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CategoryEntryPageShell from "@/components/data-entry/CategoryEntryPageShell";
import EntryListCardShell from "@/components/data-entry/EntryListCardShell";
import Field from "@/components/data-entry/Field";
import GroupedEntrySections from "@/components/data-entry/GroupedEntrySections";
import DateField from "@/components/controls/DateField";
import AutoSaveIndicator from "@/components/entry/AutoSaveIndicator";
import { EntryHeaderActionsBar, EntryPdfActionsBar } from "@/components/entry/EntryHeaderActions";
import EntryLockBadge from "@/components/entry/EntryLockBadge";
import RequestEditAction from "@/components/entry/RequestEditAction";
import UploadField from "@/components/entry/UploadField";
import UploadFieldMulti, { type FileMeta } from "@/components/entry/UploadFieldMulti";
import { ActionButton } from "@/components/ui/ActionButton";
import SelectDropdown from "@/components/controls/SelectDropdown";
import FacultyPickerRows, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import { useCategoryEntryPageController } from "@/hooks/useCategoryEntryPageController";
import { useEntryConfirmation } from "@/hooks/useEntryConfirmation";
import { FACULTY_DIRECTORY, type FacultyDirectoryEntry } from "@/lib/faculty-directory";
import {
  canSendForConfirmation,
  getConfirmationStatusLabel,
  getEntryApprovalStatus,
  isEntryLockedFromStatus,
} from "@/lib/confirmation";
import { getEntryStreakDisplayState, type EntryDisplayCategory } from "@/lib/entries/displayLifecycle";
import { useEntryEditor } from "@/hooks/useEntryEditor";
import { useCommitDraft } from "@/hooks/useCommitDraft";
import { useGenerateEntry } from "@/hooks/useGenerateEntry";
import { useRequestEdit } from "@/hooks/useRequestEdit";
import { useSeedEntry } from "@/hooks/useSeedEntry";
import { useEntryViewMode } from "@/hooks/useEntryViewMode";
import { useEntryFormAccess } from "@/hooks/useEntryFormAccess";
import { useEntryPageModeTelemetry } from "@/hooks/useEntryPageModeTelemetry";
import { useUploadController } from "@/hooks/useUploadController";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { validatePreUploadFields } from "@/lib/categoryRequirements";
import { getStreakDeadlineState } from "@/lib/streakDeadline";
import { entryDetail, entryList, entryNew, safeBack } from "@/lib/entryNavigation";
import {
  createOptimisticSnapshot,
  optimisticRemove,
} from "@/lib/ui/optimistic";
import { trackClientTelemetryEvent } from "@/lib/telemetry/client";
import { uploadFile } from "@/lib/upload/uploadService";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
  type YearOfStudy,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import type { EntryStatus } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";
import {
  type StreakState,
} from "@/lib/gamification";

type FdpConducted = {
  id: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  startDate: string;
  endDate: string;
  eventName: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultyRowValue[];
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  permissionLetter: FileMeta | null;
  geotaggedPhotos: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

type CurrentFaculty = {
  name: string;
  email: string;
};

const ACADEMIC_YEAR_OPTIONS = [
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
] as const;

const ACADEMIC_YEAR_DROPDOWN_OPTIONS = ACADEMIC_YEAR_OPTIONS.map((option) => ({
  label: option,
  value: option,
}));

const FACULTY_OPTIONS: FacultyDirectoryEntry[] = FACULTY_DIRECTORY;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function getAcademicYearRange(academicYear: string) {
  const match = academicYear.match(/^Academic Year (\d{4})-(\d{4})$/);
  if (!match) return null;

  const startYear = match[1];
  const endYear = match[2];

  return {
    start: `${startYear}-07-01`,
    end: `${endYear}-06-30`,
    label: `Jul 1, ${startYear} to Jun 30, ${endYear}`,
  };
}

function getInclusiveDays(startDate: string, endDate: string) {
  if (!isISODate(startDate) || !isISODate(endDate) || endDate < startDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function formatDisplayDate(value: string) {
  if (!isISODate(value)) return "-";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString();
}

function formatFacultyDisplay(selection: FacultyRowValue) {
  return selection.name || selection.email || "-";
}

function getConductedEntryTitle(entry: FdpConducted) {
  return entry.eventName.trim() || "Untitled event";
}

function getConductedEntrySubtitle(entry: FdpConducted) {
  const parts = [`Coordinator: ${entry.coordinatorName || entry.coordinatorEmail || "-"}`];

  if (entry.coCoordinators.length > 0) {
    parts.push(`Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`);
  }

  return parts.join(" • ");
}

function emptyForm(currentFaculty?: CurrentFaculty): FdpConducted {
  return withAcademicProgressionCompatibility({
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    yearOfStudy: "",
    currentSemester: null,
    startDate: "",
    endDate: "",
    eventName: "",
    coordinatorName: currentFaculty?.name ?? "",
    coordinatorEmail: currentFaculty?.email ?? "",
    coCoordinators: [],
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: null,
    geotaggedPhotos: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as FdpConducted;
}

function MiniButton(props: React.ComponentProps<typeof ActionButton>) {
  return <ActionButton {...props} />;
}

function uploadConductedFileXHR(opts: {
  email: string;
  recordId: string;
  slot: "permissionLetter";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { email, recordId, slot, file, onProgress } = opts;

  return uploadFile({
    endpoint: "/api/me/fdp-conducted-file",
    email,
    recordId,
    slot,
    file,
    onProgress,
  });
}

type FdpConductedPageProps = {
  viewEntryId?: string;
  editEntryId?: string;
  startInNewMode?: boolean;
};

export function FdpConductedPage({
  viewEntryId,
  editEntryId,
  startInNewMode = false,
}: FdpConductedPageProps = {}) {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const router = useRouter();
  const categoryPath = entryList("fdp-conducted");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(startInNewMode);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<CurrentFaculty | null>(null);
  const [list, setList] = useState<FdpConducted[]>([]);
  const [editorSeed, setEditorSeed] = useState<FdpConducted>(() => emptyForm());
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });
  const [uploadPersistingCount, setUploadPersistingCount] = useState(0);
  const activeEntryId = editEntryId?.trim() || viewEntryId?.trim() || "";

  useEntryPageModeTelemetry({
    category: "fdp-conducted",
    pagePath: "/data-entry/fdp-conducted",
    editEntryId,
    startInNewMode,
  });

  const { isPreviewMode: isViewMode, backHref, backDisabled } = useEntryViewMode(
    categoryPath,
    viewEntryId
  );
  const {
    draft: form,
    setDraft: setForm,
    dirty: formDirty,
    pdfState,
    currentHash: prePdfFieldsHash,
    fieldsGateOk: generateReady,
    actions: editorActions,
  } = useEntryEditor<FdpConducted>({
    initialEntry: editorSeed,
    category: "fdp-conducted",
    validatePrePdfFields: (draft) => validatePreUploadFields("fdp-conducted", draft as Record<string, unknown>),
  });
  const generateEntrySnapshot = useGenerateEntry<FdpConducted>({
    category: "fdp-conducted",
    email,
    hydrateEntry: (entry) => withAcademicProgressionCompatibility(entry),
  });
  const commitDraftEntry = useCommitDraft<FdpConducted>({
    category: "fdp-conducted",
    hydrateEntry: (entry) => withAcademicProgressionCompatibility(entry),
  });
  const viewedEntry = useMemo(
    () => (activeEntryId ? list.find((item) => item.id === activeEntryId) ?? null : null),
    [activeEntryId, list]
  );
  const loadedEntryId = viewedEntry?.id ?? null;
  const loadEditorEntry = editorActions.loadEntry;
  const isEditing = formOpen || !!activeEntryId;
  const showForm = formOpen || (!!activeEntryId && (!isViewMode || !!viewedEntry));
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (!ACADEMIC_YEAR_OPTIONS.includes(form.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
      nextErrors.academicYear = "Academic year is required.";
    }

    const normalizedYear = normalizeYearOfStudy(form.yearOfStudy);
    if (!normalizedYear) {
      nextErrors.yearOfStudy = "Year of study is required.";
    }

    if (normalizedYear && !isSemesterAllowed(normalizedYear, form.currentSemester ?? undefined)) {
      nextErrors.currentSemester = "Current semester is required.";
    }

    if (!isISODate(form.startDate)) {
      nextErrors.startDate = "Starting date is required.";
    } else {
      const academicYearRange = getAcademicYearRange(form.academicYear);
      if (academicYearRange && (form.startDate < academicYearRange.start || form.startDate > academicYearRange.end)) {
        nextErrors.startDate = `Starting date must fall within ${form.academicYear} (${academicYearRange.label}).`;
      }
    }

    if (!isISODate(form.endDate)) {
      nextErrors.endDate = "Ending date is required.";
    } else if (isISODate(form.startDate) && form.endDate < form.startDate) {
      nextErrors.endDate = "Ending date must be on or after starting date.";
    }

    if ((form.eventName || "").trim().length === 0) {
      nextErrors.eventName = "Event name is required.";
    }

    const emailCounts = new Map<string, number>();
    const selectedEmails = [form.coordinatorEmail, ...form.coCoordinators.map((value) => value.email)]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    for (const selectedEmail of selectedEmails) {
      emailCounts.set(selectedEmail, (emailCounts.get(selectedEmail) ?? 0) + 1);
    }

    form.coCoordinators.forEach((value, index) => {
      if (value.email && (emailCounts.get(value.email.toLowerCase()) ?? 0) > 1) {
        nextErrors[`coCoordinators.${index}`] = "This faculty is already selected in another role.";
      }
    });

    return nextErrors;
  }, [form]);

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const { entryLocked, controlsDisabled, pendingCoreLocked, coreFieldDisabled } = useEntryFormAccess({
    entry: form,
    category: "fdp-conducted",
    isViewMode,
  });
  const permissionController = useUploadController<FileMeta>({
    locked: controlsDisabled,
    upload: (file, onProgress) =>
      uploadConductedFileXHR({
        email,
        recordId: form.id,
        slot: "permissionLetter",
        file,
        onProgress,
      }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-conducted-file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }
    },
  });
  const uploadPersisting = uploadPersistingCount > 0;
  const uploadsVisible = !!form.pdfMeta;
  const requiredUploadsComplete = !!form.permissionLetter && form.geotaggedPhotos.length > 0;

  const resetUploadState = useCallback(() => {
    permissionController.reset();
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }, [permissionController]);

  function resetForm() {
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextForm = emptyForm(currentFaculty ?? undefined);
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
    (loadedEntry: FdpConducted) => {
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      setEditorSeed(loadedEntry);
      loadEditorEntry(loadedEntry);
      resetUploadState();
      setFormOpen(true);
    },
    [loadEditorEntry, resetUploadState]
  );

  useSeedEntry({
    loading,
    loadedEntry: viewedEntry,
    loadedEntryId,
    editorSeedId: editorSeed?.id ?? null,
    onSeed: seedLoadedEntry,
  });

  async function refreshList() {
    const response = await fetch(`/api/me/fdp-conducted?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
    });
    const items = await response.json();

    if (!response.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    const nextItems = Array.isArray(items)
      ? items.map((item) => withAcademicProgressionCompatibility(item as FdpConducted))
      : [];
    setList(nextItems);
    return nextItems;
  }

  async function persistProgress(nextForm: FdpConducted) {
    const startedAt = Date.now();
    const eventName = String(nextForm.createdAt ?? "").trim() ? "entry.update" : "entry.create";
    const response = await fetch("/api/me/fdp-conducted", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, entry: withAcademicProgressionCompatibility(nextForm) }),
    });
    const text = await response.text();
    let payload: FdpConducted | { error?: string } | null = null;
    let message = `Save failed (${response.status})`;

    try {
      payload = text ? (JSON.parse(text) as FdpConducted | { error?: string }) : null;
      if (payload && "error" in payload && payload.error) {
        message = payload.error;
      }
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorCode =
        response.status === 400
          ? "VALIDATION_ERROR"
          : response.status === 413
            ? "PAYLOAD_TOO_LARGE"
            : response.status === 429
              ? "RATE_LIMITED"
              : "IO_ERROR";
      void trackClientTelemetryEvent({
        event: "action.failure",
        category: "fdp-conducted",
        entryId: String(nextForm.id ?? "").trim() || null,
        success: false,
        durationMs: Date.now() - startedAt,
        meta: {
          action: eventName,
          source: "manual",
          errorCode,
          statusCode: response.status,
        },
      });
      if (errorCode === "VALIDATION_ERROR") {
        void trackClientTelemetryEvent({
          event: "validation.failure",
          category: "fdp-conducted",
          entryId: String(nextForm.id ?? "").trim() || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: { action: eventName, source: "manual", errorCode },
        });
      } else if (errorCode === "RATE_LIMITED") {
        void trackClientTelemetryEvent({
          event: "rate_limit.hit",
          category: "fdp-conducted",
          entryId: String(nextForm.id ?? "").trim() || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: { action: eventName, source: "manual", errorCode },
        });
      } else if (errorCode === "PAYLOAD_TOO_LARGE") {
        void trackClientTelemetryEvent({
          event: "payload.too_large",
          category: "fdp-conducted",
          entryId: String(nextForm.id ?? "").trim() || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: { action: eventName, source: "manual", errorCode },
        });
      }
      throw new Error(message);
    }

    const persisted = withAcademicProgressionCompatibility(payload as FdpConducted);
    void trackClientTelemetryEvent({
      event: eventName,
      category: "fdp-conducted",
      entryId: String(persisted?.id ?? nextForm.id ?? "").trim() || null,
      status:
        String(
          persisted?.confirmationStatus ??
            nextForm.confirmationStatus ??
            ""
        ).trim() || null,
      success: true,
      durationMs: Date.now() - startedAt,
      meta: {
        source: "manual",
      },
    });

    return persisted;
  }

  const controller = useCategoryEntryPageController<FdpConducted>({
    list,
    setList,
    form,
    formRef,
    showForm,
    isViewMode,
    entryLocked,
    controlsDisabled,
    loading,
    busyUploadSources: [permissionController.busy, photoUploadStatus.busy, uploadPersisting],
    coreValid: generateReady,
    hasPdfSnapshot: uploadsVisible,
    pdfStale: pdfState.pdfStale,
    completionValid: requiredUploadsComplete,
    fieldDirty: formDirty,
    autoSaveSynced: !formDirty,
    defaultCancelTargetHref: categoryPath,
    closeForm,
    buildEntryToSave: () => withAcademicProgressionCompatibility({ ...formRef.current }),
    buildOptimisticEntry: (entryToSave) => ({
      ...entryToSave,
      updatedAt: new Date().toISOString(),
    }),
    persistProgress,
    commitDraft: async (entryId) => commitDraftEntry(entryId),
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
        coordinatorName: currentFaculty?.name ?? latestForm.coordinatorName,
        coordinatorEmail: currentFaculty?.email ?? latestForm.coordinatorEmail,
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
    actionState,
    autoSaveStatus,
    generateEntry,
    groupedEntries,
    handleCancel,
    handleSaveAndClose,
    handleSaveDraft,
    hasUnsavedChanges,
    lifecycle,
    markAutoSaveSaved,
    saveIntent,
    saving,
    runWithSaveGuard,
    setToast,
    toast,
  } = controller;

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
        const nextFaculty = {
          email: nextEmail,
          name: String(me?.officialName ?? me?.userPreferredName ?? nextEmail.split("@")[0]).trim(),
        };
        const nextForm = emptyForm(nextFaculty);
        setCurrentFaculty(nextFaculty);
        setEditorSeed(nextForm);
        loadEditorEntry(nextForm);

        const listResponse = await fetch(`/api/me/fdp-conducted?email=${encodeURIComponent(nextEmail)}`, {
          cache: "no-store",
        });
        const items = await listResponse.json();

        if (!listResponse.ok) {
          throw new Error(items?.error || "Failed to load FDP Conducted records.");
        }

        setList(
          Array.isArray(items)
            ? items.map((item) => withAcademicProgressionCompatibility(item as FdpConducted))
            : []
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
  }, [loadEditorEntry, setToast]);
  const canGenerate = lifecycle.canGenerate;

  async function persistCoCoordinatorRows(nextRows: FacultyRowValue[]) {
    return runWithSaveGuard(async () => {
      const persisted = await persistProgress({
        ...form,
        coordinatorName: currentFaculty?.name ?? form.coordinatorName,
        coordinatorEmail: currentFaculty?.email ?? form.coordinatorEmail,
        coCoordinators: nextRows,
      });
      setEditorSeed(persisted);
      editorActions.saveDraft(persisted);
      markAutoSaveSaved(persisted);
      await refreshList();
      return persisted.coCoordinators;
    });
  }

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/fdp-conducted-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function uploadSlot() {
    const previousMeta = formRef.current.permissionLetter;

    try {
      const meta = await permissionController.uploadAndSave();
      if (!meta) return;

      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void deleteStoredFile(previousMeta.storedPath);
      }

      setUploadPersistingCount((current) => current + 1);
      try {
        const latestForm = formRef.current;
        const nextForm = {
          ...latestForm,
          permissionLetter: meta,
        };

        const persisted = await persistProgress(nextForm);
        setEditorSeed(persisted);
        editorActions.saveDraft(persisted);
        markAutoSaveSaved(persisted);
        await refreshList();
      } finally {
        setUploadPersistingCount((current) => Math.max(0, current - 1));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    }
  }

  async function deleteSlot(slot: "permissionLetter") {
    const meta = formRef.current[slot];
    if (!meta?.storedPath) {
      setToast({ type: "err", msg: "File path missing." });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const deleted = await permissionController.deleteFile(meta);
      if (!deleted) return;

      setUploadPersistingCount((current) => current + 1);
      try {
        const latestForm = formRef.current;
        const nextForm = {
          ...latestForm,
          permissionLetter: null,
        };
        const persisted = await persistProgress(nextForm);
        setEditorSeed(persisted);
        editorActions.saveDraft(persisted);
        markAutoSaveSaved(persisted);
        await refreshList();
      } finally {
        setUploadPersistingCount((current) => Math.max(0, current - 1));
      }

      setToast({ type: "ok", msg: "File deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  async function deleteEntry(id: string) {
    const startedAt = Date.now();
    let failureTracked = false;
    let rollbackSnapshot: FdpConducted[] | null = null;
    setList((current) => {
      rollbackSnapshot = createOptimisticSnapshot(current);
      return optimisticRemove(current, id);
    });

    try {
      const response = await fetch("/api/me/fdp-conducted", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, id }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const errorCode =
          response.status === 400
            ? "VALIDATION_ERROR"
            : response.status === 413
              ? "PAYLOAD_TOO_LARGE"
              : response.status === 429
                ? "RATE_LIMITED"
                : "IO_ERROR";
        void trackClientTelemetryEvent({
          event: "action.failure",
          category: "fdp-conducted",
          entryId: id,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            action: "entry.delete",
            source: "manual",
            errorCode,
            statusCode: response.status,
          },
        });
        failureTracked = true;
        throw new Error(payload?.error || "Delete failed.");
      }

      void trackClientTelemetryEvent({
        event: "entry.delete",
        category: "fdp-conducted",
        entryId: id,
        success: true,
        durationMs: Date.now() - startedAt,
        meta: {
          source: "manual",
        },
      });
      setList((current) => optimisticRemove(current, id));
      void refreshList();
      setToast({ type: "ok", msg: "Entry deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      if (rollbackSnapshot) {
        setList(rollbackSnapshot);
      }
      if (!failureTracked) {
        void trackClientTelemetryEvent({
          event: "action.failure",
          category: "fdp-conducted",
          entryId: id,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            action: "entry.delete",
            source: "manual",
            errorCode: "IO_ERROR",
          },
        });
      }
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  const { requestingIds: requestingEditIds, requestEdit, cancelRequestEdit } = useRequestEdit<FdpConducted>({
    setItems: setList,
    persistRequest: async (entry) => {
      const response = await fetch(`/api/me/fdp-conducted/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_edit" }),
      });
      const payload = (await response.json()) as FdpConducted | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in payload && payload.error) || "Request failed.");
      }

      return payload as FdpConducted;
    },
    persistCancel: async (entry) => {
      const response = await fetch(`/api/me/fdp-conducted/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_request_edit" }),
      });
      const payload = (await response.json()) as FdpConducted | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in payload && payload.error) || "Cancel request failed.");
      }

      return payload as FdpConducted;
    },
    onSuccess: (message) => {
      setToast({ type: "ok", msg: message });
      setTimeout(() => setToast(null), 1400);
    },
    onError: (message) => {
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    },
  });
  const { sendingIds: sendingConfirmationIds, sendForConfirmation } = useEntryConfirmation<FdpConducted>({
    category: "fdp-conducted",
    setItems: setList,
    onSuccess: (message) => {
      setToast({ type: "ok", msg: message });
      setTimeout(() => setToast(null), 1400);
    },
    onError: (message) => {
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    },
  });

  function renderSavedEntry(entry: FdpConducted, category: EntryDisplayCategory, index: number) {
    const deadlineState = getStreakDeadlineState(entry);
    const isCompleted = category === "completed";
    const confirmationStatus = isCompleted ? getEntryApprovalStatus(entry) : undefined;
    const lockApproved = isCompleted ? isEntryLockedFromStatus(entry) : false;
    const canSendConfirmation = isCompleted ? canSendForConfirmation(entry) : false;
    const sendingConfirmation = isCompleted ? !!sendingConfirmationIds[entry.id] : false;

    return (
      <EntryListCardShell
        category={category}
        index={index}
        href={entryDetail("fdp-conducted", entry.id)}
        title={getConductedEntryTitle(entry)}
        streakState={getEntryStreakDisplayState(entry)}
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
        subtitle={getConductedEntrySubtitle(entry)}
        createdAt={entry.createdAt}
        updatedAt={entry.updatedAt}
        actions={
          !(activeEntryId && entry.id === activeEntryId) ? (
            <div className="flex items-center gap-2">
              <MiniButton onClick={() => router.push(entryDetail("fdp-conducted", entry.id))}>View</MiniButton>
              {lockApproved ? (
                <>
                  {entry.pdfMeta?.url ? (
                    <MiniButton
                      role="context"
                      onClick={() => window.open(entry.pdfMeta?.url, "_blank", "noopener,noreferrer")}
                    >
                      Preview
                    </MiniButton>
                  ) : (
                    <MiniButton role="context" disabled>
                      Preview
                    </MiniButton>
                  )}
                  <RequestEditAction
                    locked
                    status={entry.requestEditStatus}
                    requestedAtISO={entry.requestEditRequestedAtISO}
                    requesting={!!requestingEditIds[entry.id]}
                    onRequest={() => void requestEdit(entry)}
                    onCancel={() => void cancelRequestEdit(entry)}
                  />
                </>
              ) : (
                <>
                  <MiniButton
                    onClick={() => {
                      router.push(entryDetail("fdp-conducted", entry.id), { scroll: false });
                    }}
                  >
                    Edit
                  </MiniButton>
                  <MiniButton
                    role="destructive"
                    onClick={() =>
                      requestConfirmation({
                        title: "Delete entry?",
                        description:
                          "This permanently deletes this FDP entry and its associated uploaded files.",
                        confirmLabel: "Delete",
                        cancelLabel: "Cancel",
                        variant: "destructive",
                        onConfirm: () => deleteEntry(entry.id),
                      })
                    }
                  >
                    Delete entry
                  </MiniButton>
                  {isCompleted ? (
                    <MiniButton
                      onClick={() => void sendForConfirmation(entry)}
                      disabled={!canSendConfirmation || sendingConfirmation}
                    >
                      {sendingConfirmation
                        ? "Sending..."
                        : confirmationStatus === "PENDING_CONFIRMATION"
                          ? "Pending Confirmation"
                          : "Send for Confirmation"}
                    </MiniButton>
                  ) : null}
                </>
              )}
            </div>
          ) : null
        }
      >
        <div className="text-xs text-muted-foreground">
          Academic Year: {entry.academicYear || "-"} {" • "}
          Year of Study: {entry.yearOfStudy || "-"} {" • "}
          Current Semester: {entry.currentSemester ?? "-"} {" • "}
          Start: {formatDisplayDate(entry.startDate)} {" • "}
          End: {formatDisplayDate(entry.endDate)} {" • "}
          Days: {getInclusiveDays(entry.startDate, entry.endDate) ?? "-"}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {entry.permissionLetter ? (
            <a className="underline" href={entry.permissionLetter.url} target="_blank" rel="noreferrer">
              Permission Letter
            </a>
          ) : null}
          {entry.geotaggedPhotos.map((meta, photoIndex) => (
            <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
              Geotagged Photo {photoIndex + 1}
            </a>
          ))}
        </div>
      </EntryListCardShell>
    );
  }

  const toastBanner = toast ? (
    <div
      className={cx(
        "rounded-lg border px-3 py-2 text-sm",
        toast.type === "ok"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {toast.msg}
    </div>
  ) : null;

  return (
    <CategoryEntryPageShell
      entryShell={{
        category: "fdp-conducted",
        mode: isViewMode ? "view" : showForm ? (activeEntryId ? "edit" : "new") : "preview",
        entry: showForm ? (form as Record<string, unknown>) : null,
        title: "FDP — Conducted",
        subtitle: "Record FDPs conducted with duration and the required supporting documents.",
        status: showForm ? getEntryApprovalStatus(form) : undefined,
        meta: showForm && !isViewMode ? <AutoSaveIndicator status={autoSaveStatus} /> : null,
        showUnsavedChanges: showForm && !isViewMode && hasUnsavedChanges,
        backHref,
        backDisabled,
        onBack: showForm || isViewMode ? () => handleCancel(categoryPath) : undefined,
        actions: (
          <EntryHeaderActionsBar
            isEditing={showForm}
            isViewMode={isViewMode}
            loading={loading}
            onAdd={() => {
              resetForm();
              router.push(entryNew("fdp-conducted"), { scroll: false });
            }}
            addLabel="+ Add FDP Entry"
            onCancel={() => void handleCancel()}
            cancelDisabled={actionState.cancelDisabled}
            onSave={() => void handleSaveDraft()}
            saveDisabled={actionState.saveDisabled}
            onDone={() => void handleSaveAndClose()}
            doneDisabled={actionState.doneDisabled}
            saving={saving}
            saveIntent={saveIntent}
          />
        ),
      }}
      loading={loading}
      showForm={showForm}
      topContent={toastBanner}
      formCard={
        showForm
          ? {
              className: "bg-white/70 p-5",
              title: isViewMode ? "FDP Entry" : "New FDP Entry",
              subtitle: "Add the entry details and generate the entry to unlock uploads.",
              content: (
                <>
                  {pendingCoreLocked ? (
                    <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Pending confirmation — core fields cannot be edited.
                    </p>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Academic Year" error={submitted ? errors.academicYear : undefined}>
                <SelectDropdown
                  value={form.academicYear}
                  onChange={(value) => setForm((current) => ({ ...current, academicYear: value }))}
                  options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
                  placeholder="Select academic year"
                  disabled={coreFieldDisabled("academicYear")}
                  error={submitted && !!errors.academicYear}
                />
              </Field>

              <Field label="Year of Study" error={submitted ? errors.yearOfStudy : undefined}>
                <SelectDropdown
                  value={form.yearOfStudy}
                  onChange={(value) =>
                    setForm((current) => {
                      const nextYear = normalizeYearOfStudy(value) ?? "";
                      const nextSemester = isSemesterAllowed(nextYear || undefined, current.currentSemester ?? undefined)
                        ? current.currentSemester
                        : null;

                      return withAcademicProgressionCompatibility({
                        ...current,
                        yearOfStudy: nextYear,
                        currentSemester: nextSemester,
                      }) as FdpConducted;
                    })
                  }
                  options={YEAR_OF_STUDY_OPTIONS}
                  placeholder="Select year of study"
                  disabled={coreFieldDisabled("yearOfStudy")}
                  error={submitted && !!errors.yearOfStudy}
                />
              </Field>

              <Field
                label="Current Semester"
                error={submitted ? errors.currentSemester : undefined}
                hint={normalizedStudentYear ? "Select semester (based on year)" : "Select year of study first"}
              >
                <SelectDropdown
                  value={form.currentSemester === null ? "" : String(form.currentSemester)}
                  onChange={(value) =>
                    setForm((current) =>
                      withAcademicProgressionCompatibility({
                        ...current,
                        currentSemester: value ? Number(value) : null,
                      }) as FdpConducted
                    )
                  }
                  options={semesterOptions.map((option) => ({
                    label: String(option),
                    value: String(option),
                  }))}
                  placeholder={normalizedStudentYear ? "Select current semester" : "Select year of study first"}
                  disabled={coreFieldDisabled("currentSemester") || !normalizedStudentYear}
                  error={submitted && !!errors.currentSemester}
                />
              </Field>

              <Field label="Starting Date" error={submitted ? errors.startDate : undefined}>
                <DateField
                  value={form.startDate}
                  onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
                  disabled={coreFieldDisabled("startDate")}
                  error={submitted && !!errors.startDate}
                />
              </Field>

              <Field
                label="Ending Date"
                error={submitted ? errors.endDate : undefined}
                hint={inclusiveDays ? `Days: ${inclusiveDays}` : undefined}
              >
                <DateField
                  value={form.endDate}
                  onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
                  disabled={coreFieldDisabled("endDate")}
                  error={submitted && !!errors.endDate}
                />
              </Field>

              <Field label="Number of Days" hint="Inclusive day count">
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {inclusiveDays ?? "-"}
                </div>
              </Field>

              <Field label="Name of the Event" error={submitted ? errors.eventName : undefined}>
                <input
                  value={form.eventName}
                  onChange={(event) => setForm((current) => ({ ...current, eventName: event.target.value }))}
                  disabled={coreFieldDisabled("eventName")}
                  className={cx(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.eventName
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20",
                    coreFieldDisabled("eventName") && "cursor-not-allowed opacity-60"
                  )}
                />
              </Field>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Coordinator: <span className="font-medium text-foreground">{form.coordinatorName || "-"}</span>
            </div>

            <div className="mt-5">
              <FacultyPickerRows
                title="Co-coordinator(s)"
                helperText="Add co-coordinators only when applicable."
                addLabel="+ Add Co-coordinator"
                rowLabelPrefix="Co-coordinator"
                rows={form.coCoordinators}
                onRowsChange={(rows) => setForm((current) => ({ ...current, coCoordinators: rows }))}
                onPersistRow={async (rows) => persistCoCoordinatorRows(rows)}
                facultyOptions={FACULTY_OPTIONS}
                parentLocked={coreFieldDisabled("coCoordinators")}
                viewOnly={isViewMode}
                disableEmails={[form.coordinatorEmail]}
                sectionError={errors.coCoordinators}
                showSectionError={submitted}
                emptyStateText="No co-coordinators added."
                validateRow={(rows, row, index) => {
                  if (!row.email) return "Select a faculty member from the list.";
                  if (row.email.trim().toLowerCase() === form.coordinatorEmail.trim().toLowerCase()) {
                    return "This faculty is already selected in another role.";
                  }
                  const duplicates = rows.filter(
                    (item, itemIndex) =>
                      itemIndex !== index && item.email.trim().toLowerCase() === row.email.trim().toLowerCase()
                  ).length;
                  return duplicates > 0 ? "This faculty is already selected in another role." : null;
                }}
              />
            </div>

                  <div className="mt-5 space-y-4">
              <EntryPdfActionsBar
                isViewMode={isViewMode}
                canGenerate={canGenerate}
                onGenerate={() => void generateEntry()}
                generating={saving}
                pdfMeta={form.pdfMeta ?? null}
                pdfDisabled={!lifecycle.canPreview}
              />
              {pdfState.pdfStale ? (
                <p className="text-sm text-muted-foreground">
                  Entry changed. Regenerate PDF to update Preview/Download.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">Streaks apply only for upcoming FDP dates.</p>

              {uploadsVisible ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <UploadField
                  title="Upload Permission Letter"
                  mode={isViewMode ? "view" : "edit"}
                  meta={form.permissionLetter}
                  pendingFile={permissionController.pendingFile}
                  progress={permissionController.progress}
                  busy={permissionController.busy || uploadPersisting}
                  error={permissionController.error}
                  canChoose={permissionController.canChoose && !uploadPersisting}
                  canUpload={permissionController.canUpload && !uploadPersisting}
                  canDelete={permissionController.canDelete && !uploadPersisting}
                  onSelectFile={permissionController.selectFile}
                        onUpload={() => void uploadSlot()}
                  onDelete={() => void deleteSlot("permissionLetter")}
                  showValidationError={submitAttemptedFinal}
                  validationMessage={errors.permissionLetter}
                />

              <UploadFieldMulti
                  key={form.id}
                  title="Geotagged Photos"
                  value={form.geotaggedPhotos}
                  onUploaded={async (meta) => {
                    const currentForm = formRef.current;
                    const nextPhotos = [...currentForm.geotaggedPhotos, meta];
                    const nextForm = {
                      ...currentForm,
                      geotaggedPhotos: nextPhotos,
                    };
                    const persisted = await persistProgress(nextForm);
                    setEditorSeed(persisted);
                    editorActions.saveDraft(persisted);
                    markAutoSaveSaved(persisted);
                    await refreshList();
                  }}
                  onDeleted={async (meta) => {
                    const currentForm = formRef.current;
                    const nextPhotos = currentForm.geotaggedPhotos.filter(
                      (item) => item.storedPath !== meta.storedPath
                    );
                    const nextForm = {
                      ...currentForm,
                      geotaggedPhotos: nextPhotos,
                    };
                    const persisted = await persistProgress(nextForm);
                    setEditorSeed(persisted);
                    editorActions.saveDraft(persisted);
                    markAutoSaveSaved(persisted);
                    await refreshList();
                  }}
                  uploadEndpoint="/api/me/fdp-conducted-file"
                  email={email}
                  recordId={form.id}
                  slotName="geotaggedPhotos"
                  showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                  requiredErrorText={errors.geotaggedPhotos}
                  onStatusChange={setPhotoUploadStatus}
                  disabled={controlsDisabled}
                  viewOnly={isViewMode}
                />
              </div>
              ) : null}
                  </div>
                </>
              ),
            }
          : null
      }
      listCard={
        !loading && !isEditing
          ? {
              className: "bg-white/70 p-5",
              title: "Saved FDP Conducted Entries",
              subtitle: "Your saved records are stored locally and keyed by your signed-in email.",
              content:
                list.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No entries yet.</div>
                ) : (
                  <GroupedEntrySections groupedEntries={groupedEntries} renderEntry={renderSavedEntry} />
                ),
            }
          : null
      }
      confirmationDialog={confirmationDialog}
    />
  );
}

export default function FdpConductedPageRoute() {
  return <FdpConductedPage />;
}
