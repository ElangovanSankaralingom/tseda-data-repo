"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import DateField from "@/components/controls/DateField";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import EntryCategoryMarker from "@/components/entry/EntryCategoryMarker";
import AutoSaveIndicator from "@/components/entry/AutoSaveIndicator";
import { getEntryListCardClass } from "@/components/entry/entryCardStyles";
import EntryLockBadge from "@/components/entry/EntryLockBadge";
import EntryShell from "@/components/entry/EntryShell";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import RequestEditAction from "@/components/entry/RequestEditAction";
import MultiPhotoUpload from "@/components/entry/UploadFieldMulti";
import EntryUploader from "@/components/upload/EntryUploader";
import { ActionButton } from "@/components/ui/ActionButton";
import { SaveButton } from "@/components/ui/SaveButton";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { useEntryConfirmation } from "@/hooks/useEntryConfirmation";
import { useCommitDraft } from "@/hooks/useCommitDraft";
import { useGenerateEntry } from "@/hooks/useGenerateEntry";
import { useRequestEdit } from "@/hooks/useRequestEdit";
import { useEntryWorkflow } from "@/hooks/useEntryWorkflow";
import { useEntryViewMode } from "@/hooks/useEntryViewMode";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
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
} from "@/lib/entries/lifecycle";
import { groupEntries } from "@/lib/entryCategorization";
import { entryDetail, entryList, entryNew } from "@/lib/navigation";
import { nowISTTimestampISO } from "@/lib/gamification";
import { computePdfState, hashPrePdfFields, hydratePdfSnapshot } from "@/lib/pdfSnapshot";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeStudentYear,
  STUDENT_YEAR_OPTIONS,
  type StudentYear,
} from "@/lib/student-academic";
import { canEditField } from "@/lib/pendingImmutability";
import {
  createOptimisticSnapshot,
  optimisticRemove,
  optimisticUpsert,
} from "@/lib/ui/optimistic";
import { ok } from "@/lib/result";

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
  | "speakerProfile";
type UploadStatus = { hasPending: boolean; busy: boolean };

type GuestLectureEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "coCoordinator";
  status?: "draft" | "final";
  confirmationStatus?: "DRAFT" | "PENDING_CONFIRMATION" | "APPROVED" | "REJECTED";
  requestEditStatus?: "none" | "pending" | "approved" | "rejected";
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  semesterType: "Odd" | "Even" | "";
  startDate: string;
  endDate: string;
  eventName: string;
  speakerName: string;
  organizationName: string;
  coordinator: FacultyRowValue;
  coCoordinators: FacultyRowValue[];
  studentYear: StudentYear | "";
  semesterNumber: number | null;
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

const SEMESTER_TYPE_OPTIONS = [
  { value: "Odd", label: "Odd Semester" },
  { value: "Even", label: "Even Semester" },
] as const;

const UPLOAD_CONFIG: Array<{ slot: UploadSlot; label: string }> = [
  { slot: "permissionLetter", label: "Permission Letter" },
  { slot: "brochure", label: "Brochure" },
  { slot: "attendance", label: "Attendance" },
  { slot: "speakerProfile", label: "Speaker Profile" },
];
const EMPTY_UPLOAD_STATUS: Record<UploadSlot, UploadStatus> = {
  permissionLetter: { hasPending: false, busy: false },
  brochure: { hasPending: false, busy: false },
  attendance: { hasPending: false, busy: false },
  speakerProfile: { hasPending: false, busy: false },
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
    speakerProfile: null,
  };
}

function emptyFacultySelection(): FacultyRowValue {
  return { id: uuid(), name: "", email: "", isLocked: false, savedAtISO: null };
}

function formatFacultyDisplay(selection: FacultyRowValue) {
  return selection.name || selection.email || "";
}

function createEmptyForm(currentFaculty?: FacultyRowValue): GuestLectureEntry {
  return {
    id: uuid(),
    status: "draft",
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    academicYear: "",
    semesterType: "",
    startDate: "",
    endDate: "",
    eventName: "",
    speakerName: "",
    organizationName: "",
    coordinator: currentFaculty?.email ? currentFaculty : emptyFacultySelection(),
    coCoordinators: [],
    studentYear: "",
    semesterNumber: null,
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
  };
}

function hydrateEntry(entry: GuestLectureEntry): GuestLectureEntry {
  return hydratePdfSnapshot(entry, "guest-lectures") as GuestLectureEntry;
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

type GuestLecturesPageProps = {
  viewEntryId?: string;
  editEntryId?: string;
  startInNewMode?: boolean;
};

export function GuestLecturesPage({
  viewEntryId,
  editEntryId,
  startInNewMode = false,
}: GuestLecturesPageProps = {}) {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const router = useRouter();
  const categoryPath = entryList("guest-lectures");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(startInNewMode);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<FacultyRowValue>(emptyFacultySelection);
  const [list, setList] = useState<GuestLectureEntry[]>([]);
  const [form, setForm] = useState<GuestLectureEntry>(() => createEmptyForm());
  const [lastPersistedSnapshot, setLastPersistedSnapshot] = useState(() => stableStringify(createEmptyForm()));
  const [singleUploadStatus, setSingleUploadStatus] =
    useState<Record<UploadSlot, UploadStatus>>(EMPTY_UPLOAD_STATUS);
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });
  const saveLockRef = useRef(false);
  const seededViewEntryIdRef = useRef<string | null>(null);
  const activeEntryId = editEntryId?.trim() || viewEntryId?.trim() || "";
  const { isPreviewMode: isViewMode, backHref, backDisabled } = useEntryViewMode(
    categoryPath,
    viewEntryId
  );
  const viewedEntry = useMemo(
    () => (activeEntryId ? list.find((item) => item.id === activeEntryId) ?? null : null),
    [activeEntryId, list]
  );
  const groupedEntries = useMemo(() => groupEntries(list), [list]);

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

        const listResponse = await fetch(`/api/me/guest-lectures?email=${encodeURIComponent(nextEmail)}`, {
          cache: "no-store",
        });
        const items = await listResponse.json();

        if (!listResponse.ok) {
          throw new Error(items?.error || "Failed to load Guest Lectures records.");
        }

        setList(Array.isArray(items) ? (items as GuestLectureEntry[]).map((entry) => hydrateEntry(entry)) : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  function applyPersistedEntry(nextEntry: GuestLectureEntry) {
    setForm(nextEntry);
    setLastPersistedSnapshot(stableStringify(nextEntry));
    markAutoSaveSaved(nextEntry);
  }

  const errors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (!ACADEMIC_YEAR_OPTIONS.includes(form.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
      nextErrors.academicYear = "Academic year is required.";
    }

    if (!SEMESTER_TYPE_OPTIONS.some((option) => option.value === form.semesterType)) {
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

    if (!form.eventName.trim()) {
      nextErrors.eventName = "Event name is required.";
    }

    if (!form.speakerName.trim()) {
      nextErrors.speakerName = "Speaker name is required.";
    }

    if (!form.organizationName.trim()) {
      nextErrors.organizationName = "Organization name is required.";
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

    const normalizedYear = normalizeStudentYear(form.studentYear);
    if (!normalizedYear) {
      nextErrors.studentYear = "Student year is required.";
    }

    if (normalizedYear && !isSemesterAllowed(normalizedYear, form.semesterNumber ?? undefined)) {
      nextErrors.semesterNumber = "Semester is required.";
    }

    if (form.participants === null) {
      nextErrors.participants = "Number of participants is required.";
    } else if (!Number.isFinite(form.participants) || form.participants <= 0) {
      nextErrors.participants = "Participants must be greater than 0.";
    }

    return nextErrors;
  }, [form, currentFaculty.email]);

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const normalizedStudentYear = normalizeStudentYear(form.studentYear);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const entryLocked = isEntryLockedFromStatus(form);
  const controlsDisabled = isViewMode || entryLocked;
  const pendingCoreLocked = getEntryApprovalStatus(form) === "PENDING_CONFIRMATION";
  const coreFieldDisabled = (fieldKey: string) =>
    controlsDisabled || !canEditField(form, "guest-lectures", fieldKey);
  const hasBusyUploads =
    Object.values(singleUploadStatus).some((status) => status.busy) || photoUploadStatus.busy;
  const formDirty = stableStringify(form) !== lastPersistedSnapshot;
  const generateReady = validatePreUploadFields("guest-lectures", form as Record<string, unknown>);
  const uploadsVisible = !!form.pdfMeta;
  const requiredUploadsComplete =
    !!form.uploads.permissionLetter &&
    !!form.uploads.brochure &&
    !!form.uploads.attendance &&
    !!form.uploads.speakerProfile &&
    form.uploads.geotaggedPhotos.length > 0;
  const pdfHash = useMemo(() => hashPrePdfFields(form, "guest-lectures"), [form]);
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
  const workflow = useEntryWorkflow({
    isLocked: entryLocked,
    coreValid: generateReady,
    hasPdfSnapshot: uploadsVisible,
    pdfStale: pdfState.pdfStale,
    completionValid: requiredUploadsComplete,
    fieldDirty: formDirty,
  });
  const lifecycle = workflow.lifecycle;
  const generateEntrySnapshot = useGenerateEntry<GuestLectureEntry>({
    category: "guest-lectures",
    email,
    hydrateEntry,
  });
  const commitDraftEntry = useCommitDraft<GuestLectureEntry>({
    category: "guest-lectures",
    hydrateEntry,
  });
  const showForm = formOpen || (!!activeEntryId && (!isViewMode || !!viewedEntry));
  const {
    status: autoSaveStatus,
    markSaved: markAutoSaveSaved,
  } = useAutoSave<GuestLectureEntry>({
    enabled: showForm && !isViewMode && !entryLocked && !saving && !hasBusyUploads && lifecycle.canSave,
    value: form,
    debounceMs: 15000,
    onSave: async () => {
      if (saveLockRef.current || hasBusyUploads || saving) return null;
      const persisted = await saveDraftChanges({
        intent: "save",
        source: "autosave",
        throwOnError: true,
      });
      if (!persisted) return null;
      return ok(persisted);
    },
  });
  useEffect(() => {
    if (stableStringify(form) === lastPersistedSnapshot) {
      markAutoSaveSaved(form);
    }
  }, [form, lastPersistedSnapshot, markAutoSaveSaved]);
  const { hasUnsavedChanges, confirmNavigate } = useUnsavedChangesGuard({
    enabled: showForm && !isViewMode && !entryLocked,
    isDirty: formDirty,
    isSaving: saving || hasBusyUploads || autoSaveStatus.phase === "saving",
  });

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

  function resetForm() {
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextForm = createEmptyForm(currentFaculty);
    setForm(nextForm);
    setLastPersistedSnapshot(stableStringify(nextForm));
    setSingleUploadStatus({ ...EMPTY_UPLOAD_STATUS });
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }

  async function persistProgress(nextForm: GuestLectureEntry) {
    const response = await fetch("/api/me/guest-lectures", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, entry: nextForm }),
    });
    const { message, payload } = await parseApiError(response, "Save failed");

    if (!response.ok) {
      throw new Error(message);
    }

    return payload as GuestLectureEntry;
  }

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/guest-lectures-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function cleanupDraftUploads(entry: GuestLectureEntry) {
    const metas = [
      entry.uploads.permissionLetter,
      entry.uploads.brochure,
      entry.uploads.attendance,
      entry.uploads.speakerProfile,
      ...entry.uploads.geotaggedPhotos,
    ].filter((meta): meta is FileMeta => !!meta?.storedPath);
    await Promise.all(metas.map((meta) => deleteStoredFile(meta.storedPath)));
  }

  async function closeForm(targetHref = categoryPath) {
    if (
      !form.pdfMeta &&
      (
        form.uploads.permissionLetter ||
        form.uploads.brochure ||
        form.uploads.attendance ||
        form.uploads.speakerProfile ||
        form.uploads.geotaggedPhotos.length > 0
      )
    ) {
      await cleanupDraftUploads(form);
    }
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
    const canLeave = await confirmNavigate();
    if (!canLeave) return;
    await closeForm(targetHref);
  }

  async function refreshList(nextEmail = email) {
    const response = await fetch(`/api/me/guest-lectures?email=${encodeURIComponent(nextEmail)}`, {
      cache: "no-store",
    });
    const items = await response.json();

    if (!response.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    setList(Array.isArray(items) ? (items as GuestLectureEntry[]).map((entry) => hydrateEntry(entry)) : []);
  }

  async function saveDraftChanges(options?: {
    closeAfterSave?: boolean;
    intent?: "save" | "done";
    source?: "manual" | "autosave";
    throwOnError?: boolean;
  }): Promise<GuestLectureEntry | null> {
    const intent = options?.intent ?? "save";
    const source = options?.source ?? "manual";
    const showToast = source !== "autosave";
    if (saveLockRef.current) return null;
    if (intent === "save" && !lifecycle.canSave) return null;
    if (intent === "done" && !lifecycle.canDone) return null;
    saveLockRef.current = true;
    let rollbackSnapshot: GuestLectureEntry[] | null = null;
    let lastPersistedEntry: GuestLectureEntry | null = null;

    try {
      if (hasBusyUploads) {
        if (showToast) {
          setToast({ type: "err", msg: "Please wait for uploads to finish before saving." });
          setTimeout(() => setToast(null), 1800);
        }
        return null;
      }

      setSaving(true);
      const entryToSave: GuestLectureEntry = {
        ...form,
        status: form.status === "final" ? "final" : "draft",
        coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
      };
      const optimisticEntry = hydrateEntry({
        ...entryToSave,
        updatedAt: new Date().toISOString(),
      });
      setList((current) => {
        rollbackSnapshot = createOptimisticSnapshot(current);
        return optimisticUpsert(current, optimisticEntry);
      });
      const persisted = hydrateEntry(await persistProgress(entryToSave));
      lastPersistedEntry = persisted;
      setList((current) => optimisticUpsert(current, persisted));

      const finalEntry: GuestLectureEntry =
        intent === "done" ? await commitDraftEntry(String(persisted.id)) : persisted;
      if (intent === "done") {
        lastPersistedEntry = finalEntry;
        setList((current) => optimisticUpsert<GuestLectureEntry>(current, finalEntry));
      }

      applyPersistedEntry(finalEntry);
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      void refreshList(email);
      if (showToast) {
        setToast({ type: "ok", msg: intent === "done" ? "Draft committed." : "Saved" });
        setTimeout(() => setToast(null), 1400);
      }
      if (options?.closeAfterSave) {
        closeForm();
      }
      return finalEntry;
    } catch (error) {
      const persistedEntry = lastPersistedEntry;
      if (persistedEntry) {
        setList((current) => optimisticUpsert<GuestLectureEntry>(current, persistedEntry));
      } else if (rollbackSnapshot) {
        setList(rollbackSnapshot);
      }
      if (showToast) {
        const message = error instanceof Error ? error.message : "Save failed.";
        setToast({ type: "err", msg: message });
        setTimeout(() => setToast(null), 1800);
      }
      if (options?.throwOnError) {
        throw error;
      }
      return null;
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  async function handleDone() {
    setSubmitAttemptedFinal(true);

    if (hasBusyUploads) {
      setToast({ type: "err", msg: "Finish the current uploads before continuing." });
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

  async function persistCoCoordinatorRows(nextRows: FacultyRowValue[]) {
    if (saveLockRef.current) {
      throw new Error("Please wait for the current save to finish.");
    }

    saveLockRef.current = true;

    try {
      const persisted = hydrateEntry(await persistProgress({
        ...form,
        coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
        coCoordinators: nextRows,
      }));
      applyPersistedEntry(persisted);
      return persisted.coCoordinators;
    } finally {
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
        setToast({ type: "err", msg: "Finish the current uploads before generating the entry." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      const draftEntry: GuestLectureEntry = {
        ...form,
        status: form.status === "final" ? "final" : "draft",
        coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
      };
      const { entry: nextEntry } = await generateEntrySnapshot(draftEntry, persistProgress);

      setForm(nextEntry);
      setLastPersistedSnapshot(stableStringify(nextEntry));
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      await refreshList(email);
      setToast({ type: "ok", msg: "Entry generated." });
      setTimeout(() => setToast(null), 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generate failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  async function deleteEntry(id: string) {
    let rollbackSnapshot: GuestLectureEntry[] | null = null;
    setList((current) => {
      rollbackSnapshot = createOptimisticSnapshot(current);
      return optimisticRemove(current, id);
    });

    try {
      const response = await fetch("/api/me/guest-lectures", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, id }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }

      setList((current) => optimisticRemove(current, id));
      void refreshList(email);
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

  const { requestingIds: requestingEditIds, requestEdit, cancelRequestEdit } = useRequestEdit<GuestLectureEntry>({
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
  const { sendingIds: sendingConfirmationIds, sendForConfirmation } = useEntryConfirmation<GuestLectureEntry>({
    category: "guest-lectures",
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

  function formatEntryTimestamp(value?: string) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }

  function renderSavedEntry(entry: GuestLectureEntry, category: EntryDisplayCategory, index: number) {
    const deadlineState = getStreakDeadlineState(entry);
    const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
    const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
    const showUpdated =
      !Number.isNaN(createdTime) &&
      !Number.isNaN(updatedTime) &&
      Math.abs(updatedTime - createdTime) > 60 * 1000;
    const completedEntry = entry.status === "final";
    const confirmationStatus = getEntryApprovalStatus(entry);
    const lockApproved = isEntryLockedFromStatus(entry);
    const canSendConfirmation = canSendForConfirmation(entry);
    const sendingConfirmation = !!sendingConfirmationIds[entry.id];
    const days = getInclusiveDays(entry.startDate, entry.endDate);

    return (
      <div key={entry.id} className={getEntryListCardClass(category)}>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <EntryCategoryMarker
                  category={category}
                  index={index}
                  streakState={getEntryStreakDisplayState(entry)}
                />
                <Link href={entryDetail("guest-lectures", entry.id)} className="text-base font-semibold hover:opacity-80">
                  {entry.eventName}
                </Link>
                <EntryLockBadge deadlineState={deadlineState} />
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {getConfirmationStatusLabel(confirmationStatus)}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Speaker: {entry.speakerName} • {entry.organizationName}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <MiniButton onClick={() => router.push(entryDetail("guest-lectures", entry.id))}>
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
                    <MiniButton onClick={() => router.push(entryDetail("guest-lectures", entry.id))}>
                      Edit
                    </MiniButton>
                    <MiniButton
                      role="destructive"
                      onClick={() =>
                        requestConfirmation({
                          title: "Delete entry?",
                          description:
                            "This permanently deletes this guest-lecture entry and its associated uploaded files.",
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
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {entry.academicYear} • {entry.semesterType} Semester
          </div>
          <div className="text-sm text-muted-foreground">
            Start: {formatDisplayDate(entry.startDate)} • End: {formatDisplayDate(entry.endDate)} • Days: {days ?? "-"}
          </div>
          <div className="text-sm text-muted-foreground">
            Coordinator: {formatFacultyDisplay(entry.coordinator)}
            {entry.coCoordinators.length > 0
              ? ` • Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`
              : ""}
          </div>
          <div className="text-sm text-muted-foreground">
            {entry.studentYear || "-"} • Semester {entry.semesterNumber ?? "-"} • Participants: {entry.participants ?? "-"}
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
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
        </div>
      </div>
    );
  }

  return (
    <EntryShell
      category="guest-lectures"
      mode={isViewMode ? "view" : showForm ? (activeEntryId ? "edit" : "new") : "preview"}
      entry={showForm ? (form as Record<string, unknown>) : null}
      title="Guest Lectures"
      subtitle="Record event details, student participation, and the required supporting documents."
      status={showForm ? getEntryApprovalStatus(form) : undefined}
      meta={showForm && !isViewMode ? <AutoSaveIndicator status={autoSaveStatus} /> : null}
      showUnsavedChanges={showForm && !isViewMode && hasUnsavedChanges}
      backHref={backHref}
      backDisabled={backDisabled}
      onBack={showForm || isViewMode ? () => handleCancel(categoryPath) : undefined}
      actions={
        showForm && !isViewMode ? (
          <>
            <MiniButton
              role="context"
              onClick={() => void handleCancel()}
              disabled={controlsDisabled || saving || loading || hasBusyUploads}
            >
              Cancel
            </MiniButton>
            <SaveButton
              onClick={() => void saveDraftChanges()}
              disabled={controlsDisabled || saving || loading || hasBusyUploads || !lifecycle.canSave}
            >
              {saving ? "Saving..." : "Save"}
            </SaveButton>
            <MiniButton
              onClick={() => void handleDone()}
              disabled={controlsDisabled || saving || loading || hasBusyUploads || !lifecycle.canDone}
            >
              {saving ? "Saving..." : "Done"}
            </MiniButton>
          </>
        ) : !isViewMode ? (
          <MiniButton
            onClick={() => {
              resetForm();
              router.push(entryNew("guest-lectures"), { scroll: false });
            }}
            disabled={loading}
          >
            + Add Guest Lecture
          </MiniButton>
        ) : null
      }
    >

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
            title={isViewMode ? "Guest Lecture Entry" : "New Guest Lecture Entry"}
            subtitle="Add the entry details and generate the entry to unlock uploads."
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

              <Field label="Type of Semester" error={submitted ? errors.semesterType : undefined}>
                <SelectDropdown
                  value={form.semesterType}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      semesterType: value as GuestLectureEntry["semesterType"],
                    }))
                  }
                  options={SEMESTER_TYPE_OPTIONS}
                  placeholder="Select semester type"
                  disabled={coreFieldDisabled("semesterType")}
                  error={submitted && !!errors.semesterType}
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
                hint={inclusiveDays ? `Number of Days: ${inclusiveDays}` : "Number of Days will be calculated automatically."}
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
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.eventName
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>

              <Field label="Name of the Speaker" error={submitted ? errors.speakerName : undefined}>
                <input
                  value={form.speakerName}
                  onChange={(event) => setForm((current) => ({ ...current, speakerName: event.target.value }))}
                  disabled={coreFieldDisabled("speakerName")}
                  className={cx(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.speakerName
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>

              <Field label="Name of the Organization" error={submitted ? errors.organizationName : undefined}>
                <input
                  value={form.organizationName}
                  onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))}
                  disabled={coreFieldDisabled("organizationName")}
                  className={cx(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.organizationName
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>

            </div>

            <div className="mt-5 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Coordinator: <span className="font-medium text-foreground">{currentFaculty.name || form.coordinator.name || "-"}</span>
            </div>

            <div className="mt-5">
              <FacultyRowPicker
                title="Co-coordinator(s)"
                helperText="Add co-coordinators only when applicable."
                addLabel="+ Add Co-coordinator"
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
                      itemIndex !== index && item.email.trim().toLowerCase() === row.email.trim().toLowerCase()
                  ).length;
                  return duplicates > 0 ? "This faculty is already selected in another role." : null;
                }}
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">

              <Field label="Student Year" error={submitted ? errors.studentYear : undefined}>
                <SelectDropdown
                  value={form.studentYear}
                  onChange={(value) =>
                    setForm((current) => {
                      const nextYear = normalizeStudentYear(value) ?? "";
                      const nextSemester = isSemesterAllowed(nextYear || undefined, current.semesterNumber ?? undefined)
                        ? current.semesterNumber
                        : null;

                      return {
                        ...current,
                        studentYear: nextYear,
                        semesterNumber: nextSemester,
                      };
                    })
                  }
                  options={STUDENT_YEAR_OPTIONS}
                  placeholder="Select year"
                  disabled={coreFieldDisabled("studentYear")}
                  error={submitted && !!errors.studentYear}
                />
              </Field>

              <Field
                label="Semester"
                error={submitted ? errors.semesterNumber : undefined}
                hint={normalizedStudentYear ? "Select semester (based on year)" : "Select student year first"}
              >
                <SelectDropdown
                  value={form.semesterNumber === null ? "" : String(form.semesterNumber)}
                  disabled={coreFieldDisabled("semesterNumber") || !normalizedStudentYear}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      semesterNumber: value ? Number(value) : null,
                    }))
                  }
                  options={semesterOptions.map((option) => ({
                    label: String(option),
                    value: String(option),
                  }))}
                  placeholder={normalizedStudentYear ? "Select semester (based on year)" : "Select student year first"}
                  error={submitted && !!errors.semesterNumber}
                />
              </Field>

              <Field label="Number of Participants" error={submitted ? errors.participants : undefined} hint="Digits only">
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
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.participants
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {!isViewMode ? (
                  <MiniButton
                    onClick={() => void generateEntry()}
                    disabled={controlsDisabled || saving || loading || hasBusyUploads || !lifecycle.canGenerate}
                  >
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {UPLOAD_CONFIG.map(({ slot, label }) => (
                    <EntryUploader
                      key={slot}
                      title={label}
                      mode={isViewMode ? "view" : "edit"}
                      meta={form.uploads[slot]}
                      uploadEndpoint="/api/me/guest-lectures-file"
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
                        const nextForm = {
                          ...form,
                          uploads: {
                            ...form.uploads,
                            [slot]: meta,
                          },
                        };
                        const persisted = hydrateEntry(await persistProgress(nextForm));
                        applyPersistedEntry(persisted);
                        await refreshList(email);
                      }}
                      onDeleted={async () => {
                        const nextForm = {
                          ...form,
                          uploads: {
                            ...form.uploads,
                            [slot]: null,
                          },
                        };
                        const persisted = hydrateEntry(await persistProgress(nextForm));
                        applyPersistedEntry(persisted);
                        await refreshList(email);
                      }}
                    />
                  ))}

              <MultiPhotoUpload
                title="Geotagged Photos"
                value={form.uploads.geotaggedPhotos}
                onUploaded={async (meta) => {
                  const nextForm = {
                    ...form,
                    uploads: {
                      ...form.uploads,
                      geotaggedPhotos: [...form.uploads.geotaggedPhotos, meta],
                    },
                  };
                  const persisted = hydrateEntry(await persistProgress(nextForm));
                  applyPersistedEntry(persisted);
                  await refreshList(email);
                }}
                onDeleted={async (meta) => {
                  const nextForm = {
                    ...form,
                    uploads: {
                      ...form.uploads,
                      geotaggedPhotos: form.uploads.geotaggedPhotos.filter(
                        (item) => item.storedPath !== meta.storedPath
                      ),
                    },
                  };
                  const persisted = hydrateEntry(await persistProgress(nextForm));
                  applyPersistedEntry(persisted);
                  await refreshList(email);
                }}
                uploadEndpoint="/api/me/guest-lectures-file"
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
          </SectionCard>
        ) : null}

        {!loading && !showForm ? (
          <SectionCard
            title="Saved Guest Lecture Entries"
            subtitle="Your saved guest lecture records are stored locally and keyed to your signed-in email."
          >
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              <div className="space-y-3">
                {groupedEntries.draft.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Drafts</div>
                    {groupedEntries.draft.map((entry, index) => renderSavedEntry(entry, "draft", index))}
                  </div>
                ) : null}
                {groupedEntries.activated.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Streak Activated</div>
                    {groupedEntries.activated.map((entry, index) => renderSavedEntry(entry, "streak_active", index))}
                  </div>
                ) : null}
                {groupedEntries.completed.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Completed</div>
                    {groupedEntries.completed.map((entry, index) => renderSavedEntry(entry, "completed", index))}
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
      {confirmationDialog}
    </EntryShell>
  );
}

export default function GuestLecturesPageRoute() {
  return <GuestLecturesPage />;
}
