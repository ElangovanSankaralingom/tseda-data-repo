"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CurrencyField from "@/components/controls/CurrencyField";
import DateField from "@/components/controls/DateField";
import FacultySelect, { type FacultySelection } from "@/components/controls/FacultySelect";
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

type StaffSelection = {
  name: string;
  email: string;
};

type UploadSlot = "permissionLetter" | "travelPlan";

type CaseStudyEntry = {
  id: string;
  academicYear: string;
  semesterType: "Odd" | "Even" | "";
  startDate: string;
  endDate: string;
  coordinator: FacultySelection;
  placeOfVisit: string;
  purposeOfVisit: string;
  staffAccompanying: StaffSelection[];
  studentYear: StudentYear | "";
  semesterNumber: number | null;
  amountSupport: number | null;
  permissionLetter: FileMeta | null;
  travelPlan: FileMeta | null;
  geotaggedPhotos: FileMeta[];
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

function buildStaffKey(selection: StaffSelection) {
  const email = selection.email.trim().toLowerCase();
  if (email) return `email:${email}`;
  return `name:${selection.name.trim().toLowerCase()}`;
}

function emptyStaff(): StaffSelection {
  return { name: "", email: "" };
}

function emptyForm(currentFaculty?: FacultySelection): CaseStudyEntry {
  return {
    id: uuid(),
    academicYear: "",
    semesterType: "",
    startDate: "",
    endDate: "",
    coordinator: currentFaculty?.email ? currentFaculty : emptyStaff(),
    placeOfVisit: "",
    purposeOfVisit: "",
    staffAccompanying: [emptyStaff()],
    studentYear: "",
    semesterNumber: null,
    amountSupport: null,
    permissionLetter: null,
    travelPlan: null,
    geotaggedPhotos: [],
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

export default function CaseStudiesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<FacultySelection>(emptyStaff);
  const [list, setList] = useState<CaseStudyEntry[]>([]);
  const [form, setForm] = useState<CaseStudyEntry>(() => emptyForm());
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
        setForm(emptyForm(nextFaculty));

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

    if (!form.placeOfVisit.trim()) {
      nextErrors.placeOfVisit = "Place of visit is required.";
    }

    if (!form.purposeOfVisit.trim()) {
      nextErrors.purposeOfVisit = "Purpose of visit is required.";
    }

    if (form.staffAccompanying.length === 0) {
      nextErrors.staffAccompanying = "Add at least one staff member.";
    }

    const duplicateKeys = new Map<string, number>();
    form.staffAccompanying.forEach((staff) => {
      const key = buildStaffKey(staff);
      if (key !== "name:") {
        duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
      }
    });

    form.staffAccompanying.forEach((staff, index) => {
      if (!staff.name.trim()) {
        nextErrors[`staffAccompanying.${index}`] = "Staff member is required.";
        return;
      }

      const key = buildStaffKey(staff);
      if (key !== "name:" && (duplicateKeys.get(key) ?? 0) > 1) {
        nextErrors[`staffAccompanying.${index}`] = "This faculty is already selected in another row.";
      }
    });

    const normalizedStudentYear = normalizeStudentYear(form.studentYear);
    if (!normalizedStudentYear) {
      nextErrors.studentYear = "Year is required.";
    }

    if (normalizedStudentYear && !isSemesterAllowed(normalizedStudentYear, form.semesterNumber ?? undefined)) {
      nextErrors.semesterNumber = "Semester is required.";
    }

    if (form.amountSupport !== null) {
      if (!Number.isFinite(form.amountSupport) || form.amountSupport < 0) {
        nextErrors.amountSupport = "Invalid amount.";
      }
    }

    if (!form.permissionLetter) {
      nextErrors.permissionLetter = "Permission letter is mandatory.";
    }

    if (!form.travelPlan) {
      nextErrors.travelPlan = "Travel plan is mandatory.";
    }

    if (form.geotaggedPhotos.length === 0) {
      nextErrors.geotaggedPhotos = "At least one geotagged photo is mandatory.";
    }

    return nextErrors;
  }, [form]);

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const normalizedStudentYear = normalizeStudentYear(form.studentYear);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const hasPendingFiles = Object.values(pending).some(Boolean) || photoUploadStatus.hasPending;
  const hasBusyUploads = Object.values(busy).some(Boolean) || photoUploadStatus.busy;
  const selectedFacultyEmails = useMemo(() => {
    return new Set(
      form.staffAccompanying
        .map((staff) => staff.email.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [form.staffAccompanying]);

  function getDisabledEmailsForStaffRow(index: number) {
    const next = new Set(selectedFacultyEmails);
    const currentEmail = form.staffAccompanying[index]?.email?.trim().toLowerCase();
    if (currentEmail) {
      next.delete(currentEmail);
    }
    return next;
  }

  function resetForm() {
    setSubmitted(false);
    setForm(emptyForm(currentFaculty));
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
    if (form.permissionLetter || form.travelPlan || form.geotaggedPhotos.length > 0) {
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

      setForm((current) => ({ ...current, [slot]: meta }));
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
    const meta = form[slot];
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

      setForm((current) => ({ ...current, [slot]: null }));
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
      const entryToSave: CaseStudyEntry = {
        ...form,
        coordinator: currentFaculty.email ? currentFaculty : form.coordinator,
      };
      const response = await fetch("/api/me/case-studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, entry: entryToSave }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Save failed.");
      }

      await refreshList(email);
      setToast({ type: "ok", msg: "Case Study saved." });
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
              + Add Case Study
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
            title="New Case Study Entry"
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

              <Field label="Semester Type" error={submitted ? errors.semesterType : undefined}>
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
                  error={submitted && !!errors.semesterType}
                />
              </Field>

              <Field
                label="Starting Date"
                error={submitted ? errors.startDate : undefined}
                hint={
                  form.academicYear
                    ? getAcademicYearRange(form.academicYear)?.label
                    : undefined
                }
              >
                <DateField
                  value={form.startDate}
                  onChange={(next) => setForm((current) => ({ ...current, startDate: next }))}
                  error={submitted && !!errors.startDate}
                />
              </Field>

              <Field
                label="Ending Date"
                error={submitted ? errors.endDate : undefined}
                hint={inclusiveDays ? `Number of Days: ${inclusiveDays}` : "Number of Days will be calculated automatically."}
              >
                <DateField
                  value={form.endDate}
                  onChange={(next) => setForm((current) => ({ ...current, endDate: next }))}
                  error={submitted && !!errors.endDate}
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Place of Visit" error={submitted ? errors.placeOfVisit : undefined}>
                <input
                  value={form.placeOfVisit}
                  onChange={(event) => setForm((current) => ({ ...current, placeOfVisit: event.target.value }))}
                  className={cx(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.placeOfVisit
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>

              <Field label="Purpose of Visit" error={submitted ? errors.purposeOfVisit : undefined}>
                <textarea
                  value={form.purposeOfVisit}
                  onChange={(event) => setForm((current) => ({ ...current, purposeOfVisit: event.target.value }))}
                  rows={4}
                  className={cx(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                    submitted && errors.purposeOfVisit
                      ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
                      : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
                  )}
                />
              </Field>

              <Field label="Year (Students)" error={submitted ? errors.studentYear : undefined}>
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

              <Field
                label="Amount of Support"
                error={submitted ? errors.amountSupport : undefined}
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
                  error={submitted && !!errors.amountSupport}
                  placeholder="Enter amount"
                />
              </Field>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Coordinator: <span className="font-medium text-foreground">{currentFaculty.name || "-"}</span>
            </div>

            <div className="mt-5 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Staff Accompanying</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Add at least one staff member. Already selected faculty are disabled in other rows.
                  </div>
                </div>

                <MiniButton
                  variant="ghost"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      staffAccompanying: [...current.staffAccompanying, emptyStaff()],
                    }))
                  }
                >
                  + Add Staff
                </MiniButton>
              </div>

              <div className="mt-4 space-y-3">
                {form.staffAccompanying.map((staff, index) => (
                  <div key={`${form.id}-staff-${index}`} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field
                      label={`Staff ${index + 1}`}
                      error={
                        submitted
                          ? errors[`staffAccompanying.${index}`] || (index === 0 ? errors.staffAccompanying : undefined)
                          : undefined
                      }
                    >
                      <FacultySelect
                        value={staff}
                        onChange={(next) =>
                          setForm((current) => ({
                            ...current,
                            staffAccompanying: current.staffAccompanying.map((item, itemIndex) =>
                              itemIndex === index ? next : item
                            ),
                          }))
                        }
                        options={FACULTY_OPTIONS}
                        disabledEmails={getDisabledEmailsForStaffRow(index)}
                        placeholder="Search or type staff name"
                        error={submitted && !!(errors[`staffAccompanying.${index}`] || (index === 0 ? errors.staffAccompanying : undefined))}
                      />
                    </Field>

                    <MiniButton
                      variant="danger"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          staffAccompanying:
                            current.staffAccompanying.length > 1
                              ? current.staffAccompanying.filter((_, itemIndex) => itemIndex !== index)
                              : [emptyStaff()],
                        }))
                      }
                    >
                      Delete
                    </MiniButton>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
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
                value={form.geotaggedPhotos}
                onUploaded={(meta) =>
                  setForm((current) => ({
                    ...current,
                    geotaggedPhotos: [...current.geotaggedPhotos, meta],
                  }))
                }
                onDeleted={(meta) =>
                  setForm((current) => ({
                    ...current,
                    geotaggedPhotos: current.geotaggedPhotos.filter((item) => item.storedPath !== meta.storedPath),
                  }))
                }
                uploadEndpoint="/api/me/case-studies-file"
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
            title="Saved Case Study Entries"
            subtitle="Your saved case study records are stored locally and keyed to your signed-in email."
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
                            {entry.academicYear} • {entry.semesterType} Semester
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
