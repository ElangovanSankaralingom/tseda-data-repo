"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createCategoryEntryRecordRenderer } from "@/components/data-entry/CategoryEntryRecordCard";
import CategoryEntryRuntime from "@/components/data-entry/CategoryEntryRuntime";
import DateField from "@/components/controls/DateField";
import Field from "@/components/data-entry/Field";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { createGroupedEntryListCard } from "@/components/data-entry/GroupedEntrySections";
import AutoSaveIndicator from "@/components/entry/AutoSaveIndicator";
import EntryDocumentSection from "@/components/data-entry/EntryDocumentSection";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import MultiPhotoUpload from "@/components/entry/UploadFieldMulti";
import EntryUploader from "@/components/upload/EntryUploader";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { useCategoryEntryPageController } from "@/hooks/useCategoryEntryPageController";
import { useCommitDraft } from "@/hooks/useCommitDraft";
import { useGenerateEntry } from "@/hooks/useGenerateEntry";
import { useEntryViewMode } from "@/hooks/useEntryViewMode";
import { useEntryFormAccess } from "@/hooks/useEntryFormAccess";
import { useEntryPageModeTelemetry } from "@/hooks/useEntryPageModeTelemetry";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { validatePreUploadFields } from "@/lib/categoryRequirements";
import { computeFieldProgress } from "@/lib/entries/fieldProgress";
import { isEntryEditable } from "@/lib/entries/workflow";
import { getEntryApprovalStatus } from "@/lib/confirmation";
import { FACULTY } from "@/lib/facultyDirectory";
import { entryDetail, entryList, entryNew, safeBack } from "@/lib/entryNavigation";

import { computePdfState, hashPrePdfFields, hydratePdfSnapshot } from "@/lib/pdfSnapshot";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
  type YearOfStudy,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import {
  createDeleteEntry,
  createPersistProgress,
  createRefreshList,
} from "@/lib/entries/adapterOrchestration";
import type { EntryStatus } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type UploadSlot =
  | "permissionLetter"
  | "brochure"
  | "attendance"
  | "organiserProfile";
type UploadStatus = { hasPending: boolean; busy: boolean };

type WorkshopEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "coCoordinator";
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  startDate: string;
  endDate: string;
  eventName: string;
  speakerName: string;
  organisationName: string;
  coordinator: FacultyRowValue;
  coCoordinators: FacultyRowValue[];
  participants: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfSourceHash?: string | null;
  pdfStale?: boolean;
  uploads: Record<UploadSlot, FileMeta | null> & { geotaggedPhotos: FileMeta[] };
  streak?: {
    activatedAtISO?: string | null;
    dueAtISO?: string | null;
    completedAtISO?: string | null;
    windowDays?: number;
  };
  createdAt: string;
  updatedAt: string;
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

const UPLOAD_CONFIG: Array<{ slot: UploadSlot; label: string }> = [
  { slot: "permissionLetter", label: "Permission Letter" },
  { slot: "brochure", label: "Brochure" },
  { slot: "attendance", label: "Attendance" },
  { slot: "organiserProfile", label: "Organiser Profile" },
];
const EMPTY_UPLOAD_STATUS: Record<UploadSlot, UploadStatus> = {
  permissionLetter: { hasPending: false, busy: false },
  brochure: { hasPending: false, busy: false },
  attendance: { hasPending: false, busy: false },
  organiserProfile: { hasPending: false, busy: false },
};
const FACULTY_OPTIONS = FACULTY;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
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

  return {
    start: `${match[1]}-07-01`,
    end: `${match[2]}-06-30`,
    label: `Jul 1, ${match[1]} to Jun 30, ${match[2]}`,
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

function emptyUploads(): Record<UploadSlot, FileMeta | null> {
  return {
    permissionLetter: null,
    brochure: null,
    attendance: null,
    organiserProfile: null,
  };
}

function emptyFacultySelection(): FacultyRowValue {
  return { id: uuid(), name: "", email: "", isLocked: false, savedAtISO: null };
}

function formatFacultyDisplay(selection: FacultyRowValue) {
  return selection.name || selection.email || "";
}

function createEmptyForm(currentFaculty?: FacultyRowValue): WorkshopEntry {
  return withAcademicProgressionCompatibility({
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    academicYear: "",
    yearOfStudy: "",
    currentSemester: null,
    startDate: "",
    endDate: "",
    eventName: "",
    speakerName: "",
    organisationName: "",
    coordinator: currentFaculty?.email ? currentFaculty : emptyFacultySelection(),
    coCoordinators: [],
    participants: null,
    pdfMeta: null,
    pdfSourceHash: "",
    pdfStale: false,
    uploads: {
      ...emptyUploads(),
      geotaggedPhotos: [],
    },
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as WorkshopEntry;
}

function hydrateEntry(entry: WorkshopEntry): WorkshopEntry {
  return withAcademicProgressionCompatibility(
    hydratePdfSnapshot(entry, "workshops") as WorkshopEntry
  ) as WorkshopEntry;
}

export function WorkshopsPage({
  viewEntryId,
  editEntryId,
  startInNewMode = false,
}: CategoryAdapterPageProps = {}) {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const router = useRouter();
  const categoryPath = entryList("workshops");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(startInNewMode);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<FacultyRowValue>(emptyFacultySelection);
  const [list, setList] = useState<WorkshopEntry[]>([]);
  const [form, setForm] = useState<WorkshopEntry>(() => createEmptyForm());
  const [lastPersistedSnapshot, setLastPersistedSnapshot] = useState(() => stableStringify(createEmptyForm()));
  const [singleUploadStatus, setSingleUploadStatus] =
    useState<Record<UploadSlot, UploadStatus>>(EMPTY_UPLOAD_STATUS);
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });
  const formRef = useRef(form);
  const seededViewEntryIdRef = useRef<string | null>(null);
  const activeEntryId = editEntryId?.trim() || viewEntryId?.trim() || "";

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEntryPageModeTelemetry({
    category: "workshops",
    pagePath: "/data-entry/workshops",
    editEntryId,
    startInNewMode,
  });

  const { isPreviewMode: isViewMode, backHref, backDisabled } = useEntryViewMode(
    categoryPath,
    viewEntryId
  );
  const viewedEntry = useMemo(
    () => (activeEntryId ? list.find((item) => item.id === activeEntryId) ?? null : null),
    [activeEntryId, list]
  );

  useEffect(() => {
    if (!activeEntryId) {
      seededViewEntryIdRef.current = null;
      return;
    }

    if (seededViewEntryIdRef.current === activeEntryId) return;

    const nextViewedEntry = list.find((item) => item.id === activeEntryId);
    if (!nextViewedEntry) return;

    seededViewEntryIdRef.current = activeEntryId;
    const hydratedEntry = hydrateEntry(nextViewedEntry);
    setForm(hydratedEntry);
    setLastPersistedSnapshot(stableStringify(hydratedEntry));
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    setSingleUploadStatus({ ...EMPTY_UPLOAD_STATUS });
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }, [activeEntryId, list]);

  function applyPersistedEntry(nextEntry: WorkshopEntry) {
    setForm(nextEntry);
    setLastPersistedSnapshot(stableStringify(nextEntry));
  }

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

    if (!form.eventName.trim()) {
      nextErrors.eventName = "Event name is required.";
    }

    if (!form.speakerName.trim()) {
      nextErrors.speakerName = "Speaker name is required.";
    }

    if (!form.organisationName.trim()) {
      nextErrors.organisationName = "Organisation name is required.";
    }

    if (form.coCoordinators.some((value) => value.name.trim().length === 0)) {
      nextErrors.coCoordinators = "Remove empty co-coordinator rows or fill them in.";
    }

    const emailCounts = new Map<string, number>();
    [(currentFaculty.email || form.coordinator.email), ...form.coCoordinators.map((value) => value.email)]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .forEach((value) => {
        emailCounts.set(value, (emailCounts.get(value) ?? 0) + 1);
      });

    form.coCoordinators.forEach((value, index) => {
      if (!value.email) {
        nextErrors[`coCoordinators.${index}`] = "Select a faculty member from the list.";
        return;
      }

      if ((emailCounts.get(value.email.toLowerCase()) ?? 0) > 1) {
        nextErrors[`coCoordinators.${index}`] = "This faculty is already selected in another role.";
      }
    });

    if (form.participants !== null) {
      if (!Number.isFinite(form.participants) || form.participants <= 0) {
        nextErrors.participants = "Participants must be greater than 0.";
      }
    }

    return nextErrors;
  }, [form, currentFaculty.email]);

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const formDirty = stableStringify(form) !== lastPersistedSnapshot;
  const generateReady = validatePreUploadFields("workshops", form as Record<string, unknown>);
  const uploadsVisible = !!form.pdfMeta;
  const requiredUploadsComplete =
    !!form.uploads.permissionLetter &&
    !!form.uploads.brochure &&
    !!form.uploads.attendance &&
    !!form.uploads.organiserProfile &&
    form.uploads.geotaggedPhotos.length > 0;
  const showForm = formOpen || (!!activeEntryId && (!isViewMode || !!viewedEntry));
  const { entryLocked, controlsDisabled, pendingCoreLocked, coreFieldDisabled } = useEntryFormAccess({
    entry: form,
    category: "workshops",
    isViewMode,
  });
  const pdfHash = useMemo(() => hashPrePdfFields(form, "workshops"), [form]);
  const pdfState = useMemo(
    () =>
      computePdfState({
        pdfMeta: form.pdfMeta ?? null,
        pdfSourceHash: form.pdfSourceHash ?? "",
        draftHash: pdfHash,
        fieldsGateOk: generateReady,
        isLocked: entryLocked,
      }),
    [entryLocked, form.pdfMeta, form.pdfSourceHash, generateReady, pdfHash]
  );
  const generateEntrySnapshot = useGenerateEntry<WorkshopEntry>({
    category: "workshops",
    email,
    hydrateEntry,
  });
  const commitDraftEntry = useCommitDraft<WorkshopEntry>({
    category: "workshops",
    hydrateEntry,
  });
  const refreshList = createRefreshList<WorkshopEntry>({
    endpoint: "/api/me/workshops",
    queryParams: () => ({ email }),
    normalizeItems: (items) => (items as WorkshopEntry[]).map((entry) => hydrateEntry(entry)),
    setList,
  });

  const persistProgress = createPersistProgress<WorkshopEntry>({
    endpoint: "/api/me/workshops",
    category: "workshops",
    buildBody: (entry) => ({ email, entry: withAcademicProgressionCompatibility(entry) }),
    normalizeResponse: (data) => hydrateEntry(data as WorkshopEntry),
  });

  const controller = useCategoryEntryPageController<WorkshopEntry>({
    category: "workshops",
    list,
    setList,
    form,
    formRef,
    showForm,
    isViewMode,
    entryLocked,
    controlsDisabled,
    loading,
    busyUploadSources: [singleUploadStatus, photoUploadStatus],
    coreValid: generateReady,
    hasPdfSnapshot: uploadsVisible,
    pdfStale: pdfState.pdfStale,
    completionValid: requiredUploadsComplete,
    fieldDirty: formDirty,
    autoSaveSynced: stableStringify(form) === lastPersistedSnapshot,
    defaultCancelTargetHref: categoryPath,
    closeForm,
    buildEntryToSave: () => {
      const latestForm = formRef.current;
      return withAcademicProgressionCompatibility({
        ...latestForm,
        coordinator: currentFaculty.email ? currentFaculty : latestForm.coordinator,
      }) as WorkshopEntry;
    },
    buildOptimisticEntry: (entryToSave) =>
      hydrateEntry({
        ...entryToSave,
        updatedAt: new Date().toISOString(),
      }),
    persistProgress,
    normalizePersistedEntry: hydrateEntry,
    persistRequestEdit: async (entry) => {
      const response = await fetch("/api/me/entry/confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: "workshops", entryId: entry.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Request failed.");
      return hydrateEntry(payload);
    },
    persistCancelRequestEdit: async (entry) => {
      const response = await fetch("/api/me/entry/confirmation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryKey: "workshops", entryId: entry.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Cancel request failed.");
      return hydrateEntry(payload);
    },
    commitDraft: commitDraftEntry,
    applyPersistedEntry: (entry) => {
      applyPersistedEntry(entry);
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
    },
    afterPersistSuccess: async () => {
      void refreshList();
    },
    setSubmitAttemptedFinal,
    saveAndCloseBusyMessage: "Finish the current uploads before continuing.",
    hasValidationErrors: Object.keys(errors).length > 0,
    markGenerateAttempted: () => setSubmitted(true),
    buildDraftEntry: () => {
      const latestForm = formRef.current;
      return {
        ...latestForm,
        coordinator: currentFaculty.email ? currentFaculty : latestForm.coordinator,
        pdfStale: pdfState.pdfStale,
        pdfSourceHash: latestForm.pdfSourceHash || "",
      };
    },
    generateEntrySnapshot,
    applyGeneratedEntry: async (nextEntry) => {
      setForm(nextEntry);
      setLastPersistedSnapshot(stableStringify(nextEntry));
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
    groupedEntries,
    smartGroupedEntries,
    handleCancel,
    hasUnsavedChanges,
    persistCurrentMutation,
    requestEdit,
    requestingEditIds,
    sendForConfirmation,
    sendingConfirmationIds,
    setToast,
    showToast,
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
        const nextForm = createEmptyForm(nextFaculty);
        setCurrentFaculty(nextFaculty);
        setForm(nextForm);
        setLastPersistedSnapshot(stableStringify(nextForm));

        const listResponse = await fetch(`/api/me/workshops?email=${encodeURIComponent(nextEmail)}`, {
          cache: "no-store",
        });
        const items = await listResponse.json();

        if (!listResponse.ok) {
          throw new Error(items?.error || "Failed to load Workshops records.");
        }

        setList(Array.isArray(items) ? (items as WorkshopEntry[]).map((entry) => hydrateEntry(entry)) : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
  }, [setToast]);
  function resetForm() {
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextForm = createEmptyForm(currentFaculty);
    setForm(nextForm);
    setLastPersistedSnapshot(stableStringify(nextForm));
    setSingleUploadStatus({ ...EMPTY_UPLOAD_STATUS });
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/workshops-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function cleanupDraftUploads(entry: WorkshopEntry) {
    const metas = [
      entry.uploads.permissionLetter,
      entry.uploads.brochure,
      entry.uploads.attendance,
      entry.uploads.organiserProfile,
      ...entry.uploads.geotaggedPhotos,
    ].filter((meta): meta is FileMeta => !!meta?.storedPath);

    await Promise.all(metas.map((meta) => deleteStoredFile(meta.storedPath)));
  }

  async function closeForm(targetHref = categoryPath) {
    const currentEntryId = String(form.id ?? "").trim();
    const hasPersistedEntry = currentEntryId
      ? list.some((entry) => String(entry.id ?? "").trim() === currentEntryId)
      : false;
    if (
      !hasPersistedEntry &&
      !form.pdfMeta &&
      (
        entryHasUpload(form.uploads.permissionLetter) ||
        entryHasUpload(form.uploads.brochure) ||
        entryHasUpload(form.uploads.attendance) ||
        entryHasUpload(form.uploads.organiserProfile) ||
        form.uploads.geotaggedPhotos.length > 0
      )
    ) {
      await cleanupDraftUploads(form);
    }

    resetForm();
    setFormOpen(false);
    safeBack(router, targetHref);
  }

  async function persistCoCoordinatorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) =>
        withAcademicProgressionCompatibility({
          ...current,
          coordinator: currentFaculty.email ? currentFaculty : current.coordinator,
          coCoordinators: nextRows,
        }) as WorkshopEntry,
      selectResult: (persisted) => persisted.coCoordinators,
    });
  }

  const deleteEntry = createDeleteEntry<WorkshopEntry>({
    endpoint: "/api/me/workshops",
    category: "workshops",
    buildBody: (id) => ({ email, id }),
    setList,
    refreshList,
    showToast,
  });

  const renderSavedEntry = createCategoryEntryRecordRenderer<WorkshopEntry>({
    buildHref: (entry) => entryDetail("workshops", entry.id),
    buildTitle: (entry) => entry.eventName,
    buildSubtitle: (entry) => `Speaker: ${entry.speakerName} • ${entry.organisationName}`,
    onView: (entry) => router.push(entryDetail("workshops", entry.id)),
    onEdit: (entry) => router.push(entryDetail("workshops", entry.id)),
    onFinalise: (entry) => void finaliseEntry(entry),
    canFinalise: (entry) => {
      if (!isEntryEditable(entry)) return false;
      const progress = computeFieldProgress("workshops", entry as Record<string, unknown>);
      return progress.total > 0 && progress.completed === progress.total;
    },
    requestConfirmation,
    buildDeleteRequest: (entry) => ({
      title: "Delete entry?",
      description: "This permanently deletes this workshop entry and its associated uploaded files.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
      onConfirm: () => deleteEntry(entry.id),
    }),
    requestingEditIds,
    sendingConfirmationIds,
    requestEdit: (entry) => void requestEdit(entry),
    cancelRequestEdit: (entry) => void cancelRequestEdit(entry),
    sendForConfirmation: (entry) => void sendForConfirmation(entry),
    renderBody: (entry) => {
      const days = getInclusiveDays(entry.startDate, entry.endDate);
      const startStr = formatDisplayDate(entry.startDate);
      const endStr = formatDisplayDate(entry.endDate);
      const parts: string[] = [];
      if (entry.academicYear) parts.push(entry.academicYear);
      if (entry.currentSemester) parts.push(`Semester ${entry.currentSemester}`);
      if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
      else if (startStr !== "-") parts.push(startStr);
      if (days) parts.push(`${days} days`);
      if (entry.participants) parts.push(`${entry.participants} participants`);

      const people: string[] = [];
      const coord = formatFacultyDisplay(entry.coordinator);
      if (coord) people.push(coord);
      if (entry.coCoordinators.length > 0) people.push(...entry.coCoordinators.map(formatFacultyDisplay).filter(Boolean));

      return (
        <>
          {parts.length > 0 && (
            <div className="text-xs text-muted-foreground">{parts.join(" • ")}</div>
          )}
          {people.length > 0 && (
            <div className="text-xs text-muted-foreground">{people.join(", ")}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {UPLOAD_CONFIG.map(({ slot, label }) =>
              entry.uploads[slot] ? (
                <a
                  key={slot}
                  className="underline"
                  href={entry.uploads[slot]?.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                </a>
              ) : null
            )}
            {entry.uploads.geotaggedPhotos.map((meta, photoIndex) => (
              <a
                key={meta.storedPath}
                className="underline"
                href={meta.url}
                target="_blank"
                rel="noreferrer"
              >
                Geotagged Photo {photoIndex + 1}
              </a>
            ))}
          </div>
        </>
      );
    },
  });

  return (
    <CategoryEntryRuntime
      entryShell={{
        category: "workshops",
        mode: isViewMode ? "view" : showForm ? (activeEntryId ? "edit" : "new") : "preview",
        entry: showForm ? (form as Record<string, unknown>) : null,
        title: "Workshops",
        subtitle: "Record workshop details and supporting documents.",
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
          router.push(entryNew("workshops"), { scroll: false });
        },
        addLabel: "Add Workshop",
        workflowAction: showForm && !isViewMode ? {
          label: "Generate Entry",
          onClick: () => controller.generateEntry(),
          disabled: controller.actionState.generateDisabled,
          busyLabel: "Generating...",
        } : undefined,
        entryStatus: form.confirmationStatus,
        onRequestEdit: () => void controller.requestEdit(form),
        onCancelRequestEdit: () => void controller.cancelRequestEdit(form),
        onFinalise: isViewMode && isEntryEditable(form) && (() => {
          const progress = computeFieldProgress("workshops", form as Record<string, unknown>);
          return progress.total > 0 && progress.completed === progress.total;
        })() ? () => void finaliseEntry(form) : undefined,
      })}
      loading={loading}
      showForm={showForm}
      toast={toast}
      formCard={
        showForm
          ? {
              className: "bg-white/70 p-5",
              title: isViewMode ? "Workshop Entry" : "New Workshop Entry",
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
                            const nextSemester = isSemesterAllowed(
                              nextYear || undefined,
                              current.currentSemester ?? undefined
                            )
                              ? current.currentSemester
                              : null;

                            return withAcademicProgressionCompatibility({
                              ...current,
                              yearOfStudy: nextYear,
                              currentSemester: nextSemester,
                            }) as WorkshopEntry;
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
                            }) as WorkshopEntry
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

                    <Field
                      label="Start Date"
                      error={submitted ? errors.startDate : undefined}
                      hint={form.academicYear ? getAcademicYearRange(form.academicYear)?.label : undefined}
                    >
                      <DateField
                        value={form.startDate}
                        onChange={(next) => setForm((current) => ({ ...current, startDate: next }))}
                        disabled={coreFieldDisabled("startDate")}
                        error={submitted && !!errors.startDate}
                      />
                    </Field>

                    <Field
                      label="End Date"
                      error={submitted ? errors.endDate : undefined}
                      hint={
                        inclusiveDays
                          ? `Number of Days: ${inclusiveDays}`
                          : "Number of Days will be calculated automatically."
                      }
                    >
                      <DateField
                        value={form.endDate}
                        onChange={(next) => setForm((current) => ({ ...current, endDate: next }))}
                        disabled={coreFieldDisabled("endDate")}
                        error={submitted && !!errors.endDate}
                      />
                    </Field>

                    <Field label="Name of the Event" error={submitted ? errors.eventName : undefined}>
                      <input
                        value={form.eventName}
                        onChange={(event) => setForm((current) => ({ ...current, eventName: event.target.value }))}
                        disabled={coreFieldDisabled("eventName")}
                        className={cx(
                          "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-400",
                          submitted && errors.eventName
                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                            : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20"
                        )}
                      />
                    </Field>

                    <Field label="Name of the Speaker" error={submitted ? errors.speakerName : undefined}>
                      <input
                        value={form.speakerName}
                        onChange={(event) => setForm((current) => ({ ...current, speakerName: event.target.value }))}
                        disabled={coreFieldDisabled("speakerName")}
                        className={cx(
                          "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-400",
                          submitted && errors.speakerName
                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                            : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20"
                        )}
                      />
                    </Field>

                    <Field label="Name of the Organisation" error={submitted ? errors.organisationName : undefined}>
                      <input
                        value={form.organisationName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, organisationName: event.target.value }))
                        }
                        disabled={coreFieldDisabled("organisationName")}
                        className={cx(
                          "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-400",
                          submitted && errors.organisationName
                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                            : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20"
                        )}
                      />
                    </Field>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                    Coordinator:{" "}
                    <span className="font-medium text-foreground">
                      {currentFaculty.name || form.coordinator.name || "-"}
                    </span>
                  </div>

                  <div className="mt-5">
                    <FacultyRowPicker
                      title="Co-coordinator(s)"
                      helperText="Add co-coordinators only when applicable."
                      addLabel="Add Co-coordinator"
                      rowLabelPrefix="Co-coordinator"
                      rows={form.coCoordinators}
                      onRowsChange={(rows) => setForm((current) => ({ ...current, coCoordinators: rows }))}
                      onPersistRow={async (rows) => persistCoCoordinatorRows(rows)}
                      facultyOptions={FACULTY_OPTIONS}
                      disableEmails={[currentFaculty.email || form.coordinator.email]}
                      parentLocked={coreFieldDisabled("coCoordinators")}
                      viewOnly={isViewMode}
                      sectionError={errors.coCoordinators}
                      showSectionError={submitted}
                      emptyStateText="No co-coordinators added."
                      validateRow={(rows, row, index) => {
                        if (!row.email) return "Select a faculty member from the list.";
                        const duplicates = rows.filter(
                          (item, itemIndex) =>
                            itemIndex !== index &&
                            item.email.trim().toLowerCase() === row.email.trim().toLowerCase()
                        ).length;
                        return duplicates > 0 ? "This faculty is already selected in another role." : null;
                      }}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Number of Participants"
                      error={submitted ? errors.participants : undefined}
                      hint="Optional. Digits only"
                    >
                      <input
                        inputMode="numeric"
                        value={form.participants === null ? "" : String(form.participants)}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, "");
                          setForm((current) => ({
                            ...current,
                            participants: digits === "" ? null : Number(digits),
                          }));
                        }}
                        disabled={coreFieldDisabled("participants")}
                        className={cx(
                          "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-400",
                          submitted && errors.participants
                            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                            : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20"
                        )}
                      />
                    </Field>
                  </div>

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

                    {uploadsVisible ? (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {UPLOAD_CONFIG.map(({ slot, label }) => (
                          <EntryUploader
                            key={slot}
                            title={label}
                            mode={isViewMode ? "view" : "edit"}
                            meta={form.uploads[slot]}
                            uploadEndpoint="/api/me/workshops-file"
                            email={email}
                            recordId={form.id}
                            slot={slot}
                            disabled={controlsDisabled}
                            showValidationError={submitAttemptedFinal}
                            validationMessage="This upload is mandatory."
                            onStatusChange={(status) =>
                              setSingleUploadStatus((current) => ({
                                ...current,
                                [slot]: status,
                              }))
                            }
                            onUploaded={async (meta) => {
                              await persistCurrentMutation({
                                buildNextEntry: (current) => ({
                                  ...current,
                                  uploads: {
                                    ...current.uploads,
                                    [slot]: meta,
                                  },
                                }),
                              });
                            }}
                            onDeleted={async () => {
                              await persistCurrentMutation({
                                buildNextEntry: (current) => ({
                                  ...current,
                                  uploads: {
                                    ...current.uploads,
                                    [slot]: null,
                                  },
                                }),
                              });
                            }}
                          />
                        ))}

                        <MultiPhotoUpload
                          title="Geotagged Photos"
                          value={form.uploads.geotaggedPhotos}
                          onUploaded={async (meta) => {
                            await persistCurrentMutation({
                              buildNextEntry: (current) => ({
                                ...current,
                                uploads: {
                                  ...current.uploads,
                                  geotaggedPhotos: [...current.uploads.geotaggedPhotos, meta],
                                },
                              }),
                            });
                          }}
                          onDeleted={async (meta) => {
                            await persistCurrentMutation({
                              buildNextEntry: (current) => ({
                                ...current,
                                uploads: {
                                  ...current.uploads,
                                  geotaggedPhotos: current.uploads.geotaggedPhotos.filter(
                                    (item) => item.storedPath !== meta.storedPath
                                  ),
                                },
                              }),
                            });
                          }}
                          uploadEndpoint="/api/me/workshops-file"
                          email={email}
                          recordId={form.id}
                          slotName="geotaggedPhotos"
                          disabled={controlsDisabled}
                          viewOnly={isViewMode}
                          showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                          requiredErrorText="At least one geotagged photo is required."
                          onStatusChange={setPhotoUploadStatus}
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
        !showForm
          ? createGroupedEntryListCard({
              title: "Saved Workshop Entries",
              subtitle: "Your saved workshop records are stored locally and keyed to your signed-in email.",
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

export default WorkshopsPage;

function entryHasUpload(meta: FileMeta | null) {
  return !!meta?.storedPath;
}
