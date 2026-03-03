"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import CurrencyField from "@/components/controls/CurrencyField";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import DateField from "@/components/controls/DateField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/faculty/FacultyRowPicker";
import MultiPhotoUpload from "@/components/uploads/MultiPhotoUpload";
import { FACULTY } from "@/lib/facultyDirectory";
import { isEntryLockedState, nowISTTimestampISO } from "@/lib/gamification";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeStudentYear,
  STUDENT_YEAR_OPTIONS,
  type StudentYear,
} from "@/lib/student-academic";

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

type CaseStudyEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "staffAccompanying";
  status?: "draft" | "final";
  requestEditStatus?: "none" | "pending" | "approved" | "rejected";
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  semesterType: "Odd" | "Even" | "";
  startDate: string;
  endDate: string;
  coordinator: FacultyRowValue;
  placeOfVisit: string;
  purposeOfVisit: string;
  staffAccompanying: StaffSelection[];
  studentYear: StudentYear | "";
  semesterNumber: number | null;
  participants: number | null;
  amountSupport: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
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

const SEMESTER_TYPE_OPTIONS = [
  { value: "Odd", label: "Odd Semester" },
  { value: "Even", label: "Even Semester" },
] as const;

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
  return {
    id: uuid(),
    status: "draft",
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    academicYear: "",
    semesterType: "",
    startDate: "",
    endDate: "",
    coordinator: currentFaculty?.email ? currentFaculty : emptyStaff(),
    placeOfVisit: "",
    purposeOfVisit: "",
    staffAccompanying: [],
    studentYear: "",
    semesterNumber: null,
    participants: null,
    amountSupport: null,
    pdfMeta: null,
    permissionLetter: null,
    travelPlan: null,
    geotaggedPhotos: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  };
}

function isEntryLocked(entry: CaseStudyEntry) {
  if (entry.requestEditStatus === "approved") {
    return false;
  }

  return isEntryLockedState(entry);
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

function MiniButton({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const base = "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm";
  const activeCls =
    variant === "danger"
      ? "border-border text-red-600 transition hover:bg-red-50"
      : variant === "ghost"
      ? "border-border transition hover:bg-muted"
      : "border-foreground bg-foreground text-background transition hover:opacity-90";
  const disabledCls =
    variant === "default"
      ? "border-border bg-muted text-muted-foreground pointer-events-none cursor-not-allowed opacity-60"
      : "border-border bg-transparent text-muted-foreground pointer-events-none cursor-not-allowed opacity-60";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, disabled ? disabledCls : activeCls)}
    >
      {children}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-muted">
      <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
    </div>
  );
}

function uploadCaseStudiesFileXHR(opts: {
  email: string;
  recordId: string;
  slot: UploadSlot;
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { email, recordId, slot, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/case-studies-file", true);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => reject(new Error("Upload failed (network)."));

    xhr.onload = () => {
      try {
        const isJSON = (xhr.getResponseHeader("content-type") || "").includes("application/json");
        const data = isJSON ? JSON.parse(xhr.responseText || "{}") : {};

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as FileMeta);
        } else {
          reject(new Error(data?.error || `Upload failed (${xhr.status}).`));
        }
      } catch {
        reject(new Error("Upload failed (bad response)."));
      }
    };

    const body = new FormData();
    body.set("email", email);
    body.set("recordId", recordId);
    body.set("slot", slot);
    body.set("file", file);
    xhr.send(body);
  });
}

type CaseStudiesPageProps = {
  viewEntryId?: string;
};

export function CaseStudiesPage({ viewEntryId }: CaseStudiesPageProps = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [attemptedSectionSave, setAttemptedSectionSave] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<FacultyRowValue>(emptyStaff);
  const [list, setList] = useState<CaseStudyEntry[]>([]);
  const [requestingEditIds, setRequestingEditIds] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<CaseStudyEntry>(() => emptyForm());
  const [lastPersistedSnapshot, setLastPersistedSnapshot] = useState(() => stableStringify(emptyForm()));
  const [pending, setPending] = useState<Record<UploadSlot, File | null>>({
    permissionLetter: null,
    travelPlan: null,
  });
  const [busy, setBusy] = useState<Record<UploadSlot, boolean>>({
    permissionLetter: false,
    travelPlan: false,
  });
  const [progress, setProgress] = useState<Record<UploadSlot, number>>({
    permissionLetter: 0,
    travelPlan: 0,
  });
  const [uploadError, setUploadError] = useState<Record<UploadSlot, string | null>>({
    permissionLetter: null,
    travelPlan: null,
  });
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });
  const saveLockRef = useRef(false);
  const isViewMode = !!viewEntryId;
  const viewedEntry = useMemo(
    () => (viewEntryId ? list.find((item) => item.id === viewEntryId) ?? null : null),
    [list, viewEntryId]
  );

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

        setList(Array.isArray(items) ? (items as CaseStudyEntry[]) : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load.";
        setToast({ type: "err", msg: message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!viewedEntry) return;

    setForm(viewedEntry);
    setLastPersistedSnapshot(stableStringify(viewedEntry));
    setAttemptedSectionSave(false);
    setSubmitAttemptedFinal(false);
    setPending({
      permissionLetter: null,
      travelPlan: null,
    });
    setBusy({
      permissionLetter: false,
      travelPlan: false,
    });
    setProgress({
      permissionLetter: 0,
      travelPlan: 0,
    });
    setUploadError({
      permissionLetter: null,
      travelPlan: null,
    });
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }, [viewedEntry]);

  function buildEntryErrors(entry: CaseStudyEntry) {
    const nextErrors: Record<string, string> = {};

    if (!ACADEMIC_YEAR_OPTIONS.includes(entry.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
      nextErrors.academicYear = "Academic year is required.";
    }

    if (!SEMESTER_TYPE_OPTIONS.some((option) => option.value === entry.semesterType)) {
      nextErrors.semesterType = "Semester type is required.";
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

    const normalizedStudentYear = normalizeStudentYear(entry.studentYear);
    if (!normalizedStudentYear) {
      nextErrors.studentYear = "Year is required.";
    }

    if (normalizedStudentYear && !isSemesterAllowed(normalizedStudentYear, entry.semesterNumber ?? undefined)) {
      nextErrors.semesterNumber = "Semester is required.";
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
  const normalizedStudentYear = normalizeStudentYear(form.studentYear);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const hasPendingFiles = Object.values(pending).some(Boolean) || photoUploadStatus.hasPending;
  const hasBusyUploads = Object.values(busy).some(Boolean) || photoUploadStatus.busy;
  const formDirty = stableStringify(form) !== lastPersistedSnapshot;
  const generateReady =
    !!form.academicYear &&
    !!form.semesterType &&
    isISODate(form.startDate) &&
    isISODate(form.endDate) &&
    form.endDate >= form.startDate &&
    !!form.placeOfVisit.trim() &&
    !!form.purposeOfVisit.trim() &&
    form.staffAccompanying.length > 0 &&
    !form.staffAccompanying.some((staff) => !staff.isLocked || !staff.email.trim());
  const uploadsVisible = !!form.pdfMeta;
  const requiredUploadsComplete = !!form.permissionLetter && !!form.travelPlan && form.geotaggedPhotos.length > 0;
  const isComplete = uploadsVisible && generateReady && requiredUploadsComplete;
  const isDirty = formDirty || hasPendingFiles;
  const showForm = formOpen || (isViewMode && !!viewedEntry);
  const isLocked = !!form.createdAt && isEntryLocked(form);
  const controlsDisabled = isViewMode || isLocked;

  function resetForm() {
    setAttemptedSectionSave(false);
    setSubmitAttemptedFinal(false);
    const nextForm = emptyForm(currentFaculty);
    setForm(nextForm);
    setLastPersistedSnapshot(stableStringify(nextForm));
    setPending({
      permissionLetter: null,
      travelPlan: null,
    });
    setBusy({
      permissionLetter: false,
      travelPlan: false,
    });
    setProgress({
      permissionLetter: 0,
      travelPlan: 0,
    });
    setUploadError({
      permissionLetter: null,
      travelPlan: null,
    });
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

  async function closeForm() {
    if (!form.pdfMeta && (form.permissionLetter || form.travelPlan || form.geotaggedPhotos.length > 0)) {
      await cleanupDraftUploads(form);
    }
    resetForm();
    setFormOpen(false);
  }

  async function refreshList(nextEmail = email) {
    const response = await fetch(`/api/me/case-studies?email=${encodeURIComponent(nextEmail)}`, {
      cache: "no-store",
    });
    const items = await response.json();

    if (!response.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    setList(Array.isArray(items) ? (items as CaseStudyEntry[]) : []);
  }

  async function persistProgress(nextForm: CaseStudyEntry) {
    const response = await fetch("/api/me/case-studies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, entry: nextForm }),
    });
    const { message, payload } = await parseApiError(response, "Save failed");

    if (!response.ok) {
      throw new Error(message);
    }

    return payload as CaseStudyEntry;
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

  async function uploadSlot(slot: UploadSlot) {
    const currentForm = form;
    const file = pending[slot];
    if (!file) {
      setUploadError((current) => ({ ...current, [slot]: "Select a file first." }));
      return;
    }

    const allowed = file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg";
    if (!allowed) {
      setUploadError((current) => ({ ...current, [slot]: "Only PDF/JPG/PNG allowed." }));
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError((current) => ({ ...current, [slot]: "Max file size is 20MB." }));
      return;
    }

    const previousMeta = form[slot];

    try {
      setUploadError((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: true }));
      setProgress((current) => ({ ...current, [slot]: 0 }));

      const meta = await uploadCaseStudiesFileXHR({
        email,
        recordId: form.id,
        slot,
        file,
        onProgress: (pct) => setProgress((current) => ({ ...current, [slot]: pct })),
      });

      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void deleteStoredFile(previousMeta.storedPath);
      }

      const nextForm = { ...currentForm, [slot]: meta };
      const persisted = await persistProgress(nextForm);
      setForm(persisted);
      setPending((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: false }));
      setProgress((current) => ({ ...current, [slot]: 100 }));
      await refreshList(email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setBusy((current) => ({ ...current, [slot]: false }));
      setUploadError((current) => ({ ...current, [slot]: message }));
    }
  }

  async function deleteSlot(slot: UploadSlot) {
    const currentForm = form;
    const meta = currentForm[slot];
    if (!meta?.storedPath) {
      setToast({ type: "err", msg: "File path missing." });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const response = await fetch("/api/me/case-studies-file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }

      const nextForm = { ...currentForm, [slot]: null };
      const persisted = await persistProgress(nextForm);
      setForm(persisted);
      setPending((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: false }));
      setProgress((current) => ({ ...current, [slot]: 0 }));
      setUploadError((current) => ({ ...current, [slot]: null }));
      await refreshList(email);

      setToast({ type: "ok", msg: "File deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  async function saveDraftChanges(options?: { closeAfterSave?: boolean }) {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      if (hasPendingFiles || hasBusyUploads) {
        setToast({ type: "err", msg: "Finish the current uploads before saving." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      const entryToSave: CaseStudyEntry = {
        ...form,
        status: form.status === "final" ? "final" : "draft",
        coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
      };
      const persisted = await persistProgress(entryToSave);
      setForm(persisted);
      setLastPersistedSnapshot(stableStringify(persisted));
      setAttemptedSectionSave(false);
      setSubmitAttemptedFinal(false);
      await refreshList(email);
      setToast({ type: "ok", msg: "Saved." });
      setTimeout(() => setToast(null), 1400);
      if (options?.closeAfterSave) {
        await closeForm();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  async function handleDone() {
    setSubmitAttemptedFinal(true);

    if (hasBusyUploads) {
      setToast({ type: "err", msg: "Please wait for upload to finish." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (!isComplete) {
      setToast({ type: "err", msg: "Complete all required uploads before finishing." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (!isDirty) {
      await closeForm();
      return;
    }

    await saveDraftChanges({ closeAfterSave: true });
  }

  async function generateEntry() {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      setAttemptedSectionSave(true);

      if (Object.keys(errors).length > 0 || !generateReady) {
        setToast({ type: "err", msg: "Complete all required fields before generating the entry." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      if (hasPendingFiles || hasBusyUploads) {
        setToast({ type: "err", msg: "Finish the current uploads before generating the entry." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      const draftEntry: CaseStudyEntry = {
        ...form,
        status: form.status === "final" ? "final" : "draft",
        coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
      };
      const persistedDraft = await persistProgress(draftEntry);
      const response = await fetch(`/api/me/case-studies/${encodeURIComponent(persistedDraft.id)}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const { message, payload } = await parseApiError(response, "Generate failed");

      if (!response.ok) {
        throw new Error(message);
      }

      const nextEntry =
        payload && typeof payload === "object" && "entry" in payload
          ? ((payload as { entry?: CaseStudyEntry }).entry ?? persistedDraft)
          : persistedDraft;

      setForm(nextEntry);
      setLastPersistedSnapshot(stableStringify(nextEntry));
      setAttemptedSectionSave(false);
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

    if (!SEMESTER_TYPE_OPTIONS.some((option) => option.value === entryDraft.semesterType)) {
      return { ok: false, error: "Select semester type first." };
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
          semesterType: entryToSave.semesterType,
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

    if (saveLockRef.current) {
      throw new Error("Please wait for the current save to finish.");
    }

    saveLockRef.current = true;

    try {
      const response = await fetch("/api/me/case-studies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, entry: entryToSave }),
      });
      const { payload, message } = await parseApiError(response, "Save faculty failed");

      if (!response.ok) {
        throw new Error(message);
      }

      const savedEntry = payload as CaseStudyEntry;
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
    } finally {
      saveLockRef.current = false;
    }
  }

  async function deleteEntry(id: string) {
    try {
      const response = await fetch("/api/me/case-studies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, id }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }

      setList((current) => current.filter((item) => item.id !== id));
      setToast({ type: "ok", msg: "Entry deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  async function requestEdit(entry: CaseStudyEntry) {
    if (requestingEditIds[entry.id] || entry.requestEditStatus === "pending") {
      return;
    }

    const optimisticEntry: CaseStudyEntry = {
      ...entry,
      requestEditStatus: "pending",
      requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? nowISTTimestampISO(),
    };

    setRequestingEditIds((current) => ({ ...current, [entry.id]: true }));
    setList((current) => current.map((item) => (item.id === entry.id ? optimisticEntry : item)));

    try {
      const persisted = await persistProgress(optimisticEntry);
      setList((current) => current.map((item) => (item.id === entry.id ? persisted : item)));
      setToast({ type: "ok", msg: "Request sent." });
      setTimeout(() => setToast(null), 1400);
    } catch (error) {
      setList((current) => current.map((item) => (item.id === entry.id ? entry : item)));
      const message = error instanceof Error ? error.message : "Request failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setRequestingEditIds((current) => ({ ...current, [entry.id]: false }));
    }
  }

  function renderCompletedRequestAction(entry: CaseStudyEntry) {
    const currentStatus = entry.requestEditStatus ?? "none";
    const isRequesting = requestingEditIds[entry.id];

    if (currentStatus === "approved") {
      return (
        <button
          type="button"
          disabled
          className="pointer-events-none inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-border px-3 text-sm opacity-60"
        >
          Approved
        </button>
      );
    }

    if (currentStatus === "pending" || isRequesting) {
      return (
        <button
          type="button"
          disabled
          className="pointer-events-none inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-border px-3 text-sm opacity-60"
        >
          Request Sent
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void requestEdit(entry)}
          className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border px-3 text-sm transition hover:bg-muted"
        >
          Request Edit
        </button>
        {currentStatus === "rejected" ? (
          <span className="text-xs text-muted-foreground">Request was rejected</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Case Studies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record case study visits with academic context, staff involvement, dates, and the required supporting documents.
          </p>
        </div>

        <div className="flex gap-2">
          {showForm && !isViewMode ? (
            <>
              <MiniButton
                variant="ghost"
                onClick={() => void closeForm()}
                disabled={isViewMode || saving || loading || hasBusyUploads || isComplete}
              >
                Cancel
              </MiniButton>
              <MiniButton
                onClick={() => void saveDraftChanges()}
                disabled={isViewMode || saving || loading || hasBusyUploads || !isDirty || isComplete}
              >
                {saving ? "Saving..." : "Save"}
              </MiniButton>
              <MiniButton
                onClick={() => void handleDone()}
                disabled={isViewMode || saving || loading || hasBusyUploads || !isComplete}
              >
                {saving ? "Saving..." : "Done"}
              </MiniButton>
            </>
          ) : !isViewMode ? (
            <MiniButton
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
              disabled={loading}
            >
              + Add Case Study
            </MiniButton>
          ) : null}
        </div>
      </div>

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
            title={isViewMode ? "Case Study Entry" : "New Case Study Entry"}
            subtitle="Add the entry details and generate the entry to unlock uploads."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Academic Year" error={attemptedSectionSave ? errors.academicYear : undefined}>
                <SelectDropdown
                  value={form.academicYear}
                  onChange={(value) => setForm((current) => ({ ...current, academicYear: value }))}
                  options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
                  placeholder="Select academic year"
                  disabled={controlsDisabled}
                  error={attemptedSectionSave && !!errors.academicYear}
                />
              </Field>

              <Field label="Semester Type" error={attemptedSectionSave ? errors.semesterType : undefined}>
                <SelectDropdown
                  value={form.semesterType}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      semesterType: value as CaseStudyEntry["semesterType"],
                    }))
                  }
                  options={SEMESTER_TYPE_OPTIONS}
                  placeholder="Select semester type"
                  disabled={controlsDisabled}
                  error={attemptedSectionSave && !!errors.semesterType}
                />
              </Field>

              <Field
                label="Starting Date"
                error={attemptedSectionSave ? errors.startDate : undefined}
                hint={
                  form.academicYear
                    ? getAcademicYearRange(form.academicYear)?.label
                    : undefined
                }
              >
                <DateField
                  value={form.startDate}
                  onChange={(next) => setForm((current) => ({ ...current, startDate: next }))}
                  disabled={controlsDisabled}
                  error={attemptedSectionSave && !!errors.startDate}
                />
              </Field>

              <Field
                label="Ending Date"
                error={attemptedSectionSave ? errors.endDate : undefined}
                hint={inclusiveDays ? `Number of Days: ${inclusiveDays}` : "Number of Days will be calculated automatically."}
              >
                <DateField
                  value={form.endDate}
                  onChange={(next) => setForm((current) => ({ ...current, endDate: next }))}
                  disabled={controlsDisabled}
                  error={attemptedSectionSave && !!errors.endDate}
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Place of Visit" error={attemptedSectionSave ? errors.placeOfVisit : undefined}>
                <input
                  value={form.placeOfVisit}
                  onChange={(event) => setForm((current) => ({ ...current, placeOfVisit: event.target.value }))}
                  disabled={controlsDisabled}
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
                  onChange={(event) => setForm((current) => ({ ...current, purposeOfVisit: event.target.value }))}
                  rows={4}
                  disabled={controlsDisabled}
                  className={cx(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    attemptedSectionSave && errors.purposeOfVisit
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>

              <Field label="Year (Students)" error={attemptedSectionSave ? errors.studentYear : undefined}>
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
                  disabled={controlsDisabled}
                  error={attemptedSectionSave && !!errors.studentYear}
                />
              </Field>

              <Field
                label="Semester"
                error={attemptedSectionSave ? errors.semesterNumber : undefined}
                hint={normalizedStudentYear ? "Select semester (based on year)" : "Select student year first"}
              >
                <SelectDropdown
                  value={form.semesterNumber === null ? "" : String(form.semesterNumber)}
                  disabled={controlsDisabled || !normalizedStudentYear}
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
                  error={attemptedSectionSave && !!errors.semesterNumber}
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
                  disabled={controlsDisabled}
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
                parentLocked={controlsDisabled}
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
                  disabled={controlsDisabled}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:border-ring/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                />
              </Field>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {!isViewMode ? (
                  <MiniButton
                    onClick={() => void generateEntry()}
                    disabled={controlsDisabled || saving || loading || hasBusyUploads || hasPendingFiles || !generateReady}
                  >
                    {saving ? "Generating..." : "Generate Entry"}
                  </MiniButton>
                ) : null}
                <EntryPdfActions pdfMeta={form.pdfMeta ?? null} />
              </div>

              {uploadsVisible ? (
                <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["permissionLetter", "Permission Letter"],
                  ["travelPlan", "Travel Plan"],
                ] as const
              ).map(([slot, label]) => {
                const meta = form[slot];
                const currentPending = pending[slot];
                const currentBusy = busy[slot];
                const currentProgress = progress[slot];
                const currentUploadError = uploadError[slot];
                const canUpload = !!currentPending && !currentBusy;
                const showUploaded = !!meta && !currentPending;

                return (
                  <div key={slot} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="text-sm font-semibold">{label}</div>

                    {isViewMode ? (
                      meta ? (
                        <div className="space-y-3">
                          <div className="text-xs text-muted-foreground">
                            {meta.fileName} • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={meta.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                            >
                              Preview
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Not uploaded</div>
                      )
                    ) : (
                      <>
                        {meta ? (
                          <div className="text-xs text-muted-foreground">
                            <a className="underline" href={meta.url} target="_blank" rel="noreferrer">
                              {meta.fileName}
                            </a>{" "}
                            • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
                          </div>
                        ) : (
                          <div className={cx("text-xs", submitAttemptedFinal ? "text-red-600" : "text-muted-foreground")}>
                            {submitAttemptedFinal ? "This upload is mandatory." : "No file uploaded yet."}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          {currentPending
                            ? `Selected: ${currentPending.name}`
                            : meta
                              ? "Uploaded. Choose a new file and upload to replace it."
                              : "Select a file to enable Upload & Save."}
                        </div>

                        {currentBusy ? (
                          <div className="space-y-2">
                            <ProgressBar value={currentProgress} />
                            <div className="text-xs text-muted-foreground">{currentProgress}% uploading...</div>
                          </div>
                        ) : null}

                        {currentUploadError ? <div className="text-xs text-red-600">{currentUploadError}</div> : null}

                        <div className="flex flex-wrap gap-2">
                          {meta ? (
                            <>
                              <a
                                href={meta.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                              >
                                Preview
                              </a>
                              <MiniButton variant="danger" onClick={() => void deleteSlot(slot)} disabled={currentBusy || controlsDisabled}>
                                Delete
                              </MiniButton>
                            </>
                          ) : null}

                          <label
                            className={cx(
                              "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                              currentBusy || controlsDisabled
                                ? "pointer-events-none cursor-not-allowed opacity-60"
                                : "cursor-pointer transition hover:bg-muted"
                            )}
                          >
                            Choose file
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                              disabled={controlsDisabled}
                              onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                event.currentTarget.value = "";
                                setPending((current) => ({ ...current, [slot]: file }));
                                setUploadError((current) => ({ ...current, [slot]: null }));
                                setProgress((current) => ({ ...current, [slot]: 0 }));
                              }}
                            />
                          </label>

                          <MiniButton onClick={() => void uploadSlot(slot)} disabled={controlsDisabled || !canUpload}>
                            {showUploaded ? "Uploaded" : "Upload & Save"}
                          </MiniButton>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              <MultiPhotoUpload
                key={form.id}
                title="Geotagged Photos"
                value={form.geotaggedPhotos}
                onUploaded={async (meta) => {
                  const nextForm = {
                    ...form,
                    geotaggedPhotos: [...form.geotaggedPhotos, meta],
                  };
                  const persisted = await persistProgress(nextForm);
                  setForm(persisted);
                  await refreshList(email);
                }}
                onDeleted={async (meta) => {
                  const nextForm = {
                    ...form,
                    geotaggedPhotos: form.geotaggedPhotos.filter((item) => item.storedPath !== meta.storedPath),
                  };
                  const persisted = await persistProgress(nextForm);
                  setForm(persisted);
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
          </SectionCard>
        ) : null}

        {!loading && !isViewMode ? (
          <SectionCard
            title="Saved Case Study Entries"
            subtitle="Your saved case study records are stored locally and keyed to your signed-in email."
          >
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              <div className="space-y-3">
                {list.map((entry) => {
                  const days = getInclusiveDays(entry.startDate, entry.endDate);
                  const completedEntry = entry.status === "final";
                  const entryLocked = isEntryLocked(entry);
                  return (
                    <div key={entry.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            <Link href={`/data-entry/case-studies/${entry.id}`} className="hover:underline">
                              {entry.academicYear} • {entry.semesterType} Semester
                            </Link>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Start: {formatDisplayDate(entry.startDate)} • End: {formatDisplayDate(entry.endDate)} • Days: {days ?? "-"}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {entry.placeOfVisit} • {entry.studentYear || "-"} • Semester {entry.semesterNumber ?? "-"}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Staff Count: {entry.staffAccompanying.length}
                            {entry.amountSupport !== null ? ` • Amount: ${entry.amountSupport}` : ""}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {entry.purposeOfVisit}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-3 text-sm">
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
                            {entry.geotaggedPhotos.map((meta, index) => (
                              <a
                                key={meta.storedPath}
                                className="underline"
                                href={meta.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Geotagged Photo {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {completedEntry ? (
                            entry.pdfMeta?.url ? (
                              <a
                                href={entry.pdfMeta.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity duration-150 hover:opacity-90 active:opacity-80"
                              >
                                Preview
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="pointer-events-none inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-foreground bg-foreground px-4 text-sm font-medium text-background opacity-60"
                              >
                                Preview
                              </button>
                            )
                          ) : null}
                          {completedEntry ? (
                            renderCompletedRequestAction(entry)
                          ) : (
                            <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                              Delete Entry
                            </MiniButton>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}

export default function CaseStudiesPageRoute() {
  return <CaseStudiesPage />;
}
