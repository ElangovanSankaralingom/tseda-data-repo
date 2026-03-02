"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FacultySelect, { type FacultySelection } from "@/components/controls/FacultySelect";
import DateField from "@/components/controls/DateField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import MultiPhotoUpload from "@/components/uploads/MultiPhotoUpload";
import { FACULTY } from "@/lib/facultyDirectory";
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

type UploadSlot =
  | "permissionLetter"
  | "brochure"
  | "attendance"
  | "speakerProfile";

type GuestLectureEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "coCoordinator";
  academicYear: string;
  semesterType: "Odd" | "Even" | "";
  startDate: string;
  endDate: string;
  eventName: string;
  speakerName: string;
  organizationName: string;
  coordinator: FacultySelection;
  coCoordinators: FacultySelection[];
  studentYear: StudentYear | "";
  semesterNumber: number | null;
  participants: number | null;
  uploads: Record<UploadSlot, FileMeta | null> & { geotaggedPhotos: FileMeta[] };
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
const FACULTY_OPTIONS = FACULTY;

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

function emptyFacultySelection(): FacultySelection {
  return { name: "", email: "" };
}

function formatFacultyDisplay(selection: FacultySelection) {
  return selection.name || selection.email || "";
}

function createEmptyForm(currentFaculty?: FacultySelection): GuestLectureEntry {
  return {
    id: uuid(),
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
    uploads: {
      ...emptyUploads(),
      geotaggedPhotos: [],
    },
    createdAt: "",
    updatedAt: "",
  };
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
    <div className="rounded-2xl border border-border bg-white/70 p-5 dark:bg-black/20">
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
      ? "border-border text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
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

function uploadGuestLecturesFileXHR(opts: {
  email: string;
  recordId: string;
  slot: UploadSlot;
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { email, recordId, slot, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/guest-lectures-file", true);

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

export default function GuestLecturesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<FacultySelection>(emptyFacultySelection);
  const [list, setList] = useState<GuestLectureEntry[]>([]);
  const [form, setForm] = useState<GuestLectureEntry>(() => createEmptyForm());
  const [pending, setPending] = useState<Record<UploadSlot, File | null>>({
    permissionLetter: null,
    brochure: null,
    attendance: null,
    speakerProfile: null,
  });
  const [busy, setBusy] = useState<Record<UploadSlot, boolean>>({
    permissionLetter: false,
    brochure: false,
    attendance: false,
    speakerProfile: false,
  });
  const [progress, setProgress] = useState<Record<UploadSlot, number>>({
    permissionLetter: 0,
    brochure: 0,
    attendance: 0,
    speakerProfile: 0,
  });
  const [uploadError, setUploadError] = useState<Record<UploadSlot, string | null>>({
    permissionLetter: null,
    brochure: null,
    attendance: null,
    speakerProfile: null,
  });
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });
  const saveLockRef = useRef(false);

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
        setForm(createEmptyForm(nextFaculty));

        const listResponse = await fetch(`/api/me/guest-lectures?email=${encodeURIComponent(nextEmail)}`, {
          cache: "no-store",
        });
        const items = await listResponse.json();

        if (!listResponse.ok) {
          throw new Error(items?.error || "Failed to load Guest Lectures records.");
        }

        setList(Array.isArray(items) ? (items as GuestLectureEntry[]) : []);
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

    for (const { slot, label } of UPLOAD_CONFIG) {
      if (!form.uploads[slot]) {
        nextErrors[slot] = `${label} is mandatory.`;
      }
    }

    if (form.uploads.geotaggedPhotos.length === 0) {
      nextErrors.geotaggedPhotos = "At least one geotagged photo is mandatory.";
    }

    return nextErrors;
  }, [form, currentFaculty.email]);

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const normalizedStudentYear = normalizeStudentYear(form.studentYear);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const selectedEmails = useMemo(() => {
    return new Set(
      [(currentFaculty.email || form.coordinator.email), ...form.coCoordinators.map((value) => value.email)]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [currentFaculty.email, form.coordinator.email, form.coCoordinators]);
  const hasPendingFiles = Object.values(pending).some(Boolean) || photoUploadStatus.hasPending;
  const hasBusyUploads = Object.values(busy).some(Boolean) || photoUploadStatus.busy;

  function getDisabledForCoCoordinatorRow(index: number) {
    const next = new Set(selectedEmails);
    const currentEmail = form.coCoordinators[index]?.email?.toLowerCase();

    if (currentEmail) {
      next.delete(currentEmail);
    }

    return next;
  }

  function resetForm() {
    setSubmitted(false);
    setForm(createEmptyForm(currentFaculty));
    setPending({
      permissionLetter: null,
      brochure: null,
      attendance: null,
      speakerProfile: null,
    });
    setBusy({
      permissionLetter: false,
      brochure: false,
      attendance: false,
      speakerProfile: false,
    });
    setProgress({
      permissionLetter: 0,
      brochure: 0,
      attendance: 0,
      speakerProfile: 0,
    });
    setUploadError({
      permissionLetter: null,
      brochure: null,
      attendance: null,
      speakerProfile: null,
    });
    setPhotoUploadStatus({ hasPending: false, busy: false });
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

  async function closeForm() {
    if (
      form.uploads.permissionLetter ||
      form.uploads.brochure ||
      form.uploads.attendance ||
      form.uploads.speakerProfile ||
      form.uploads.geotaggedPhotos.length > 0
    ) {
      await cleanupDraftUploads(form);
    }
    resetForm();
    setFormOpen(false);
  }

  async function refreshList(nextEmail = email) {
    const response = await fetch(`/api/me/guest-lectures?email=${encodeURIComponent(nextEmail)}`, {
      cache: "no-store",
    });
    const items = await response.json();

    if (!response.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    setList(Array.isArray(items) ? (items as GuestLectureEntry[]) : []);
  }

  async function uploadSlot(slot: UploadSlot) {
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

    const previousMeta = form.uploads[slot];

    try {
      setUploadError((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: true }));
      setProgress((current) => ({ ...current, [slot]: 0 }));

      const meta = await uploadGuestLecturesFileXHR({
        email,
        recordId: form.id,
        slot,
        file,
        onProgress: (pct) => setProgress((current) => ({ ...current, [slot]: pct })),
      });

      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void deleteStoredFile(previousMeta.storedPath);
      }

      setForm((current) => ({
        ...current,
        uploads: {
          ...current.uploads,
          [slot]: meta,
        },
      }));
      setPending((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: false }));
      setProgress((current) => ({ ...current, [slot]: 100 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setBusy((current) => ({ ...current, [slot]: false }));
      setUploadError((current) => ({ ...current, [slot]: message }));
    }
  }

  async function deleteSlot(slot: UploadSlot) {
    const meta = form.uploads[slot];
    if (!meta?.storedPath) {
      setToast({ type: "err", msg: "File path missing." });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const response = await fetch("/api/me/guest-lectures-file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }

      setForm((current) => ({
        ...current,
        uploads: {
          ...current.uploads,
          [slot]: null,
        },
      }));
      setPending((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: false }));
      setProgress((current) => ({ ...current, [slot]: 0 }));
      setUploadError((current) => ({ ...current, [slot]: null }));

      setToast({ type: "ok", msg: "File deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  async function saveEntry() {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      setSubmitted(true);

      if (Object.keys(errors).length > 0) {
        setToast({ type: "err", msg: "Complete all mandatory fields before saving." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      if (hasPendingFiles || hasBusyUploads) {
        setToast({ type: "err", msg: "Finish the current uploads before saving." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      const entryToSave: GuestLectureEntry = {
        ...form,
        coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
      };
      const response = await fetch("/api/me/guest-lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, entry: entryToSave }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Save failed.");
      }

      await refreshList(email);
      setToast({ type: "ok", msg: "Guest Lecture saved." });
      setTimeout(() => setToast(null), 1400);
      resetForm();
      setFormOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  async function deleteEntry(id: string) {
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

      setList((current) => current.filter((item) => item.id !== id));
      setToast({ type: "ok", msg: "Entry deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guest Lectures</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record event details, student participation, and the required supporting documents.
          </p>
        </div>

        <div className="flex gap-2">
          {formOpen ? (
            <>
              <MiniButton variant="ghost" onClick={() => void closeForm()} disabled={saving || loading || hasBusyUploads}>
                Cancel
              </MiniButton>
              <MiniButton onClick={() => void saveEntry()} disabled={saving || loading || hasBusyUploads}>
                {saving ? "Saving..." : "Save"}
              </MiniButton>
            </>
          ) : (
            <MiniButton
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
              disabled={loading}
            >
              + Add Guest Lecture
            </MiniButton>
          )}
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

        {!loading && formOpen ? (
          <SectionCard
            title="New Guest Lecture Entry"
            subtitle="Add the entry details and upload the required documents."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Academic Year" error={submitted ? errors.academicYear : undefined}>
                <SelectDropdown
                  value={form.academicYear}
                  onChange={(value) => setForm((current) => ({ ...current, academicYear: value }))}
                  options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
                  placeholder="Select academic year"
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
                  error={submitted && !!errors.endDate}
                />
              </Field>

              <Field label="Name of the Event" error={submitted ? errors.eventName : undefined}>
                <input
                  value={form.eventName}
                  onChange={(event) => setForm((current) => ({ ...current, eventName: event.target.value }))}
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

            <div className="mt-5 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Co-coordinator(s)</div>
                  <div className="mt-1 text-xs text-muted-foreground">Add co-coordinators only when applicable.</div>
                </div>
                <MiniButton
                  variant="ghost"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      coCoordinators: [...current.coCoordinators, emptyFacultySelection()],
                    }))
                  }
                >
                  + Add Co-coordinator
                </MiniButton>
              </div>

              {submitted && errors.coCoordinators ? (
                <div className="mt-2 text-xs text-red-600">{errors.coCoordinators}</div>
              ) : null}

              {form.coCoordinators.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {form.coCoordinators.map((value, index) => (
                    <div key={`${index}-${value.email || value.name}`} className="grid grid-cols-[1fr_auto] items-end gap-2">
                      <Field
                        label={`Co-coordinator ${index + 1}`}
                        error={submitted ? errors[`coCoordinators.${index}`] : undefined}
                      >
                        <FacultySelect
                          value={value}
                          onChange={(next) =>
                            setForm((current) => ({
                              ...current,
                              coCoordinators: current.coCoordinators.map((item, itemIndex) =>
                                itemIndex === index ? next : item
                              ),
                            }))
                          }
                          options={FACULTY_OPTIONS}
                          disabledEmails={getDisabledForCoCoordinatorRow(index)}
                          placeholder="Search or type co-coordinator"
                          error={submitted && !!errors[`coCoordinators.${index}`]}
                        />
                      </Field>

                      <MiniButton
                        variant="danger"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            coCoordinators: current.coCoordinators.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        Delete
                      </MiniButton>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">No co-coordinators added.</div>
              )}
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
                  disabled={!normalizedStudentYear}
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
                  className={cx(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.participants
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {UPLOAD_CONFIG.map(({ slot, label }) => {
                const meta = form.uploads[slot];
                const currentPending = pending[slot];
                const currentBusy = busy[slot];
                const currentProgress = progress[slot];
                const currentUploadError = uploadError[slot];
                const canUpload = !!currentPending && !currentBusy && !meta;
                const showUploaded = !!meta && !currentPending;

                return (
                  <div key={slot} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="text-sm font-semibold">{label}</div>

                    {meta ? (
                      <div className="text-xs text-muted-foreground">
                        <a className="underline" href={meta.url} target="_blank" rel="noreferrer">
                          {meta.fileName}
                        </a>{" "}
                        • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
                      </div>
                    ) : (
                      <div className={cx("text-xs", submitted ? "text-red-600" : "text-muted-foreground")}>
                        {submitted ? (errors[slot] || "This upload is mandatory.") : "No file uploaded yet."}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {currentPending
                        ? `Selected: ${currentPending.name}`
                        : meta
                          ? "Uploaded. Choose a new file only if you want to replace it after deleting."
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
                          <MiniButton variant="danger" onClick={() => void deleteSlot(slot)} disabled={currentBusy}>
                            Delete
                          </MiniButton>
                        </>
                      ) : null}

                      <label
                        className={cx(
                          "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                          currentBusy
                            ? "pointer-events-none cursor-not-allowed opacity-60"
                            : "cursor-pointer transition hover:bg-muted"
                        )}
                      >
                        Choose file
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            event.currentTarget.value = "";
                            setPending((current) => ({ ...current, [slot]: file }));
                            setUploadError((current) => ({ ...current, [slot]: null }));
                            setProgress((current) => ({ ...current, [slot]: 0 }));
                          }}
                        />
                      </label>

                      <MiniButton onClick={() => void uploadSlot(slot)} disabled={!canUpload || showUploaded}>
                        {showUploaded ? "Uploaded" : "Upload & Save"}
                      </MiniButton>
                    </div>
                  </div>
                );
              })}

              <MultiPhotoUpload
                key={form.id}
                title="Geotagged Photos"
                value={form.uploads.geotaggedPhotos}
                onUploaded={(meta) =>
                  setForm((current) => ({
                    ...current,
                    uploads: {
                      ...current.uploads,
                      geotaggedPhotos: [...current.uploads.geotaggedPhotos, meta],
                    },
                  }))
                }
                onDeleted={(meta) =>
                  setForm((current) => ({
                    ...current,
                    uploads: {
                      ...current.uploads,
                      geotaggedPhotos: current.uploads.geotaggedPhotos.filter(
                        (item) => item.storedPath !== meta.storedPath
                      ),
                    },
                  }))
                }
                uploadEndpoint="/api/me/guest-lectures-file"
                email={email}
                recordId={form.id}
                slotName="geotaggedPhotos"
                showRequiredError={submitted && !!errors.geotaggedPhotos}
                requiredErrorText={errors.geotaggedPhotos}
                onStatusChange={setPhotoUploadStatus}
              />
            </div>
          </SectionCard>
        ) : null}

        {!loading ? (
          <SectionCard
            title="Saved Guest Lecture Entries"
            subtitle="Your saved guest lecture records are stored locally and keyed to your signed-in email."
          >
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              <div className="space-y-3">
                {list.map((entry) => {
                  const days = getInclusiveDays(entry.startDate, entry.endDate);
                  return (
                    <div key={entry.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {entry.eventName}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {entry.academicYear} • {entry.semesterType} Semester
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Start: {formatDisplayDate(entry.startDate)} • End: {formatDisplayDate(entry.endDate)} • Days: {days ?? "-"}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Speaker: {entry.speakerName} • {entry.organizationName}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Coordinator: {formatFacultyDisplay(entry.coordinator)}
                            {entry.coCoordinators.length > 0
                              ? ` • Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`
                              : ""}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {entry.studentYear || "-"} • Semester {entry.semesterNumber ?? "-"} • Participants: {entry.participants ?? "-"}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-3 text-sm">
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
                            {entry.uploads.geotaggedPhotos.map((meta, index) => (
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

                        <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)}>
                          Delete Entry
                        </MiniButton>
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
