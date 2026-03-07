"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import CategoryEntryPageShell from "@/components/data-entry/CategoryEntryPageShell";
import CurrencyField from "@/components/controls/CurrencyField";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import EntryListCardShell from "@/components/data-entry/EntryListCardShell";
import Field from "@/components/data-entry/Field";
import GroupedEntrySections from "@/components/data-entry/GroupedEntrySections";
import DateField from "@/components/controls/DateField";
import AutoSaveIndicator from "@/components/entry/AutoSaveIndicator";
import { EntryHeaderActionsBar } from "@/components/entry/EntryHeaderActions";
import EntryLockBadge from "@/components/entry/EntryLockBadge";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import RequestEditAction from "@/components/entry/RequestEditAction";
import MultiPhotoUpload from "@/components/entry/UploadFieldMulti";
import EntryUploader from "@/components/upload/EntryUploader";
import { ActionButton } from "@/components/ui/ActionButton";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { useCategoryEntryPageController } from "@/hooks/useCategoryEntryPageController";
import { useCommitDraft } from "@/hooks/useCommitDraft";
import { useGenerateEntry } from "@/hooks/useGenerateEntry";
import { useEntryConfirmation } from "@/hooks/useEntryConfirmation";
import { useRequestEdit } from "@/hooks/useRequestEdit";
import { useEntryFormAccess } from "@/hooks/useEntryFormAccess";
import { useEntryPageModeTelemetry } from "@/hooks/useEntryPageModeTelemetry";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { validatePreUploadFields } from "@/lib/categoryRequirements";
import {
  canSendForConfirmation,
  getConfirmationStatusLabel,
  getEntryApprovalStatus,
  isEntryLockedFromStatus,
} from "@/lib/confirmation";
import { FACULTY } from "@/lib/facultyDirectory";
import { getStreakDeadlineState } from "@/lib/streakDeadline";
import {
  getEntryStreakDisplayState,
  type EntryDisplayCategory,
} from "@/lib/entries/displayLifecycle";
import { isEntryCommitted } from "@/lib/entries/stateMachine";
import { entryDetail, entryList, entryNew, safeBack } from "@/lib/entryNavigation";
import { nowISTTimestampISO } from "@/lib/gamification";
import { computePdfState, hashPrePdfFields, hydratePdfSnapshot } from "@/lib/pdfSnapshot";
import { useEntryViewMode } from "@/hooks/useEntryViewMode";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
  type YearOfStudy,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import {
  createOptimisticSnapshot,
  optimisticRemove,
} from "@/lib/ui/optimistic";
import { trackClientTelemetryEvent } from "@/lib/telemetry/client";
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

type StaffSelection = FacultyRowValue;

type UploadSlot = "permissionLetter" | "travelPlan";
type UploadStatus = { hasPending: boolean; busy: boolean };

const SINGLE_UPLOAD_SLOTS: Array<{ slot: UploadSlot; label: string }> = [
  { slot: "permissionLetter", label: "Permission Letter" },
  { slot: "travelPlan", label: "Travel Plan" },
];

const EMPTY_UPLOAD_STATUS: Record<UploadSlot, UploadStatus> = {
  permissionLetter: { hasPending: false, busy: false },
  travelPlan: { hasPending: false, busy: false },
};

type CaseStudyEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "staffAccompanying";
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  startDate: string;
  endDate: string;
  coordinator: FacultyRowValue;
  placeOfVisit: string;
  purposeOfVisit: string;
  staffAccompanying: StaffSelection[];
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  participants: number | null;
  amountSupport: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfSourceHash?: string | null;
  pdfStale?: boolean;
  permissionLetter: FileMeta | null;
  travelPlan: FileMeta | null;
  geotaggedPhotos: FileMeta[];
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

const FACULTY_OPTIONS = FACULTY;
const DEBUG_SAVE_FACULTY = false;

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

  const entries = Object.entries(value as Record<string, unknown>).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  );

  return `{${entries
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

function buildStaffKey(selection: StaffSelection) {
  const email = selection.email.trim().toLowerCase();
  if (email) return `email:${email}`;
  return `name:${selection.name.trim().toLowerCase()}`;
}

function emptyStaff(): StaffSelection {
  return { id: uuid(), name: "", email: "", isLocked: false, savedAtISO: null };
}

function emptyForm(currentFaculty?: FacultyRowValue): CaseStudyEntry {
  return withAcademicProgressionCompatibility({
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    academicYear: "",
    startDate: "",
    endDate: "",
    coordinator: currentFaculty?.email ? currentFaculty : emptyStaff(),
    placeOfVisit: "",
    purposeOfVisit: "",
    staffAccompanying: [],
    yearOfStudy: "",
    currentSemester: null,
    participants: null,
    amountSupport: null,
    pdfMeta: null,
    pdfSourceHash: "",
    pdfStale: false,
    permissionLetter: null,
    travelPlan: null,
    geotaggedPhotos: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as CaseStudyEntry;
}

function hydrateEntry(entry: CaseStudyEntry): CaseStudyEntry {
  return withAcademicProgressionCompatibility(
    hydratePdfSnapshot(entry, "case-studies") as CaseStudyEntry
  ) as CaseStudyEntry;
}

function MiniButton(props: React.ComponentProps<typeof ActionButton>) {
  return <ActionButton {...props} />;
}

type CaseStudiesPageProps = {
  viewEntryId?: string;
  editEntryId?: string;
  startInNewMode?: boolean;
};

export function CaseStudiesPage({
  viewEntryId,
  editEntryId,
  startInNewMode = false,
}: CaseStudiesPageProps = {}) {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const router = useRouter();
  const categoryPath = entryList("case-studies");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(startInNewMode);
  const [attemptedSectionSave, setAttemptedSectionSave] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<FacultyRowValue>(emptyStaff);
  const [list, setList] = useState<CaseStudyEntry[]>([]);
  const [form, setForm] = useState<CaseStudyEntry>(() => emptyForm());
  const [lastPersistedSnapshot, setLastPersistedSnapshot] = useState(() => stableStringify(emptyForm()));
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
    category: "case-studies",
    pagePath: "/data-entry/case-studies",
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
    setAttemptedSectionSave(false);
    setSubmitAttemptedFinal(false);
    setSingleUploadStatus({ ...EMPTY_UPLOAD_STATUS });
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }, [activeEntryId, list]);

  function applyPersistedEntry(nextEntry: CaseStudyEntry) {
    setForm(nextEntry);
    setLastPersistedSnapshot(stableStringify(nextEntry));
  }

  function buildEntryErrors(entry: CaseStudyEntry) {
    const nextErrors: Record<string, string> = {};

    if (!ACADEMIC_YEAR_OPTIONS.includes(entry.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
      nextErrors.academicYear = "Academic year is required.";
    }

    if (!isISODate(entry.startDate)) {
      nextErrors.startDate = "Starting date is required.";
    } else {
      const academicYearRange = getAcademicYearRange(entry.academicYear);
      if (academicYearRange && (entry.startDate < academicYearRange.start || entry.startDate > academicYearRange.end)) {
        nextErrors.startDate = `Starting date must fall within ${entry.academicYear} (${academicYearRange.label}).`;
      }
    }

    if (!isISODate(entry.endDate)) {
      nextErrors.endDate = "Ending date is required.";
    } else if (isISODate(entry.startDate) && entry.endDate < entry.startDate) {
      nextErrors.endDate = "Ending date must be on or after starting date.";
    }

    if (!entry.placeOfVisit.trim()) {
      nextErrors.placeOfVisit = "Place of visit is required.";
    }

    if (!entry.purposeOfVisit.trim()) {
      nextErrors.purposeOfVisit = "Purpose of visit is required.";
    }

    if (entry.staffAccompanying.length === 0) {
      nextErrors.staffAccompanying = "Add at least one staff member.";
    }

    const duplicateKeys = new Map<string, number>();
    entry.staffAccompanying.forEach((staff) => {
      const key = buildStaffKey(staff);
      if (key !== "name:") {
        duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
      }
    });

    entry.staffAccompanying.forEach((staff, index) => {
      if (!staff.name.trim()) {
        nextErrors[`staffAccompanying.${index}`] = "Staff member is required.";
        return;
      }

      const key = buildStaffKey(staff);
      if (key !== "name:" && (duplicateKeys.get(key) ?? 0) > 1) {
        nextErrors[`staffAccompanying.${index}`] = "This faculty is already selected in another row.";
      }
    });

    const normalizedStudentYear = normalizeYearOfStudy(entry.yearOfStudy);
    if (!normalizedStudentYear) {
      nextErrors.yearOfStudy = "Year of study is required.";
    }

    if (normalizedStudentYear && !isSemesterAllowed(normalizedStudentYear, entry.currentSemester ?? undefined)) {
      nextErrors.currentSemester = "Current semester is required.";
    }

    if (entry.amountSupport !== null) {
      if (!Number.isFinite(entry.amountSupport) || entry.amountSupport < 0) {
        nextErrors.amountSupport = "Invalid amount.";
      }
    }

    return nextErrors;
  }

  const errors = useMemo(() => buildEntryErrors(form), [form]);

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const { entryLocked, controlsDisabled, pendingCoreLocked, coreFieldDisabled } = useEntryFormAccess({
    entry: form,
    category: "case-studies",
    isViewMode,
  });
  const formDirty = stableStringify(form) !== lastPersistedSnapshot;
  const generateReady = validatePreUploadFields("case-studies", form as Record<string, unknown>);
  const uploadsVisible = !!form.pdfMeta;
  const requiredUploadsComplete = !!form.permissionLetter && !!form.travelPlan && form.geotaggedPhotos.length > 0;
  const showForm = formOpen || (!!activeEntryId && (!isViewMode || !!viewedEntry));
  const pdfHash = useMemo(() => hashPrePdfFields(form, "case-studies"), [form]);
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
  const generateEntrySnapshot = useGenerateEntry<CaseStudyEntry>({
    category: "case-studies",
    email,
    hydrateEntry,
  });
  const commitDraftEntry = useCommitDraft<CaseStudyEntry>({
    category: "case-studies",
    hydrateEntry,
  });
  const controller = useCategoryEntryPageController<CaseStudyEntry>({
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
      }) as CaseStudyEntry;
    },
    buildOptimisticEntry: (entryToSave) =>
      hydrateEntry({
        ...entryToSave,
        updatedAt: new Date().toISOString(),
      }),
    persistProgress: async (entryToSave) => hydrateEntry(await persistProgress(entryToSave)),
    commitDraft: async (entryId) => commitDraftEntry(entryId),
    applyPersistedEntry: (entry) => {
      applyPersistedEntry(entry);
      setAttemptedSectionSave(false);
      setSubmitAttemptedFinal(false);
    },
    afterPersistSuccess: async () => {
      void refreshList(email);
    },
    setSubmitAttemptedFinal,
    hasValidationErrors: Object.keys(errors).length > 0,
    markGenerateAttempted: () => setAttemptedSectionSave(true),
    buildDraftEntry: () => {
      const latestForm = formRef.current;
      return {
        ...latestForm,
        coordinator: currentFaculty.email ? currentFaculty : latestForm.coordinator,
      };
    },
    generateEntrySnapshot,
    applyGeneratedEntry: async (nextEntry) => {
      applyPersistedEntry(nextEntry);
      setAttemptedSectionSave(false);
      setSubmitAttemptedFinal(false);
      await refreshList(email);
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
    runWithSaveGuard,
    saveIntent,
    saving,
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
        setCurrentFaculty(nextFaculty);
        const nextForm = emptyForm(nextFaculty);
        setForm(nextForm);
        setLastPersistedSnapshot(stableStringify(nextForm));

        const listResponse = await fetch(`/api/me/case-studies?email=${encodeURIComponent(nextEmail)}`, {
          cache: "no-store",
        });
        const items = await listResponse.json();

        if (!listResponse.ok) {
          throw new Error(items?.error || "Failed to load Case Studies records.");
        }

        setList(
          Array.isArray(items) ? (items as CaseStudyEntry[]).map((entry) => hydrateEntry(entry)) : []
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
  }, [setToast]);

  function resetForm() {
    setAttemptedSectionSave(false);
    setSubmitAttemptedFinal(false);
    const nextForm = emptyForm(currentFaculty);
    setForm(nextForm);
    setLastPersistedSnapshot(stableStringify(nextForm));
    setSingleUploadStatus({ ...EMPTY_UPLOAD_STATUS });
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/case-studies-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function cleanupDraftUploads(entry: CaseStudyEntry) {
    const metas = [entry.permissionLetter, entry.travelPlan, ...entry.geotaggedPhotos].filter(
      (meta): meta is FileMeta => !!meta?.storedPath
    );

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
      (form.permissionLetter || form.travelPlan || form.geotaggedPhotos.length > 0)
    ) {
      await cleanupDraftUploads(form);
    }
    resetForm();
    setFormOpen(false);
    safeBack(router, targetHref);
  }

  async function refreshList(nextEmail = email) {
    const response = await fetch(`/api/me/case-studies?email=${encodeURIComponent(nextEmail)}`, {
      cache: "no-store",
    });
    const items = await response.json();

    if (!response.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    setList(
      Array.isArray(items) ? (items as CaseStudyEntry[]).map((entry) => hydrateEntry(entry)) : []
    );
  }

  async function persistProgress(nextForm: CaseStudyEntry) {
    const startedAt = Date.now();
    const eventName = String(nextForm.createdAt ?? "").trim() ? "entry.update" : "entry.create";
    const response = await fetch("/api/me/case-studies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, entry: withAcademicProgressionCompatibility(nextForm) }),
    });
    const { message, payload } = await parseApiError(response, "Save failed");

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
        category: "case-studies",
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
          category: "case-studies",
          entryId: String(nextForm.id ?? "").trim() || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: { action: eventName, source: "manual", errorCode },
        });
      } else if (errorCode === "RATE_LIMITED") {
        void trackClientTelemetryEvent({
          event: "rate_limit.hit",
          category: "case-studies",
          entryId: String(nextForm.id ?? "").trim() || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: { action: eventName, source: "manual", errorCode },
        });
      } else if (errorCode === "PAYLOAD_TOO_LARGE") {
        void trackClientTelemetryEvent({
          event: "payload.too_large",
          category: "case-studies",
          entryId: String(nextForm.id ?? "").trim() || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: { action: eventName, source: "manual", errorCode },
        });
      }
      throw new Error(message);
    }

    const persisted = hydrateEntry(payload as CaseStudyEntry);
    void trackClientTelemetryEvent({
      event: eventName,
      category: "case-studies",
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

  async function parseApiError(response: Response, fallback: string) {
    const text = await response.text();
    let message = `${fallback} (${response.status})`;
    let payload: unknown = null;

    try {
      payload = text ? JSON.parse(text) : null;
      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof (payload as { error?: unknown }).error === "string"
      ) {
        message = `${(payload as { error: string }).error} (${response.status})`;
      }
    } catch {
      payload = null;
    }

    return { message, payload };
  }

  function buildRowSaveEntry(rows: StaffSelection[]) {
    const savedRows = rows
      .filter((staff) => staff.isLocked && staff.email.trim())
      .map((staff) => ({
        ...staff,
        email: staff.email.trim().toLowerCase(),
        savedAtISO: staff.savedAtISO ?? nowISTTimestampISO(),
      }));

    return {
      ...form,
      coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
      staffAccompanying: savedRows,
    };
  }

  function validateRowForFacultySave(entryDraft: CaseStudyEntry, row: StaffSelection) {
    const selectedEmail = row.email.trim().toLowerCase();
    if (!selectedEmail) {
      return { ok: false, error: "Select a faculty member first." };
    }

    const matchingFaculty = FACULTY_OPTIONS.find((faculty) => faculty.email.trim().toLowerCase() === selectedEmail);
    if (!matchingFaculty) {
      return { ok: false, error: "Select a listed faculty member." };
    }

    const duplicateCount = entryDraft.staffAccompanying.filter(
      (staff) => staff.email.trim().toLowerCase() === selectedEmail
    ).length;
    if (duplicateCount > 1) {
      return { ok: false, error: "This faculty is already selected in another row." };
    }

    if (!ACADEMIC_YEAR_OPTIONS.includes(entryDraft.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
      return { ok: false, error: "Select academic year first." };
    }

    if (!isISODate(entryDraft.startDate)) {
      return { ok: false, error: "Select a valid starting date first." };
    }

    const academicYearRange = getAcademicYearRange(entryDraft.academicYear);
    if (
      academicYearRange &&
      (entryDraft.startDate < academicYearRange.start || entryDraft.startDate > academicYearRange.end)
    ) {
      return { ok: false, error: `Starting date must fall within ${entryDraft.academicYear}.` };
    }

    if (!isISODate(entryDraft.endDate) || entryDraft.endDate < entryDraft.startDate) {
      return { ok: false, error: "Select a valid ending date first." };
    }

    return { ok: true, error: null };
  }

  async function persistStaffRows(
    nextRows: StaffSelection[],
    context: {
      row: StaffSelection;
      rowId: string;
      index: number;
      previousRows: StaffSelection[];
      savedAtISO: string;
    }
  ) {
    const entryToSave = buildRowSaveEntry(nextRows);
    const rowValidation = validateRowForFacultySave(entryToSave, context.row);

    if (DEBUG_SAVE_FACULTY) {
      console.log("[case-studies][save-faculty]", {
        rowId: context.rowId,
        selectedEmail: context.row.email,
        selectedName: context.row.name,
        entryId: form.id,
        sharedEntryId: form.sharedEntryId ?? null,
        payload: {
          id: entryToSave.id,
          sharedEntryId: entryToSave.sharedEntryId ?? null,
          academicYear: entryToSave.academicYear,
          yearOfStudy: entryToSave.yearOfStudy,
          currentSemester: entryToSave.currentSemester,
          startDate: entryToSave.startDate,
          endDate: entryToSave.endDate,
          staffAccompanying: entryToSave.staffAccompanying.map((item) => ({
            name: item.name,
            email: item.email,
            isLocked: item.isLocked,
          })),
        },
      });
    }

    if (!rowValidation.ok) {
      throw new Error(rowValidation.error ?? "Save faculty failed.");
    }

    return runWithSaveGuard(async () => {
      const response = await fetch("/api/me/case-studies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          entry: withAcademicProgressionCompatibility(entryToSave),
        }),
      });
      const { payload, message } = await parseApiError(response, "Save faculty failed");

      if (!response.ok) {
        throw new Error(message);
      }

      const savedEntry = hydrateEntry(payload as CaseStudyEntry);
      await refreshList(email);
      const mergedRows = nextRows.map((item) => {
        const savedStaff =
          savedEntry.staffAccompanying.find(
            (candidate) => candidate.email.trim().toLowerCase() === item.email.trim().toLowerCase()
          ) ?? null;

        return savedStaff
          ? {
              ...item,
              id: savedStaff.id ?? item.id,
              name: savedStaff.name,
              email: savedStaff.email,
              isLocked: !!savedStaff.isLocked,
              savedAtISO: savedStaff.savedAtISO ?? item.savedAtISO ?? null,
            }
          : item;
      });

      setForm((current) => ({
        ...current,
        sharedEntryId: savedEntry.sharedEntryId,
        sourceEmail: savedEntry.sourceEmail,
        coordinator: savedEntry.coordinator,
        createdAt: savedEntry.createdAt,
        updatedAt: savedEntry.updatedAt,
        staffAccompanying: mergedRows,
      }));

      setToast({ type: "ok", msg: `Saved for ${context.row.name}.` });
      setTimeout(() => setToast(null), 1400);
      return mergedRows;
    });
  }

  async function deleteEntry(id: string) {
    const startedAt = Date.now();
    let failureTracked = false;
    let rollbackSnapshot: CaseStudyEntry[] | null = null;
    setList((current) => {
      rollbackSnapshot = createOptimisticSnapshot(current);
      return optimisticRemove(current, id);
    });

    try {
      const response = await fetch("/api/me/case-studies", {
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
          category: "case-studies",
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
        category: "case-studies",
        entryId: id,
        success: true,
        durationMs: Date.now() - startedAt,
        meta: {
          source: "manual",
        },
      });
      setList((current) => optimisticRemove(current, id));
      void refreshList(email);
      setToast({ type: "ok", msg: "Entry deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      if (rollbackSnapshot) {
        setList(rollbackSnapshot);
      }
      if (!failureTracked) {
        void trackClientTelemetryEvent({
          event: "action.failure",
          category: "case-studies",
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

  const { requestingIds: requestingEditIds, requestEdit, cancelRequestEdit } = useRequestEdit<CaseStudyEntry>({
    setItems: setList,
    persistRequest: async (entry) =>
      persistProgress({
        ...entry,
        requestEditStatus: "pending",
        requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? nowISTTimestampISO(),
      }),
    persistCancel: async (entry) =>
      persistProgress({
        ...entry,
        requestEditStatus: "none",
        requestEditRequestedAtISO: null,
      }),
    onSuccess: (message) => {
      setToast({ type: "ok", msg: message });
      setTimeout(() => setToast(null), 1400);
    },
    onError: (message) => {
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    },
  });
  const { sendingIds: sendingConfirmationIds, sendForConfirmation } = useEntryConfirmation<CaseStudyEntry>({
    category: "case-studies",
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

  function renderSavedEntry(entry: CaseStudyEntry, category: EntryDisplayCategory, index: number) {
    const deadlineState = getStreakDeadlineState(entry);
    const completedEntry = isEntryCommitted(entry);
    const confirmationStatus = getEntryApprovalStatus(entry);
    const lockApproved = isEntryLockedFromStatus(entry);
    const canSendConfirmation = canSendForConfirmation(entry);
    const sendingConfirmation = !!sendingConfirmationIds[entry.id];
    const days = getInclusiveDays(entry.startDate, entry.endDate);

    return (
      <EntryListCardShell
        category={category}
        index={index}
        href={entryDetail("case-studies", entry.id)}
        title={`${entry.academicYear} • ${entry.yearOfStudy || "-"} • Semester ${entry.currentSemester ?? "-"}`}
        streakState={getEntryStreakDisplayState(entry)}
        badges={
          <>
            <EntryLockBadge deadlineState={deadlineState} />
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {getConfirmationStatusLabel(confirmationStatus)}
            </span>
          </>
        }
        subtitle={`${entry.placeOfVisit} • ${entry.yearOfStudy || "-"} • Semester ${entry.currentSemester ?? "-"}`}
        createdAt={entry.createdAt}
        updatedAt={entry.updatedAt}
        actions={
          <div className="flex items-center gap-2">
            <MiniButton onClick={() => router.push(entryDetail("case-studies", entry.id))}>
              View
            </MiniButton>
            {lockApproved ? (
              entry.pdfMeta?.url ? (
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
              )
            ) : (
              <>
                <MiniButton onClick={() => router.push(entryDetail("case-studies", entry.id))}>
                  Edit
                </MiniButton>
                <MiniButton
                  role="destructive"
                  onClick={() =>
                    requestConfirmation({
                      title: "Delete entry?",
                      description:
                        "This permanently deletes this case-study entry and its associated uploaded files.",
                      confirmLabel: "Delete",
                      cancelLabel: "Cancel",
                      variant: "destructive",
                      onConfirm: () => deleteEntry(entry.id),
                    })
                  }
                >
                  Delete Entry
                </MiniButton>
                {completedEntry ? (
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
            <RequestEditAction
              locked={lockApproved}
              status={entry.requestEditStatus}
              requestedAtISO={entry.requestEditRequestedAtISO}
              requesting={!!requestingEditIds[entry.id]}
              onRequest={() => void requestEdit(entry)}
              onCancel={() => void cancelRequestEdit(entry)}
            />
          </div>
        }
      >
        <div className="text-sm text-muted-foreground">
          Start: {formatDisplayDate(entry.startDate)} • End: {formatDisplayDate(entry.endDate)} • Days: {days ?? "-"}
        </div>
        <div className="text-sm text-muted-foreground">
          Staff Count: {entry.staffAccompanying.length}
          {entry.amountSupport !== null ? ` • Amount: ${entry.amountSupport}` : ""}
        </div>
        <div className="text-sm text-muted-foreground line-clamp-2">{entry.purposeOfVisit}</div>

        <div className="flex flex-wrap gap-3 text-sm">
          {entry.permissionLetter ? (
            <a className="underline" href={entry.permissionLetter.url} target="_blank" rel="noreferrer">
              Permission Letter
            </a>
          ) : null}
          {entry.travelPlan ? (
            <a className="underline" href={entry.travelPlan.url} target="_blank" rel="noreferrer">
              Travel Plan
            </a>
          ) : null}
          {entry.geotaggedPhotos.map((meta, photoIndex) => (
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
        category: "case-studies",
        mode: isViewMode ? "view" : showForm ? (activeEntryId ? "edit" : "new") : "preview",
        entry: showForm ? (form as Record<string, unknown>) : null,
        title: "Case Studies",
        subtitle:
          "Record case study visits with academic context, staff involvement, dates, and the required supporting documents.",
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
              router.push(entryNew("case-studies"), { scroll: false });
            }}
            addLabel="+ Add Case Study"
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
              title: isViewMode ? "Case Study Entry" : "New Case Study Entry",
              subtitle: "Add the entry details and generate the entry to unlock uploads.",
              content: (
                <>
                  {pendingCoreLocked ? (
                    <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Pending confirmation — core fields cannot be edited.
                    </p>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Academic Year" error={attemptedSectionSave ? errors.academicYear : undefined}>
                      <SelectDropdown
                        value={form.academicYear}
                        onChange={(value) => setForm((current) => ({ ...current, academicYear: value }))}
                        options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
                        placeholder="Select academic year"
                        disabled={coreFieldDisabled("academicYear")}
                        error={attemptedSectionSave && !!errors.academicYear}
                      />
                    </Field>

                    <Field
                      label="Starting Date"
                      error={attemptedSectionSave ? errors.startDate : undefined}
                      hint={form.academicYear ? getAcademicYearRange(form.academicYear)?.label : undefined}
                    >
                      <DateField
                        value={form.startDate}
                        onChange={(next) => setForm((current) => ({ ...current, startDate: next }))}
                        disabled={coreFieldDisabled("startDate")}
                        error={attemptedSectionSave && !!errors.startDate}
                      />
                    </Field>

                    <Field
                      label="Ending Date"
                      error={attemptedSectionSave ? errors.endDate : undefined}
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
                        error={attemptedSectionSave && !!errors.endDate}
                      />
                    </Field>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Place of Visit" error={attemptedSectionSave ? errors.placeOfVisit : undefined}>
                      <input
                        value={form.placeOfVisit}
                        onChange={(event) => setForm((current) => ({ ...current, placeOfVisit: event.target.value }))}
                        disabled={coreFieldDisabled("placeOfVisit")}
                        className={cx(
                          "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                          attemptedSectionSave && errors.placeOfVisit
                            ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                            : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                        )}
                      />
                    </Field>

                    <Field label="Purpose of Visit" error={attemptedSectionSave ? errors.purposeOfVisit : undefined}>
                      <textarea
                        value={form.purposeOfVisit}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, purposeOfVisit: event.target.value }))
                        }
                        rows={4}
                        disabled={coreFieldDisabled("purposeOfVisit")}
                        className={cx(
                          "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                          attemptedSectionSave && errors.purposeOfVisit
                            ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                            : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                        )}
                      />
                    </Field>

                    <Field label="Year of Study" error={attemptedSectionSave ? errors.yearOfStudy : undefined}>
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
                            }) as CaseStudyEntry;
                          })
                        }
                        options={YEAR_OF_STUDY_OPTIONS}
                        placeholder="Select year"
                        disabled={coreFieldDisabled("yearOfStudy")}
                        error={attemptedSectionSave && !!errors.yearOfStudy}
                      />
                    </Field>

                    <Field
                      label="Current Semester"
                      error={attemptedSectionSave ? errors.currentSemester : undefined}
                      hint={normalizedStudentYear ? "Select semester (based on year)" : "Select year of study first"}
                    >
                      <SelectDropdown
                        value={form.currentSemester === null ? "" : String(form.currentSemester)}
                        disabled={coreFieldDisabled("currentSemester") || !normalizedStudentYear}
                        onChange={(value) =>
                          setForm((current) =>
                            withAcademicProgressionCompatibility({
                              ...current,
                              currentSemester: value ? Number(value) : null,
                            }) as CaseStudyEntry
                          )
                        }
                        options={semesterOptions.map((option) => ({
                          label: String(option),
                          value: String(option),
                        }))}
                        placeholder={normalizedStudentYear ? "Select current semester" : "Select year of study first"}
                        error={attemptedSectionSave && !!errors.currentSemester}
                      />
                    </Field>

                    <Field
                      label="Amount of Support"
                      error={attemptedSectionSave ? errors.amountSupport : undefined}
                      hint="Optional. Digits only"
                    >
                      <CurrencyField
                        value={form.amountSupport === null ? "" : String(form.amountSupport)}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            amountSupport: value === "" ? null : Number(value),
                          }))
                        }
                        disabled={coreFieldDisabled("amountSupport")}
                        error={attemptedSectionSave && !!errors.amountSupport}
                        placeholder="Enter amount"
                      />
                    </Field>
                  </div>

                  <div className="mt-5 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Coordinator: <span className="font-medium text-foreground">{currentFaculty.name || "-"}</span>
                  </div>

                  <div className="mt-5">
                    <FacultyRowPicker
                      title="Staff Accompanying"
                      helperText="Add at least one staff member. Already selected faculty are disabled in other rows."
                      addLabel="+ Add Staff"
                      rowLabelPrefix="Staff"
                      rows={form.staffAccompanying}
                      onRowsChange={(rows) => setForm((current) => ({ ...current, staffAccompanying: rows }))}
                      onPersistRow={persistStaffRows}
                      facultyOptions={FACULTY_OPTIONS}
                      parentLocked={coreFieldDisabled("staffAccompanying")}
                      viewOnly={isViewMode}
                      sectionError={errors.staffAccompanying}
                      showSectionError={attemptedSectionSave}
                      emptyStateText="No staff added."
                      validateRow={(rows, row) => {
                        const tempEntry = {
                          ...form,
                          coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
                          staffAccompanying: rows,
                        };
                        return validateRowForFacultySave(tempEntry, row).error;
                      }}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Number of Participants" hint="Optional. Digits only">
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
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:border-ring/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                      />
                    </Field>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {!isViewMode ? (
                        <MiniButton onClick={() => void generateEntry()} disabled={actionState.generateDisabled}>
                          {saving ? "Generating..." : "Generate Entry"}
                        </MiniButton>
                      ) : null}
                      <EntryPdfActions
                        pdfMeta={form.pdfMeta ?? null}
                        disabled={isViewMode ? !form.pdfMeta?.url : !lifecycle.canPreview}
                      />
                    </div>
                    {pdfState.pdfStale ? (
                      <p className="text-sm text-muted-foreground">
                        Entry changed. Regenerate PDF to update Preview/Download.
                      </p>
                    ) : null}

                    {uploadsVisible ? (
                      <div className="grid gap-4 sm:grid-cols-3">
                        {SINGLE_UPLOAD_SLOTS.map(({ slot, label }) => (
                          <EntryUploader
                            key={slot}
                            title={label}
                            mode={isViewMode ? "view" : "edit"}
                            meta={form[slot]}
                            uploadEndpoint="/api/me/case-studies-file"
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
                              const latestForm = formRef.current;
                              const nextForm = { ...latestForm, [slot]: meta };
                              const persisted = hydrateEntry(await persistProgress(nextForm));
                              applyPersistedEntry(persisted);
                              await refreshList(email);
                            }}
                            onDeleted={async () => {
                              const latestForm = formRef.current;
                              const nextForm = { ...latestForm, [slot]: null };
                              const persisted = hydrateEntry(await persistProgress(nextForm));
                              applyPersistedEntry(persisted);
                              await refreshList(email);
                            }}
                          />
                        ))}

                        <MultiPhotoUpload
                          title="Geotagged Photos"
                          value={form.geotaggedPhotos}
                          onUploaded={async (meta) => {
                            const latestForm = formRef.current;
                            const nextForm = {
                              ...latestForm,
                              geotaggedPhotos: [...latestForm.geotaggedPhotos, meta],
                            };
                            const persisted = hydrateEntry(await persistProgress(nextForm));
                            applyPersistedEntry(persisted);
                            await refreshList(email);
                          }}
                          onDeleted={async (meta) => {
                            const latestForm = formRef.current;
                            const nextForm = {
                              ...latestForm,
                              geotaggedPhotos: latestForm.geotaggedPhotos.filter(
                                (item) => item.storedPath !== meta.storedPath
                              ),
                            };
                            const persisted = hydrateEntry(await persistProgress(nextForm));
                            applyPersistedEntry(persisted);
                            await refreshList(email);
                          }}
                          uploadEndpoint="/api/me/case-studies-file"
                          email={email}
                          recordId={form.id}
                          slotName="geotaggedPhotos"
                          disabled={controlsDisabled}
                          viewOnly={isViewMode}
                          showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
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
          ? {
              className: "bg-white/70 p-5",
              title: "Saved Case Study Entries",
              subtitle: "Your saved case study records are stored locally and keyed to your signed-in email.",
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

export default function CaseStudiesPageRoute() {
  return <CaseStudiesPage />;
}
