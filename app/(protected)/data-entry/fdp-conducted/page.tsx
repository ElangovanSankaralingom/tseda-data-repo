"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DateField from "@/components/controls/DateField";
import FacultySelect from "@/components/controls/FacultySelect";
import SelectDropdown from "@/components/controls/SelectDropdown";
import MultiPhotoUpload, { type FileMeta } from "@/components/uploads/MultiPhotoUpload";
import { FACULTY_DIRECTORY, type FacultyDirectoryEntry } from "@/lib/faculty-directory";
import {
  isEntryLockedState,
  isFutureDatedEntry,
  isNonStreakEntryLocked,
  isWithinRequestEditWindow,
  remainingEditableDays,
  remainingDaysFromDueAtISO,
  status as getStreakStatus,
  type StreakState,
} from "@/lib/gamification";

type FacultySelection = {
  name: string;
  email: string;
};

type FdpConducted = {
  id: string;
  status: "draft" | "final";
  requestEditStatus?: "none" | "pending" | "approved" | "rejected";
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  startDate: string;
  endDate: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultySelection[];
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

type FdpConductedEntryStatus = "completed" | "activated" | "expired" | "none";

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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
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

function getEntryCreatedSortTime(entry: FdpConducted) {
  const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
  if (!Number.isNaN(createdTime)) return createdTime;

  const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
  if (!Number.isNaN(updatedTime)) return updatedTime;

  return 0;
}

function formatFacultyDisplay(selection: FacultySelection) {
  return selection.name || selection.email || "-";
}

function getConductedEntryStatus(entry: FdpConducted): FdpConductedEntryStatus {
  const streakStatus = getStreakStatus(entry.streak);

  if (entry.streak.completedAtISO) {
    return "completed";
  }

  if (entry.status === "final" && entry.streak.activatedAtISO) {
    return streakStatus === "expired" ? "expired" : "activated";
  }

  return "none";
}

function emptyForm(currentFaculty?: CurrentFaculty): FdpConducted {
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
    coordinatorName: currentFaculty?.name ?? "",
    coordinatorEmail: currentFaculty?.email ?? "",
    coCoordinators: [],
    permissionLetter: null,
    geotaggedPhotos: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  };
}

function isEntryLocked(entry: FdpConducted) {
  if (entry.requestEditStatus === "approved") {
    return false;
  }

  return isEntryLockedState(entry);
}

function getNonStreakEditLabel(entry: FdpConducted) {
  if (isFutureDatedEntry(entry.startDate, entry.endDate) || !entry.createdAt) return null;
  if (isNonStreakEntryLocked(entry.createdAt)) return "Locked";

  const daysLeft = remainingEditableDays(entry.createdAt);
  return `Editable for ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

function getRemainingDaysChipClass(remainingDays: number) {
  if (remainingDays <= 2) return "bg-red-50 text-red-700";
  if (remainingDays <= 5) return "bg-amber-50 text-amber-700";
  return "bg-muted text-muted-foreground";
}

function FlameStatusIcon({ tone }: { tone: "gray" | "color" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.9 2.6c.5 3-1 4.9-2.2 6.4-1 1.3-1.8 2.3-1.8 3.9 0 2 1.6 3.6 3.6 3.6 2.8 0 4.6-2.5 4.6-5.2 0-2.2-1.3-4.5-4.2-8.7Z"
        fill={tone === "color" ? "#f97316" : "#9ca3af"}
      />
      <path
        d="M12 10.5c1.8 2 2.6 3.3 2.6 4.8A2.6 2.6 0 0 1 12 18a2.6 2.6 0 0 1-2.6-2.7c0-1 .5-1.9 1.4-3 .4-.5.8-1.1 1.2-1.8Z"
        fill={tone === "color" ? "#fdba74" : "#d1d5db"}
      />
    </svg>
  );
}

function SlashedFireIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-muted-foreground opacity-70"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.9 2.6c.5 3-1 4.9-2.2 6.4-1 1.3-1.8 2.3-1.8 3.9 0 2 1.6 3.6 3.6 3.6 2.8 0 4.6-2.5 4.6-5.2 0-2.2-1.3-4.5-4.2-8.7Z"
        fill="#9ca3af"
      />
      <path
        d="M12 10.5c1.8 2 2.6 3.3 2.6 4.8A2.6 2.6 0 0 1 12 18a2.6 2.6 0 0 1-2.6-2.7c0-1 .5-1.9 1.4-3 .4-.5.8-1.1 1.2-1.8Z"
        fill="#d1d5db"
      />
      <path d="M5 5 19 19" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
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
      ? "pointer-events-none cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
      : "pointer-events-none cursor-not-allowed border-border bg-transparent text-muted-foreground opacity-60";

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

function uploadConductedFileXHR(opts: {
  email: string;
  recordId: string;
  slot: "permissionLetter";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { email, recordId, slot, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/fdp-conducted-file", true);

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

export default function FdpConductedPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState<"save" | "done" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [email, setEmail] = useState("");
  const [currentFaculty, setCurrentFaculty] = useState<CurrentFaculty | null>(null);
  const [list, setList] = useState<FdpConducted[]>([]);
  const [form, setForm] = useState<FdpConducted>(() => emptyForm());
  const [lastPersistedSnapshot, setLastPersistedSnapshot] = useState(() => stableStringify(emptyForm()));
  const [pending, setPending] = useState<Record<"permissionLetter", File | null>>({
    permissionLetter: null,
  });
  const [requestingEditIds, setRequestingEditIds] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<"permissionLetter", boolean>>({
    permissionLetter: false,
  });
  const [progress, setProgress] = useState<Record<"permissionLetter", number>>({
    permissionLetter: 0,
  });
  const [uploadError, setUploadError] = useState<Record<"permissionLetter", string | null>>({
    permissionLetter: null,
  });
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });
  const saveLockRef = useRef(false);
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

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
        setForm(nextForm);
        setLastPersistedSnapshot(stableStringify(nextForm));

        const listResponse = await fetch(`/api/me/fdp-conducted?email=${encodeURIComponent(nextEmail)}`, {
          cache: "no-store",
        });
        const items = await listResponse.json();

        if (!listResponse.ok) {
          throw new Error(items?.error || "Failed to load FDP Conducted records.");
        }

        setList(Array.isArray(items) ? (items as FdpConducted[]) : []);
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

    const hasBlankCoCoordinator = form.coCoordinators.some((value) => value.name.trim().length === 0);
    if (hasBlankCoCoordinator) {
      nextErrors.coCoordinators = "Remove empty co-coordinator rows or fill them in.";
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

    if (!form.permissionLetter) {
      nextErrors.permissionLetter = "Permission letter is mandatory.";
    }

    return nextErrors;
  }, [form]);

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const selectedEmails = useMemo(() => {
    return new Set(
      [form.coordinatorEmail, ...form.coCoordinators.map((value) => value.email)]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [form.coordinatorEmail, form.coCoordinators]);
  const hasPendingFiles = !!pending.permissionLetter || photoUploadStatus.hasPending;
  const hasBusyUploads = busy.permissionLetter || photoUploadStatus.busy;
  const isDirty = stableStringify(form) !== lastPersistedSnapshot;
  const isEligibleFuture = isFutureDatedEntry(form.startDate, form.endDate);
  const isLocked = !!form.createdAt && isEntryLocked(form);
  const doneReady =
    !!form.academicYear &&
    !!form.semesterType &&
    isISODate(form.startDate) &&
    isISODate(form.endDate) &&
    form.endDate >= form.startDate &&
    !!form.permissionLetter &&
    !form.coCoordinators.some((value) => value.name.trim().length === 0);
  const geotagVisible = form.status === "final" && !!form.streak.activatedAtISO;
  const needsCompletionFinalization =
    form.status === "final" &&
    form.geotaggedPhotos.length > 0 &&
    !!form.streak.activatedAtISO &&
    !form.streak.completedAtISO;
  const groupedEntries = useMemo(() => {
    const indexedEntries = list.map((entry, index) => ({ entry, index }));
    const sortChronologically = (
      left: { entry: FdpConducted; index: number },
      right: { entry: FdpConducted; index: number }
    ) => {
      const leftTime = getEntryCreatedSortTime(left.entry);
      const rightTime = getEntryCreatedSortTime(right.entry);

      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.index - right.index;
    };

    const draftEntries = indexedEntries
      .filter(({ entry }) => isFutureDatedEntry(entry.startDate, entry.endDate) && entry.status !== "final")
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    const pendingEntries = indexedEntries
      .filter(({ entry }) => {
        if (!isFutureDatedEntry(entry.startDate, entry.endDate)) return false;
        if (entry.status !== "final") return false;
        const entryStatus = getConductedEntryStatus(entry);
        return entryStatus === "activated" || entryStatus === "expired";
      })
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    const completedEntries = indexedEntries
      .filter(
        ({ entry }) =>
          isFutureDatedEntry(entry.startDate, entry.endDate) && getConductedEntryStatus(entry) === "completed"
      )
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    const nonStreakEntries = indexedEntries
      .filter(({ entry }) => !isFutureDatedEntry(entry.startDate, entry.endDate))
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    return {
      drafts: draftEntries,
      pending: pendingEntries,
      completed: completedEntries,
      nonStreak: nonStreakEntries,
    };
  }, [list]);

  function getDisabledForCoCoordinatorRow(index: number) {
    const next = new Set(selectedEmails);
    const currentEmail = form.coCoordinators[index]?.email?.toLowerCase();

    if (currentEmail) {
      next.delete(currentEmail);
    }

    return next;
  }

  function resetUploadState() {
    setPending({ permissionLetter: null });
    setBusy({ permissionLetter: false });
    setProgress({ permissionLetter: 0 });
    setUploadError({ permissionLetter: null });
    setPhotoUploadStatus({ hasPending: false, busy: false });
  }

  function resetForm() {
    setSubmitted(false);
    const nextForm = emptyForm(currentFaculty ?? undefined);
    setForm(nextForm);
    setLastPersistedSnapshot(stableStringify(nextForm));
    resetUploadState();
  }

  function openEntry(entry: FdpConducted) {
    setSubmitted(false);
    setForm(entry);
    setLastPersistedSnapshot(stableStringify(entry));
    resetUploadState();
    setFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setFormOpen(false);
  }

  async function handleCancel() {
    if (hasBusyUploads) {
      setToast({ type: "err", msg: "Please wait for upload to finish." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    closeForm();
  }

  async function refreshList() {
    const response = await fetch(`/api/me/fdp-conducted?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
    });
    const items = await response.json();

    if (!response.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    setList(Array.isArray(items) ? (items as FdpConducted[]) : []);
  }

  async function persistProgress(nextForm: FdpConducted) {
    const response = await fetch("/api/me/fdp-conducted", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, entry: nextForm }),
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
      throw new Error(message);
    }

    return payload as FdpConducted;
  }

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/fdp-conducted-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function handleDone() {
    if (hasBusyUploads) {
      setToast({ type: "err", msg: "Please wait for upload to finish." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (hasPendingFiles) {
      setToast({ type: "err", msg: "Please upload the selected file(s) first." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (!doneReady || isLocked) {
      setSubmitted(true);
      setToast({ type: "err", msg: isLocked ? "This entry is locked." : "Complete the required fields first." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (!isDirty && !needsCompletionFinalization && form.status === "final") {
      closeForm();
      return;
    }

    await finalizeAndExit();
  }

  async function uploadSlot(slot: "permissionLetter") {
    const currentForm = formRef.current;
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

    const previousMeta = currentForm.permissionLetter;

    try {
      setUploadError((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: true }));
      setProgress((current) => ({ ...current, [slot]: 0 }));

      const meta = await uploadConductedFileXHR({
        email,
        recordId: form.id,
        slot,
        file,
        onProgress: (pct) => setProgress((current) => ({ ...current, [slot]: pct })),
      });

      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void deleteStoredFile(previousMeta.storedPath);
      }

      const nextForm = {
        ...currentForm,
        permissionLetter: meta,
      };

      const persisted = await persistProgress(nextForm);
      setForm(persisted);
      setLastPersistedSnapshot(stableStringify(persisted));
      setPending({ permissionLetter: null });
      setBusy({ permissionLetter: false });
      setProgress({ permissionLetter: 100 });
      await refreshList();

    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setBusy((current) => ({ ...current, [slot]: false }));
      setUploadError((current) => ({ ...current, [slot]: message }));
    }
  }

  async function deleteSlot(slot: "permissionLetter") {
    const currentForm = formRef.current;
    const meta = currentForm[slot];
    if (!meta?.storedPath) {
      setToast({ type: "err", msg: "File path missing." });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const response = await fetch("/api/me/fdp-conducted-file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }

      const nextForm = {
        ...currentForm,
        permissionLetter: null,
      };
      const persisted = await persistProgress(nextForm);
      setForm(persisted);
      setLastPersistedSnapshot(stableStringify(persisted));
      setPending({ permissionLetter: null });
      setBusy({ permissionLetter: false });
      setProgress({ permissionLetter: 0 });
      setUploadError({ permissionLetter: null });
      await refreshList();

      setToast({ type: "ok", msg: "File deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  async function saveDraftChanges() {
    if (saveLockRef.current || !isDirty || isLocked) return;
    saveLockRef.current = true;

    try {
      if (hasPendingFiles || hasBusyUploads) {
        setToast({ type: "err", msg: "Finish the current uploads before saving." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      setSaveIntent("save");
      const persisted = await persistProgress({
        ...form,
        status: form.status === "final" ? "final" : "draft",
      });
      setForm(persisted);
      setLastPersistedSnapshot(stableStringify(persisted));
      setSubmitted(false);
      await refreshList();
      setToast({ type: "ok", msg: "Saved" });
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

  async function finalizeAndExit() {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      setSubmitted(true);

      if (Object.keys(errors).length > 0 || !doneReady) {
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
      setSaveIntent("done");
      const entryToSave: FdpConducted = {
        ...form,
        status: "final",
        coordinatorName: currentFaculty?.name ?? form.coordinatorName,
        coordinatorEmail: currentFaculty?.email ?? form.coordinatorEmail,
      };
      const response = await fetch("/api/me/fdp-conducted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, entry: entryToSave }),
      });
      const text = await response.text();
      let message = `Save failed (${response.status})`;

      try {
        const payload = text ? (JSON.parse(text) as { error?: string }) : null;
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        // Keep fallback message when the response is not JSON.
      }

      if (!response.ok) {
        throw new Error(message);
      }

      await refreshList();
      if (!isEligibleFuture) {
        setToast({ type: "ok", msg: "Streak activates only for upcoming FDP dates." });
      } else if (needsCompletionFinalization && form.geotaggedPhotos.length > 0) {
        setToast({ type: "ok", msg: "Streak win recorded." });
      } else {
        setToast({ type: "ok", msg: "FDP Conducted saved." });
      }
      setTimeout(() => setToast(null), 1400);
      resetForm();
      setFormOpen(false);
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
    try {
      const response = await fetch("/api/me/fdp-conducted", {
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

  async function requestEdit(entry: FdpConducted) {
    const currentStatus = entry.requestEditStatus ?? "none";
    if (currentStatus === "pending" || requestingEditIds[entry.id]) {
      return;
    }

    const previousList = list;
    const requestedAtISO = new Date().toISOString();
    setRequestingEditIds((current) => ({ ...current, [entry.id]: true }));
    setList((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              requestEditStatus: "pending",
              requestEditRequestedAtISO: requestedAtISO,
              requestEditMessage: "",
            }
          : item
      )
    );

    try {
      const response = await fetch(`/api/me/fdp-conducted/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_edit" }),
      });
      const text = await response.text();
      let message = `Request failed (${response.status})`;
      let updatedEntry: FdpConducted | null = null;

      try {
        const payload = text ? (JSON.parse(text) as FdpConducted & { error?: string }) : null;
        if (payload?.error) {
          message = payload.error;
        }
        if (payload && !payload.error) {
          updatedEntry = payload;
        }
      } catch {
        // Keep fallback message for non-JSON responses.
      }

      if (!response.ok) {
        throw new Error(message);
      }

      if (updatedEntry) {
        setList((current) =>
          current.map((item) => (item.id === entry.id ? updatedEntry ?? item : item))
        );
      }
    } catch (error) {
      setList(previousList);
      const message = error instanceof Error ? error.message : "Request failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setRequestingEditIds((current) => ({ ...current, [entry.id]: false }));
    }
  }

  async function cancelRequestEdit(entry: FdpConducted) {
    const currentStatus = entry.requestEditStatus ?? "none";
    if (currentStatus !== "pending" || requestingEditIds[entry.id]) {
      return;
    }

    const previousList = list;
    setRequestingEditIds((current) => ({ ...current, [entry.id]: true }));
    setList((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              requestEditStatus: "none",
              requestEditRequestedAtISO: null,
              requestEditMessage: "",
            }
          : item
      )
    );

    try {
      const response = await fetch(`/api/me/fdp-conducted/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_request_edit" }),
      });
      const text = await response.text();
      let message = `Cancel request failed (${response.status})`;
      let updatedEntry: FdpConducted | null = null;

      try {
        const payload = text ? (JSON.parse(text) as FdpConducted & { error?: string }) : null;
        if (payload?.error) {
          message = payload.error;
        }
        if (payload && !payload.error) {
          updatedEntry = payload;
        }
      } catch {
        // Keep fallback message for non-JSON responses.
      }

      if (!response.ok) {
        throw new Error(message);
      }

      if (updatedEntry) {
        setList((current) =>
          current.map((item) => (item.id === entry.id ? updatedEntry ?? item : item))
        );
      }
    } catch (error) {
      setList(previousList);
      const message = error instanceof Error ? error.message : "Cancel request failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1800);
    } finally {
      setRequestingEditIds((current) => ({ ...current, [entry.id]: false }));
    }
  }

  function renderLockedRequestAction(entry: FdpConducted) {
    if (!isEntryLocked(entry)) return null;

    const currentStatus = entry.requestEditStatus ?? "none";
    const isRequesting = requestingEditIds[entry.id];
    const canCancelRequest =
      currentStatus === "pending" &&
      isWithinRequestEditWindow(entry.requestEditRequestedAtISO ?? null, 5) &&
      !isRequesting;

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="pointer-events-none inline-flex h-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-border px-3 text-sm opacity-60"
          >
            Request Sent
          </button>
          {canCancelRequest ? (
            <button
              type="button"
              onClick={() => void cancelRequestEdit(entry)}
              className="cursor-pointer text-xs text-muted-foreground underline transition-colors hover:text-foreground"
            >
              Cancel Request
            </button>
          ) : null}
        </div>
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
          <h1 className="text-2xl font-semibold tracking-tight">FDP — Conducted</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record FDPs conducted with duration and the required supporting documents.
          </p>
        </div>

        <div className="flex gap-2">
          {formOpen ? (
            <>
              <MiniButton variant="ghost" onClick={() => void handleCancel()}>
                Cancel
              </MiniButton>
              <MiniButton
                variant="ghost"
                onClick={() => void saveDraftChanges()}
                disabled={saving || loading || hasBusyUploads || hasPendingFiles || !isDirty || isLocked}
              >
                {saving && saveIntent === "save" ? "Saving..." : "Save"}
              </MiniButton>
              <MiniButton
                onClick={() => void handleDone()}
                disabled={saving || loading || hasBusyUploads || hasPendingFiles || !doneReady || isLocked}
              >
                {saving && saveIntent === "done" ? "Saving..." : "Done"}
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
              + Add FDP Entry
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
            title="New FDP Entry"
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
                  onChange={(value) => setForm((current) => ({ ...current, semesterType: value }))}
                  options={SEMESTER_TYPE_DROPDOWN_OPTIONS}
                  placeholder="Select semester type"
                  error={submitted && !!errors.semesterType}
                />
              </Field>

              <Field label="Starting Date" error={submitted ? errors.startDate : undefined}>
                <DateField
                  value={form.startDate}
                  onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
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
                  error={submitted && !!errors.endDate}
                />
              </Field>

              <Field label="Number of Days" hint="Inclusive day count">
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {inclusiveDays ?? "-"}
                </div>
              </Field>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Coordinator: <span className="font-medium text-foreground">{form.coordinatorName || "-"}</span>
            </div>

            <div className="mt-5 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Co-coordinator(s)</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Add co-coordinators only when applicable.
                  </div>
                </div>

                <MiniButton
                  variant="ghost"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      coCoordinators: [...current.coCoordinators, { name: "", email: "" }],
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
                    <div
                      key={`${index}-${value.email || value.name}`}
                      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                    >
                      <div>
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
                      </div>

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

            <div className="mt-5 space-y-4">
              <p className="text-sm text-muted-foreground">Streaks apply only for upcoming FDP dates.</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="text-sm font-semibold">Upload Permission Letter</div>

                  {form.permissionLetter ? (
                    <div className="text-xs text-muted-foreground">
                      <a className="underline" href={form.permissionLetter.url} target="_blank" rel="noreferrer">
                        {form.permissionLetter.fileName}
                      </a>{" "}
                      • {(form.permissionLetter.size / (1024 * 1024)).toFixed(2)} MB •{" "}
                      {new Date(form.permissionLetter.uploadedAt).toLocaleString()}
                    </div>
                  ) : (
                    <div className={cx("text-xs", submitted ? "text-red-600" : "text-muted-foreground")}>
                      {submitted ? errors.permissionLetter || "This upload is mandatory." : "No file uploaded yet."}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {pending.permissionLetter
                      ? `Selected: ${pending.permissionLetter.name}`
                      : form.permissionLetter
                        ? "Uploaded. Choose a new file only if you want to replace."
                        : "Select a file to enable Upload & Save."}
                  </div>

                  {busy.permissionLetter ? (
                    <div className="space-y-2">
                      <ProgressBar value={progress.permissionLetter ?? 0} />
                      <div className="text-xs text-muted-foreground">
                        {progress.permissionLetter ?? 0}% uploading...
                      </div>
                    </div>
                  ) : null}

                  {uploadError.permissionLetter ? (
                    <div className="text-xs text-red-600">{uploadError.permissionLetter}</div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {form.permissionLetter ? (
                      <>
                        <a
                          href={form.permissionLetter.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                        >
                          Preview
                        </a>
                        <MiniButton
                          variant="danger"
                          onClick={() => void deleteSlot("permissionLetter")}
                          disabled={busy.permissionLetter || isLocked}
                        >
                          Delete
                        </MiniButton>
                      </>
                    ) : null}

                    <label
                      className={cx(
                        "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                        busy.permissionLetter || isLocked
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
                          const nextFile = event.target.files?.[0] || null;
                          event.currentTarget.value = "";
                          setPending({ permissionLetter: nextFile });
                          setUploadError({ permissionLetter: null });
                          setProgress({ permissionLetter: 0 });
                        }}
                      />
                    </label>

                    <MiniButton
                      onClick={() => void uploadSlot("permissionLetter")}
                      disabled={!pending.permissionLetter || busy.permissionLetter || isLocked}
                    >
                      {form.permissionLetter && !pending.permissionLetter ? "Uploaded" : "Upload & Save"}
                    </MiniButton>
                  </div>
                </div>

                {geotagVisible ? (
                <MultiPhotoUpload
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
                    setForm(persisted);
                    setLastPersistedSnapshot(stableStringify(persisted));
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
                    setForm(persisted);
                    setLastPersistedSnapshot(stableStringify(persisted));
                    await refreshList();
                  }}
                  uploadEndpoint="/api/me/fdp-conducted-file"
                  email={email}
                  recordId={form.id}
                  slotName="geotaggedPhotos"
                  showRequiredError={submitted && !!errors.geotaggedPhotos}
                  requiredErrorText={errors.geotaggedPhotos}
                  onStatusChange={setPhotoUploadStatus}
                  disabled={isLocked}
                />
                ) : (
                  <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                    Geotagged Photos will be available after the streak is activated.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        ) : null}

        {!loading && !formOpen ? (
          <SectionCard
            title="Saved FDP Conducted Entries"
            subtitle="Your saved records are stored locally and keyed by your signed-in email."
          >
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              <div className="space-y-3">
                {groupedEntries.drafts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Drafts</div>
                    {groupedEntries.drafts.map((entry, index) => {
                      const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
                      const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
                      const showUpdated =
                        !Number.isNaN(createdTime) &&
                        !Number.isNaN(updatedTime) &&
                        Math.abs(updatedTime - createdTime) > 60 * 1000;
                      const entryLocked = isEntryLocked(entry);
                      const editLabel = getNonStreakEditLabel(entry);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`D${index + 1}`}</span>
                                  <div className="text-base font-semibold">{formatFacultyDisplay({
                                    name: entry.coordinatorName,
                                    email: entry.coordinatorEmail,
                                  })}</div>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {entry.coCoordinators.length > 0
                                    ? `Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`
                                    : "No co-coordinators recorded."}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                  {editLabel ? <span>{editLabel}</span> : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <MiniButton onClick={() => openEntry(entry)} disabled={entryLocked}>Edit</MiniButton>
                                <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                                  Delete entry
                                </MiniButton>
                                {renderLockedRequestAction(entry)}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">
                                Academic Year: {entry.academicYear || "-"} {" • "}
                                Semester: {entry.semesterType || "-"} {" • "}
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
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {groupedEntries.pending.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Pending (Streak Activated)</div>
                    {groupedEntries.pending.map((entry, index) => {
                      const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
                      const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
                      const showUpdated =
                        !Number.isNaN(createdTime) &&
                        !Number.isNaN(updatedTime) &&
                        Math.abs(updatedTime - createdTime) > 60 * 1000;

                      const entryLocked = isEntryLocked(entry);
                      const remainingDays = remainingDaysFromDueAtISO(entry.streak.dueAtISO);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`P${index + 1}`}</span>
                                  <FlameStatusIcon tone="gray" />
                                  <div className="text-base font-semibold">{formatFacultyDisplay({
                                    name: entry.coordinatorName,
                                    email: entry.coordinatorEmail,
                                  })}</div>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {entry.coCoordinators.length > 0
                                    ? `Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`
                                    : "No co-coordinators recorded."}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                  <span
                                    className={cx(
                                      "rounded-full px-2 py-0.5 font-medium",
                                      getRemainingDaysChipClass(remainingDays)
                                    )}
                                  >
                                    {remainingDays} days left
                                  </span>
                                  {entryLocked ? <span>Locked</span> : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <MiniButton onClick={() => openEntry(entry)} disabled={entryLocked}>Edit</MiniButton>
                                <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                                  Delete entry
                                </MiniButton>
                                {renderLockedRequestAction(entry)}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">
                                Academic Year: {entry.academicYear || "-"} {" • "}
                                Semester: {entry.semesterType || "-"} {" • "}
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

                      const entryLocked = isEntryLocked(entry);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`C${index + 1}`}</span>
                                  <FlameStatusIcon tone="color" />
                                  <div className="text-base font-semibold">{formatFacultyDisplay({
                                    name: entry.coordinatorName,
                                    email: entry.coordinatorEmail,
                                  })}</div>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {entry.coCoordinators.length > 0
                                    ? `Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`
                                    : "No co-coordinators recorded."}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                  {entryLocked ? <span>Locked</span> : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <MiniButton onClick={() => openEntry(entry)} disabled={entryLocked}>Edit</MiniButton>
                                <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                                  Delete entry
                                </MiniButton>
                                {renderLockedRequestAction(entry)}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">
                                Academic Year: {entry.academicYear || "-"} {" • "}
                                Semester: {entry.semesterType || "-"} {" • "}
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
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {groupedEntries.nonStreak.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Non-Streak Entries</div>
                    {groupedEntries.nonStreak.map((entry, index) => {
                      const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
                      const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
                      const showUpdated =
                        !Number.isNaN(createdTime) &&
                        !Number.isNaN(updatedTime) &&
                        Math.abs(updatedTime - createdTime) > 60 * 1000;

                      const entryLocked = isEntryLocked(entry);
                      const editLabel = getNonStreakEditLabel(entry);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`G${index + 1}`}</span>
                                  <SlashedFireIcon />
                                  <div className="text-base font-semibold">{formatFacultyDisplay({
                                    name: entry.coordinatorName,
                                    email: entry.coordinatorEmail,
                                  })}</div>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {entry.coCoordinators.length > 0
                                    ? `Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`
                                    : "No co-coordinators recorded."}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                  {editLabel ? <span>{editLabel}</span> : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <MiniButton onClick={() => openEntry(entry)} disabled={entryLocked}>Edit</MiniButton>
                                <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                                  Delete entry
                                </MiniButton>
                                {renderLockedRequestAction(entry)}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">
                                Academic Year: {entry.academicYear || "-"} {" • "}
                                Semester: {entry.semesterType || "-"} {" • "}
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
