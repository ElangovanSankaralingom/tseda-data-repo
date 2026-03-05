"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CurrencyField from "@/components/controls/CurrencyField";
import DateField from "@/components/controls/DateField";
import EntryCategoryMarker from "@/components/entry/EntryCategoryMarker";
import { EntryHeaderActionsBar, EntryPdfActionsBar } from "@/components/entry/EntryHeaderActions";
import { getEntryListCardClass } from "@/components/entry/entryCardStyles";
import EntryLockBadge from "@/components/entry/EntryLockBadge";
import EntryPageHeader from "@/components/entry/EntryPageHeader";
import RequestEditAction from "@/components/entry/RequestEditAction";
import UploadField from "@/components/entry/UploadField";
import { ActionButton } from "@/components/ui/ActionButton";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { useEntryConfirmation } from "@/hooks/useEntryConfirmation";
import { getEntryStreakDisplayState } from "@/lib/entries/lifecycle";
import { groupEntries } from "@/lib/entryCategorization";
import {
  canSendForConfirmation,
  getConfirmationStatusLabel,
  getEntryApprovalStatus,
  isEntryLockedFromStatus,
} from "@/lib/confirmation";
import {
  type StreakState,
} from "@/lib/gamification";
import { getStreakDeadlineState } from "@/lib/streakDeadline";
import { useEntryEditor } from "@/hooks/useEntryEditor";
import { useCommitDraft } from "@/hooks/useCommitDraft";
import { useGenerateEntry } from "@/hooks/useGenerateEntry";
import { useRequestEdit } from "@/hooks/useRequestEdit";
import { useSeedEntry } from "@/hooks/useSeedEntry";
import { useEntryViewMode } from "@/hooks/useEntryViewMode";
import { useEntryWorkflow } from "@/hooks/useEntryWorkflow";
import { useUploadController } from "@/hooks/useUploadController";
import { validatePreUploadFields } from "@/lib/categoryRequirements";
import { entryDetail, entryList, entryNew } from "@/lib/navigation";
import { canEditField } from "@/lib/pendingImmutability";
import {
  createOptimisticSnapshot,
  optimisticRemove,
  optimisticUpsert,
} from "@/lib/ui/optimistic";
import { uploadFile } from "@/lib/upload/uploadService";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type FdpAttended = {
  id: string;
  status: "draft" | "final";
  confirmationStatus?: "DRAFT" | "PENDING_CONFIRMATION" | "APPROVED" | "REJECTED";
  requestEditStatus?: "none" | "pending" | "approved" | "rejected";
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  startDate: string;
  endDate: string;
  programName: string;
  organisingBody: string;
  supportAmount: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  permissionLetter: FileMeta | null;
  completionCertificate: FileMeta | null;
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

const ACADEMIC_YEAR_OPTIONS = [
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
] as const;

const SEMESTER_TYPE_OPTIONS = ["Odd Semester", "Even Semester"] as const;
const ACADEMIC_YEAR_DROPDOWN_OPTIONS = ACADEMIC_YEAR_OPTIONS.map((option) => ({
  label: option,
  value: option,
}));
const SEMESTER_TYPE_DROPDOWN_OPTIONS = SEMESTER_TYPE_OPTIONS.map((option) => ({
  label: option,
  value: option,
}));

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

function emptyForm(): FdpAttended {
  return {
    id: uuid(),
    status: "draft",
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    startDate: "",
    endDate: "",
    programName: "",
    organisingBody: "",
    supportAmount: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: null,
    completionCertificate: null,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  };
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

function formatEntryTimestamp(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/70 p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function MiniButton(props: React.ComponentProps<typeof ActionButton>) {
  return <ActionButton {...props} />;
}

function uploadFdpFileXHR(opts: {
  recordId: string;
  slot: "permissionLetter" | "completionCertificate";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { recordId, slot, file, onProgress } = opts;

  return uploadFile({
    endpoint: "/api/me/fdp-file",
    recordId,
    slot,
    file,
    onProgress,
  });
}

type FdpAttendedPageProps = {
  viewEntryId?: string;
  editEntryId?: string;
  startInNewMode?: boolean;
};

export function FdpAttendedPage({
  viewEntryId,
  editEntryId,
  startInNewMode = false,
}: FdpAttendedPageProps = {}) {
  const router = useRouter();
  const categoryPath = entryList("fdp-attended");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState<"save" | "done" | null>(null);
  const [formOpen, setFormOpen] = useState(startInNewMode);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [list, setList] = useState<FdpAttended[]>([]);
  const [editorSeed, setEditorSeed] = useState<FdpAttended>(() => emptyForm());
  const saveLockRef = useRef(false);
  const activeEntryId = editEntryId?.trim() || viewEntryId?.trim() || "";
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
  } = useEntryEditor<FdpAttended>({
    initialEntry: editorSeed,
    category: "fdp-attended",
    validatePrePdfFields: (draft) => validatePreUploadFields("fdp-attended", draft as Record<string, unknown>),
  });
  const generateEntrySnapshot = useGenerateEntry<FdpAttended>({
    category: "fdp-attended",
    hydrateEntry: (entry) => entry,
  });
  const commitDraftEntry = useCommitDraft<FdpAttended>({
    category: "fdp-attended",
    hydrateEntry: (entry) => entry,
  });
  const viewedEntry = useMemo(
    () => (activeEntryId ? list.find((item) => item.id === activeEntryId) ?? null : null),
    [activeEntryId, list]
  );
  const loadedEntryId = viewedEntry?.id ?? null;
  const loadEditorEntry = editorActions.loadEntry;
  const isEditing = formOpen || !!activeEntryId;
  const showForm = formOpen || (!!activeEntryId && (!isViewMode || !!viewedEntry));

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const meResponse = await fetch("/api/me", { cache: "no-store" });
        const me = await meResponse.json();
        if (!meResponse.ok || !String(me?.email || "").trim()) {
          throw new Error("Missing email. Please sign in again.");
        }

        const listResponse = await fetch("/api/me/fdp-attended", { cache: "no-store" });
        const items = await listResponse.json();
        if (!listResponse.ok) {
          throw new Error(items?.error || "Failed to load FDP Attended records.");
        }

        setList(Array.isArray(items) ? (items as FdpAttended[]) : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (!ACADEMIC_YEAR_OPTIONS.includes(form.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
      nextErrors.academicYear = "Academic year is required.";
    }

    if (!SEMESTER_TYPE_OPTIONS.includes(form.semesterType as (typeof SEMESTER_TYPE_OPTIONS)[number])) {
      nextErrors.semesterType = "Semester type is required.";
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

    if ((form.programName || "").trim().length === 0) {
      nextErrors.programName = "Program name is required.";
    }

    if ((form.organisingBody || "").trim().length === 0) {
      nextErrors.organisingBody = "Organising body is required.";
    }

    if (form.supportAmount !== null) {
      if (!Number.isFinite(form.supportAmount) || form.supportAmount < 0) {
        nextErrors.supportAmount = "Invalid amount.";
      }
    }

    return nextErrors;
  }, [form]);

  const controlsDisabled = isViewMode || isEntryLockedFromStatus(form);
  const pendingCoreLocked = getEntryApprovalStatus(form) === "PENDING_CONFIRMATION";
  const coreFieldDisabled = (fieldKey: string) =>
    controlsDisabled || !canEditField(form, "fdp-attended", fieldKey);
  const permissionController = useUploadController<FileMeta>({
    locked: controlsDisabled,
    upload: (file, onProgress) =>
      uploadFdpFileXHR({
        recordId: form.id,
        slot: "permissionLetter",
        file,
        onProgress,
      }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-file", {
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
  const completionController = useUploadController<FileMeta>({
    locked: controlsDisabled,
    upload: (file, onProgress) =>
      uploadFdpFileXHR({
        recordId: form.id,
        slot: "completionCertificate",
        file,
        onProgress,
      }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-file", {
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
  const hasBusyUploads = permissionController.busy || completionController.busy;
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const uploadsVisible = !!form.pdfMeta;
  const requiredUploadsComplete = !!form.permissionLetter && !!form.completionCertificate;
  const workflow = useEntryWorkflow({
    isLocked: isEntryLockedFromStatus(form),
    coreValid: generateReady,
    hasPdfSnapshot: uploadsVisible,
    pdfStale: pdfState.pdfStale,
    completionValid: requiredUploadsComplete,
    fieldDirty: formDirty,
  });
  const lifecycle = workflow.lifecycle;
  const canGenerate = workflow.canGenerate;
  const groupedEntries = useMemo(() => groupEntries(list), [list]);

  const resetUploadState = useCallback(() => {
    permissionController.reset();
    completionController.reset();
  }, [completionController, permissionController]);

  async function refreshList() {
    const listResponse = await fetch("/api/me/fdp-attended", { cache: "no-store" });
    const items = await listResponse.json();
    if (!listResponse.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    setList(Array.isArray(items) ? (items as FdpAttended[]) : []);
  }

  async function persistProgress(nextForm: FdpAttended) {
    const response = await fetch("/api/me/fdp-attended", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry: nextForm }),
    });
    const text = await response.text();
    let payload: FdpAttended | { error?: string } | null = null;
    let message = `Save failed (${response.status})`;

    try {
      payload = text ? (JSON.parse(text) as FdpAttended | { error?: string }) : null;
      if (payload && "error" in payload && payload.error) {
        message = payload.error;
      }
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(message);
    }

    return payload as FdpAttended;
  }

  function resetForm() {
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextForm = emptyForm();
    setEditorSeed(nextForm);
    loadEditorEntry(nextForm);
    resetUploadState();
  }

  function closeForm(targetHref = categoryPath) {
    resetForm();
    setFormOpen(false);
    router.replace(targetHref, { scroll: false });
  }

  async function handleCancel(targetHref = categoryPath) {
    if (hasBusyUploads) {
      setToast({ type: "err", msg: "Please wait for upload to finish." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    closeForm(targetHref);
  }

  async function handleDone() {
    setSubmitAttemptedFinal(true);

    if (hasBusyUploads) {
      setToast({ type: "err", msg: "Please wait for upload to finish." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (!lifecycle.canDone) {
      setToast({ type: "err", msg: "Complete all required uploads before finishing." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    await saveDraftChanges({ closeAfterSave: true, intent: "done" });
  }

  const seedLoadedEntry = useCallback(
    (loadedEntry: FdpAttended) => {
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

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/fdp-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function uploadSlot(slot: "permissionLetter" | "completionCertificate") {
    const controller = slot === "permissionLetter" ? permissionController : completionController;
    const previousMeta = form[slot];

    try {
      const meta = await controller.uploadAndSave();
      if (!meta) return;

      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void deleteStoredFile(previousMeta.storedPath);
      }

      const nextForm = { ...form, [slot]: meta } as FdpAttended;
      const persisted = await persistProgress(nextForm);
      setEditorSeed(persisted);
      editorActions.saveDraft(persisted);
      await refreshList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    }
  }

  async function deleteSlot(slot: "permissionLetter" | "completionCertificate") {
    const meta = form[slot];
    if (!meta?.storedPath) {
      setToast({ type: "err", msg: "File path missing." });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const controller = slot === "permissionLetter" ? permissionController : completionController;
      const deleted = await controller.deleteFile(meta);
      if (!deleted) return;
      setForm((current) => ({ ...current, [slot]: null }));

      setToast({ type: "ok", msg: "File deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  async function saveDraftChanges(options?: { closeAfterSave?: boolean; intent?: "save" | "done" }) {
    const intent = options?.intent ?? "save";
    if (saveLockRef.current) return;
    if (intent === "save" && !lifecycle.canSave) return;
    if (intent === "done" && !lifecycle.canDone) return;
    saveLockRef.current = true;
    let rollbackSnapshot: FdpAttended[] | null = null;
    let lastPersistedEntry: FdpAttended | null = null;

    try {
      if (hasBusyUploads) {
        setToast({ type: "err", msg: "Please wait for uploads to finish before saving." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      setSaveIntent(intent);
      const entryToSave: FdpAttended = {
        ...form,
        status: form.status === "final" ? "final" : "draft",
      };
      const optimisticEntry: FdpAttended = {
        ...entryToSave,
        updatedAt: new Date().toISOString(),
      };
      setList((current) => {
        rollbackSnapshot = createOptimisticSnapshot(current);
        return optimisticUpsert(current, optimisticEntry);
      });

      const persisted = await persistProgress(entryToSave);
      lastPersistedEntry = persisted;
      setList((current) => optimisticUpsert(current, persisted));

      const finalEntry: FdpAttended =
        intent === "done" ? await commitDraftEntry(String(persisted.id)) : persisted;
      if (intent === "done") {
        lastPersistedEntry = finalEntry;
        setList((current) => optimisticUpsert<FdpAttended>(current, finalEntry));
      }

      setEditorSeed(finalEntry);
      editorActions.saveDraft(finalEntry);
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      void refreshList();
      if (options?.closeAfterSave) {
        closeForm();
        setToast({ type: "ok", msg: intent === "done" ? "Draft committed." : "Saved" });
      } else {
        setToast({ type: "ok", msg: intent === "done" ? "Draft committed." : "Saved" });
      }
      setTimeout(() => setToast(null), 1400);
    } catch (error) {
      const persistedEntry = lastPersistedEntry;
      if (persistedEntry) {
        setList((current) => optimisticUpsert<FdpAttended>(current, persistedEntry));
      } else if (rollbackSnapshot) {
        setList(rollbackSnapshot);
      }
      const message = error instanceof Error ? error.message : "Save failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setSaving(false);
      setSaveIntent(null);
      saveLockRef.current = false;
    }
  }

  async function generateEntry() {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      setSubmitted(true);

      if (Object.keys(errors).length > 0 || !lifecycle.canGenerate) {
        setToast({ type: "err", msg: "Complete all required fields before generating the entry." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      if (hasBusyUploads) {
        setToast({ type: "err", msg: "Finish the current uploads before saving." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      setSaveIntent("save");
      const draftEntry: FdpAttended = {
        ...form,
        status: form.status === "final" ? "final" : "draft",
        pdfStale: pdfState.pdfStale,
        pdfSourceHash: form.pdfSourceHash || "",
      };
      const { entry: generatedEntry } = await generateEntrySnapshot(draftEntry, persistProgress);

      const nextEntry = {
        ...generatedEntry,
        pdfSourceHash: prePdfFieldsHash,
        pdfStale: false,
      };
      setEditorSeed(nextEntry);
      editorActions.generatePdf(nextEntry);
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      setToast({ type: "ok", msg: "Entry generated." });
      await refreshList();
      setTimeout(() => setToast(null), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setSaving(false);
      setSaveIntent(null);
      saveLockRef.current = false;
    }
  }

  async function deleteEntry(id: string) {
    let rollbackSnapshot: FdpAttended[] | null = null;
    setList((current) => {
      rollbackSnapshot = createOptimisticSnapshot(current);
      return optimisticRemove(current, id);
    });

    try {
      const response = await fetch("/api/me/fdp-attended", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }

      setList((current) => optimisticRemove(current, id));
      void refreshList();
      if (activeEntryId === id) {
        closeForm();
      }
      setToast({ type: "ok", msg: "Entry deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      if (rollbackSnapshot) {
        setList(rollbackSnapshot);
      }
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  const { requestingIds: requestingEditIds, requestEdit, cancelRequestEdit } = useRequestEdit<FdpAttended>({
    setItems: setList,
    persistRequest: async (entry) => {
      const response = await fetch(`/api/me/fdp-attended/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_edit" }),
      });
      const payload = (await response.json()) as FdpAttended | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in payload && payload.error) || "Request failed.");
      }

      return payload as FdpAttended;
    },
    persistCancel: async (entry) => {
      const response = await fetch(`/api/me/fdp-attended/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_request_edit" }),
      });
      const payload = (await response.json()) as FdpAttended | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in payload && payload.error) || "Cancel request failed.");
      }

      return payload as FdpAttended;
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
  const { sendingIds: sendingConfirmationIds, sendForConfirmation } = useEntryConfirmation<FdpAttended>({
    category: "fdp-attended",
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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <EntryPageHeader
        title="FDP — Attended"
        subtitle="Record faculty development programmes attended, along with support amount and the two required supporting documents."
        isViewMode={isViewMode}
        backHref={backHref}
        backDisabled={backDisabled}
        onBack={showForm || isViewMode ? () => handleCancel(categoryPath) : undefined}
        actions={
          <EntryHeaderActionsBar
            isEditing={showForm}
            isViewMode={isViewMode}
            loading={loading}
            onAdd={() => {
              resetForm();
              setFormOpen(true);
              router.push(entryNew("fdp-attended"), { scroll: false });
            }}
            addLabel="+ Add FDP Entry"
            onCancel={() => void handleCancel()}
            cancelDisabled={controlsDisabled || saving || loading || hasBusyUploads}
            onSave={() => void saveDraftChanges()}
            saveDisabled={controlsDisabled || saving || loading || hasBusyUploads || !lifecycle.canSave}
            onDone={() => void handleDone()}
            doneDisabled={controlsDisabled || saving || loading || hasBusyUploads || !lifecycle.canDone}
            saving={saving}
            saveIntent={saveIntent}
          />
        }
      />

      {toast ? (
        <div
          className={cx(
            "mt-4 rounded-lg border px-3 py-2 text-sm",
            toast.type === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {toast.msg}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Loading...</div>
        ) : null}

        {!loading && showForm ? (
          <SectionCard
            title={isViewMode ? "FDP Entry" : "New FDP Entry"}
            subtitle="Add the entry details and upload the required documents."
          >
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

              <Field label="Semester Type" error={submitted ? errors.semesterType : undefined}>
                <SelectDropdown
                  value={form.semesterType}
                  onChange={(value) => setForm((current) => ({ ...current, semesterType: value }))}
                  options={SEMESTER_TYPE_DROPDOWN_OPTIONS}
                  placeholder="Select semester type"
                  disabled={coreFieldDisabled("semesterType")}
                  error={submitted && !!errors.semesterType}
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

              <Field label="Name of the Faculty Development Program" error={submitted ? errors.programName : undefined}>
                <input
                  value={form.programName}
                  onChange={(event) => setForm((current) => ({ ...current, programName: event.target.value }))}
                  disabled={coreFieldDisabled("programName")}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    submitted && errors.programName ? "border-red-300" : "border-border",
                    coreFieldDisabled("programName") && "cursor-not-allowed opacity-60"
                  )}
                />
              </Field>

              <Field label="Name of the Organising Body" error={submitted ? errors.organisingBody : undefined}>
                <input
                  value={form.organisingBody}
                  onChange={(event) => setForm((current) => ({ ...current, organisingBody: event.target.value }))}
                  disabled={coreFieldDisabled("organisingBody")}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    submitted && errors.organisingBody ? "border-red-300" : "border-border",
                    coreFieldDisabled("organisingBody") && "cursor-not-allowed opacity-60"
                  )}
                />
              </Field>

              <Field
                label="Amount of Support (₹) — optional"
                error={submitted ? errors.supportAmount : undefined}
                hint="Numbers only"
              >
                <CurrencyField
                  value={form.supportAmount === null ? "" : String(form.supportAmount)}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      supportAmount: value === "" ? null : Number(value),
                    }))
                  }
                  disabled={coreFieldDisabled("supportAmount")}
                  error={submitted && !!errors.supportAmount}
                  placeholder="15000"
                />
              </Field>
            </div>

            <div className="mt-5 space-y-4">
              <EntryPdfActionsBar
                isViewMode={isViewMode}
                canGenerate={canGenerate}
                onGenerate={() => void generateEntry()}
                generating={saving && saveIntent === "save"}
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
                    busy={permissionController.busy}
                    error={permissionController.error}
                    canChoose={permissionController.canChoose}
                    canUpload={permissionController.canUpload}
                    canDelete={permissionController.canDelete}
                    onSelectFile={permissionController.selectFile}
                    onUpload={() => void uploadSlot("permissionLetter")}
                    onDelete={() => void deleteSlot("permissionLetter")}
                    showValidationError={submitAttemptedFinal}
                    validationMessage={errors.permissionLetter}
                  />
                  <UploadField
                    title="Upload Completion Certificate"
                    mode={isViewMode ? "view" : "edit"}
                    meta={form.completionCertificate}
                    pendingFile={completionController.pendingFile}
                    progress={completionController.progress}
                    busy={completionController.busy}
                    error={completionController.error}
                    canChoose={completionController.canChoose}
                    canUpload={completionController.canUpload}
                    canDelete={completionController.canDelete}
                    onSelectFile={completionController.selectFile}
                    onUpload={() => void uploadSlot("completionCertificate")}
                    onDelete={() => void deleteSlot("completionCertificate")}
                    showValidationError={submitAttemptedFinal}
                    validationMessage={errors.completionCertificate}
                  />
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {!loading && !isEditing ? (
          <SectionCard
            title="Saved FDP Attended Entries"
            subtitle="Your saved records are stored locally and keyed by your signed-in email."
          >
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              <div className="space-y-3">
                {groupedEntries.draft.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Drafts</div>
                    {groupedEntries.draft.map((entry, index) => {
                      const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
                      const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
                      const showUpdated =
                        !Number.isNaN(createdTime) &&
                        !Number.isNaN(updatedTime) &&
                        Math.abs(updatedTime - createdTime) > 60 * 1000;
                      const deadlineState = getStreakDeadlineState(entry);

                      return (
                        <div key={entry.id} className={getEntryListCardClass("draft")}>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <EntryCategoryMarker
                                    category="draft"
                                    index={index}
                                    streakState={getEntryStreakDisplayState(entry)}
                                  />
                                  <Link href={entryDetail("fdp-attended", entry.id)} className="text-base font-semibold hover:opacity-80">
                                    {entry.programName}
                                  </Link>
                                  <EntryLockBadge deadlineState={deadlineState} />
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                </div>
                              </div>

                              {!(activeEntryId && entry.id === activeEntryId) ? (
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <div className="flex items-center gap-2">
                                    <MiniButton onClick={() => router.push(entryDetail("fdp-attended", entry.id))}>
                                      View
                                    </MiniButton>
                                    <MiniButton
                                      onClick={() => {
                                        router.push(entryDetail("fdp-attended", entry.id), { scroll: false });
                                      }}
                                    >
                                      Edit
                                    </MiniButton>
                                    <MiniButton role="destructive" onClick={() => void deleteEntry(entry.id)}>
                                      Delete entry
                                    </MiniButton>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">
                                Academic Year: {entry.academicYear || "-"} {" • "}
                                Semester: {entry.semesterType || "-"} {" • "}
                                Start: {formatDisplayDate(entry.startDate)} {" • "}
                                End: {formatDisplayDate(entry.endDate)} {" • "}
                                Days: {getInclusiveDays(entry.startDate, entry.endDate) ?? "-"}
                                {" • "}
                                Support:{" "}
                                <span className="font-medium text-foreground">
                                  {typeof entry.supportAmount === "number" ? `₹${entry.supportAmount}` : "-"}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                                {entry.permissionLetter ? (
                                  <a className="underline" href={entry.permissionLetter.url} target="_blank" rel="noreferrer">
                                    Permission Letter
                                  </a>
                                ) : null}
                                {entry.completionCertificate ? (
                                  <a className="underline" href={entry.completionCertificate.url} target="_blank" rel="noreferrer">
                                    Completion Certificate
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {groupedEntries.activated.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Streak Activated</div>
                    {groupedEntries.activated.map((entry, index) => {
                      const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
                      const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
                      const showUpdated =
                        !Number.isNaN(createdTime) &&
                        !Number.isNaN(updatedTime) &&
                        Math.abs(updatedTime - createdTime) > 60 * 1000;

                      const deadlineState = getStreakDeadlineState(entry);

                      return (
                        <div key={entry.id} className={getEntryListCardClass("streak_active")}>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <EntryCategoryMarker
                                    category="streak_active"
                                    index={index}
                                    streakState={getEntryStreakDisplayState(entry)}
                                  />
                                  <Link href={entryDetail("fdp-attended", entry.id)} className="text-base font-semibold hover:opacity-80">
                                    {entry.programName}
                                  </Link>
                                  <EntryLockBadge deadlineState={deadlineState} />
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                </div>
                              </div>

                              {!(activeEntryId && entry.id === activeEntryId) ? (
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <div className="flex items-center gap-2">
                                    <MiniButton onClick={() => router.push(entryDetail("fdp-attended", entry.id))}>
                                      View
                                    </MiniButton>
                                    <MiniButton
                                      onClick={() => {
                                        router.push(entryDetail("fdp-attended", entry.id), { scroll: false });
                                      }}
                                    >
                                      Edit
                                    </MiniButton>
                                    <MiniButton role="destructive" onClick={() => void deleteEntry(entry.id)}>
                                      Delete entry
                                    </MiniButton>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">
                                Academic Year: {entry.academicYear || "-"} {" • "}
                                Semester: {entry.semesterType || "-"} {" • "}
                                Start: {formatDisplayDate(entry.startDate)} {" • "}
                                End: {formatDisplayDate(entry.endDate)} {" • "}
                                Days: {getInclusiveDays(entry.startDate, entry.endDate) ?? "-"}
                                {" • "}
                                Support:{" "}
                                <span className="font-medium text-foreground">
                                  {typeof entry.supportAmount === "number" ? `₹${entry.supportAmount}` : "-"}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                                {entry.permissionLetter ? (
                                  <a
                                    className="underline"
                                    href={entry.permissionLetter.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Permission Letter
                                  </a>
                                ) : null}
                                {entry.completionCertificate ? (
                                  <a
                                    className="underline"
                                    href={entry.completionCertificate.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Completion Certificate
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {groupedEntries.completed.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Completed</div>
                    {groupedEntries.completed.map((entry, index) => {
                      const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
                      const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
                      const showUpdated =
                        !Number.isNaN(createdTime) &&
                        !Number.isNaN(updatedTime) &&
                        Math.abs(updatedTime - createdTime) > 60 * 1000;
                      const confirmationStatus = getEntryApprovalStatus(entry);
                      const lockApproved = isEntryLockedFromStatus(entry);
                      const canSendConfirmation = canSendForConfirmation(entry);
                      const sendingConfirmation = !!sendingConfirmationIds[entry.id];

                      const deadlineState = getStreakDeadlineState(entry);

                      return (
                        <div key={entry.id} className={getEntryListCardClass("completed")}>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <EntryCategoryMarker
                                    category="completed"
                                    index={index}
                                    streakState={getEntryStreakDisplayState(entry)}
                                  />
                                  <Link href={entryDetail("fdp-attended", entry.id)} className="text-base font-semibold hover:opacity-80">
                                    {entry.programName}
                                  </Link>
                                  <EntryLockBadge deadlineState={deadlineState} />
                                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                                    {getConfirmationStatusLabel(confirmationStatus)}
                                  </span>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                </div>
                              </div>

                              {!(activeEntryId && entry.id === activeEntryId) ? (
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <div className="flex items-center gap-2">
                                    <MiniButton onClick={() => router.push(entryDetail("fdp-attended", entry.id))}>
                                      View
                                    </MiniButton>
                                    {lockApproved ? (
                                      <>
                                        {entry.pdfMeta?.url ? (
                                          <MiniButton
                                            role="context"
                                            onClick={() =>
                                              window.open(entry.pdfMeta?.url, "_blank", "noopener,noreferrer")
                                            }
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
                                            router.push(entryDetail("fdp-attended", entry.id), { scroll: false });
                                          }}
                                        >
                                          Edit
                                        </MiniButton>
                                        <MiniButton role="destructive" onClick={() => void deleteEntry(entry.id)}>
                                          Delete entry
                                        </MiniButton>
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
                                      </>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">
                                Academic Year: {entry.academicYear || "-"} {" • "}
                                Semester: {entry.semesterType || "-"} {" • "}
                                Start: {formatDisplayDate(entry.startDate)} {" • "}
                                End: {formatDisplayDate(entry.endDate)} {" • "}
                                Days: {getInclusiveDays(entry.startDate, entry.endDate) ?? "-"}
                                {" • "}
                                Support:{" "}
                                <span className="font-medium text-foreground">
                                  {typeof entry.supportAmount === "number" ? `₹${entry.supportAmount}` : "-"}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                                {entry.permissionLetter ? (
                                  <a
                                    className="underline"
                                    href={entry.permissionLetter.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Permission Letter
                                  </a>
                                ) : null}
                                {entry.completionCertificate ? (
                                  <a
                                    className="underline"
                                    href={entry.completionCertificate.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Completion Certificate
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}

export default function FdpAttendedPageRoute() {
  return <FdpAttendedPage />;
}
