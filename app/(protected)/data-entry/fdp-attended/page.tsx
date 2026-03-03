"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CurrencyField from "@/components/controls/CurrencyField";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import DateField from "@/components/controls/DateField";
import FinalisationBadge from "@/components/entry/FinalisationBadge";
import SelectDropdown from "@/components/controls/SelectDropdown";
import {
  getEditLockState,
  isEntryLockedState,
  isFutureDatedEntry,
  isWithinRequestEditWindow,
  status as getStreakStatus,
  type StreakState,
} from "@/lib/gamification";

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

type FdpEntryStatus = "completed" | "activated" | "expired" | "none";

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

function getPrePdfFieldsHash(entry: Pick<
  FdpAttended,
  | "academicYear"
  | "semesterType"
  | "startDate"
  | "endDate"
  | "programName"
  | "organisingBody"
  | "supportAmount"
>) {
  return JSON.stringify({
    academicYear: String(entry.academicYear ?? "").trim(),
    semesterType: String(entry.semesterType ?? "").trim(),
    startDate: String(entry.startDate ?? "").trim(),
    endDate: String(entry.endDate ?? "").trim(),
    programName: String(entry.programName ?? "").trim(),
    organisingBody: String(entry.organisingBody ?? "").trim(),
    supportAmount:
      typeof entry.supportAmount === "number" && Number.isFinite(entry.supportAmount) ? entry.supportAmount : null,
  });
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

function getEntryCreatedSortTime(entry: FdpAttended) {
  const createdTime = entry.createdAt ? new Date(entry.createdAt).getTime() : Number.NaN;
  if (!Number.isNaN(createdTime)) return createdTime;

  const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Number.NaN;
  if (!Number.isNaN(updatedTime)) return updatedTime;

  return 0;
}

function getFdpEntryStatus(entry: FdpAttended): FdpEntryStatus {
  const streakStatus = getStreakStatus(entry.streak);

  if (entry.streak.completedAtISO) {
    return "completed";
  }

  if (entry.status === "final" && entry.streak.activatedAtISO) {
    return streakStatus === "expired" ? "expired" : "activated";
  }

  return "none";
}

function isEntryLocked(entry: FdpAttended) {
  if (entry.requestEditStatus === "approved") {
    return false;
  }

  return isEntryLockedState(entry);
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
      <path
        d="M5 5 19 19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
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

function uploadFdpFileXHR(opts: {
  recordId: string;
  slot: "permissionLetter" | "completionCertificate";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { recordId, slot, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/fdp-file", true);

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
    body.set("recordId", recordId);
    body.set("slot", slot);
    body.set("file", file);
    xhr.send(body);
  });
}

type FdpAttendedPageProps = {
  viewEntryId?: string;
};

export function FdpAttendedPage({ viewEntryId }: FdpAttendedPageProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState<"save" | "done" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitAttemptedFinal, setSubmitAttemptedFinal] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [list, setList] = useState<FdpAttended[]>([]);
  const [form, setForm] = useState<FdpAttended>(emptyForm);
  const [lastPersistedSnapshot, setLastPersistedSnapshot] = useState(() => stableStringify(emptyForm()));
  const [pending, setPending] = useState<Record<"permissionLetter" | "completionCertificate", File | null>>({
    permissionLetter: null,
    completionCertificate: null,
  });
  const [requestingEditIds, setRequestingEditIds] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<"permissionLetter" | "completionCertificate", boolean>>({
    permissionLetter: false,
    completionCertificate: false,
  });
  const [progress, setProgress] = useState<Record<"permissionLetter" | "completionCertificate", number>>({
    permissionLetter: 0,
    completionCertificate: 0,
  });
  const [uploadError, setUploadError] = useState<Record<"permissionLetter" | "completionCertificate", string | null>>({
    permissionLetter: null,
    completionCertificate: null,
  });
  const saveLockRef = useRef(false);
  const hasHydratedPdfRef = useRef(false);
  const queryEntryId = searchParams.get("id")?.trim() ?? "";
  const activeEntryId = viewEntryId?.trim() || queryEntryId;
  const isViewMode = !!viewEntryId;
  const viewedEntry = useMemo(
    () => (activeEntryId ? list.find((item) => item.id === activeEntryId) ?? null : null),
    [activeEntryId, list]
  );
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

  const hasPendingFiles = !!pending.permissionLetter || !!pending.completionCertificate;
  const hasBusyUploads = busy.permissionLetter || busy.completionCertificate;
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const prePdfFieldsHash = useMemo(() => getPrePdfFieldsHash(form), [form]);
  const pdfStale = !!form.pdfMeta && !!form.pdfStale;
  const uploadsVisible = !!form.pdfMeta;
  const formDirty = stableStringify(form) !== lastPersistedSnapshot;
  const isLocked = !!form.createdAt && isEntryLocked(form);
  const controlsDisabled = isViewMode || isLocked;
  const generateReady =
    !!form.academicYear &&
    !!form.semesterType &&
    isISODate(form.startDate) &&
    isISODate(form.endDate) &&
    form.endDate >= form.startDate &&
    !!form.programName.trim() &&
    !!form.organisingBody.trim();
  const canGenerate = form.pdfMeta
    ? generateReady && !isLocked && pdfStale
    : generateReady && !isLocked;
  const requiredUploadsComplete = !!form.permissionLetter && !!form.completionCertificate;
  const isComplete = uploadsVisible && generateReady && requiredUploadsComplete;
  const isDirty = formDirty || hasPendingFiles;
  useEffect(() => {
    if (!hasHydratedPdfRef.current) return;
    const nextPdfStale = !!form.pdfMeta && !!form.pdfSourceHash && prePdfFieldsHash !== form.pdfSourceHash;
    if ((form.pdfStale ?? false) === nextPdfStale) return;
    setForm((current) => ({ ...current, pdfStale: nextPdfStale }));
  }, [form.pdfMeta, form.pdfSourceHash, form.pdfStale, prePdfFieldsHash]);
  const groupedEntries = useMemo(() => {
    const indexedEntries = list.map((entry, index) => ({ entry, index }));
    const sortChronologically = (
      left: { entry: FdpAttended; index: number },
      right: { entry: FdpAttended; index: number }
    ) => {
      const leftTime = getEntryCreatedSortTime(left.entry);
      const rightTime = getEntryCreatedSortTime(right.entry);

      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.index - right.index;
    };

    const drafts = indexedEntries
      .filter(({ entry }) => isFutureDatedEntry(entry.startDate, entry.endDate) && entry.status !== "final")
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    const pending = indexedEntries
      .filter(({ entry }) => {
        if (!isFutureDatedEntry(entry.startDate, entry.endDate)) return false;
        if (entry.status !== "final") return false;
        const entryStatus = getFdpEntryStatus(entry);
        return entryStatus === "activated" || entryStatus === "expired";
      })
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    const completed = indexedEntries
      .filter(
        ({ entry }) =>
          isFutureDatedEntry(entry.startDate, entry.endDate) && getFdpEntryStatus(entry) === "completed"
      )
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    const nonStreak = indexedEntries
      .filter(({ entry }) => !isFutureDatedEntry(entry.startDate, entry.endDate))
      .sort(sortChronologically)
      .map(({ entry }) => entry);

    return { drafts, pending, completed, nonStreak };
  }, [list]);

  function resetUploadState() {
    setPending({
      permissionLetter: null,
      completionCertificate: null,
    });
    setBusy({
      permissionLetter: false,
      completionCertificate: false,
    });
    setProgress({
      permissionLetter: 0,
      completionCertificate: 0,
    });
    setUploadError({
      permissionLetter: null,
      completionCertificate: null,
    });
  }

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
    hasHydratedPdfRef.current = false;
    setForm(nextForm);
    setLastPersistedSnapshot(stableStringify(nextForm));
    resetUploadState();
  }

  function hydrateLoadedEntry(entry: FdpAttended) {
    const currentHash = getPrePdfFieldsHash(entry);

    if (!entry.pdfMeta) {
      return {
        ...entry,
        pdfStale: false,
      };
    }

    return {
      ...entry,
      pdfSourceHash: entry.pdfSourceHash || currentHash,
      pdfStale: false,
    };
  }

  function openEntry(entry: FdpAttended) {
    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextEntry = hydrateLoadedEntry(entry);
    hasHydratedPdfRef.current = false;
    setForm(nextEntry);
    setLastPersistedSnapshot(stableStringify(nextEntry));
    resetUploadState();
    setFormOpen(true);
  }

  function closeForm() {
    resetForm();
    setFormOpen(false);
    router.replace(pathname, { scroll: false });
  }

  async function handleCancel() {
    if (hasBusyUploads) {
      setToast({ type: "err", msg: "Please wait for upload to finish." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    closeForm();
  }

  async function handleDone() {
    setSubmitAttemptedFinal(true);

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

    if (!isComplete) {
      setToast({ type: "err", msg: "Complete all required uploads before finishing." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (isLocked) {
      setToast({ type: "err", msg: "This entry is locked." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    if (!isDirty) {
      closeForm();
      return;
    }

    await saveDraftChanges({ closeAfterSave: true, intent: "done" });
  }

  useEffect(() => {
    if (loading) return;
    if (!activeEntryId) return;

    const loadedEntry = list.find((item) => item.id === activeEntryId);
    if (!loadedEntry) return;

    setSubmitted(false);
    setSubmitAttemptedFinal(false);
    const nextEntry = hydrateLoadedEntry(loadedEntry);
    hasHydratedPdfRef.current = false;
    setForm(nextEntry);
    setLastPersistedSnapshot(stableStringify(nextEntry));
    resetUploadState();
    setFormOpen(true);
  }, [activeEntryId, list, loading]);

  useEffect(() => {
    if (!formOpen || isViewMode) return;
    hasHydratedPdfRef.current = true;
  }, [formOpen, isViewMode, form.id]);

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/fdp-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function uploadSlot(slot: "permissionLetter" | "completionCertificate") {
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

      const meta = await uploadFdpFileXHR({
        recordId: form.id,
        slot,
        file,
        onProgress: (pct) => setProgress((current) => ({ ...current, [slot]: pct })),
      });

      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void deleteStoredFile(previousMeta.storedPath);
      }

      const nextForm =
        slot === "permissionLetter"
          ? {
              ...form,
              permissionLetter: meta,
            }
          : {
              ...form,
              completionCertificate: meta,
            };

      const persisted = await persistProgress(nextForm);

      setForm(persisted);
      setPending((current) => ({ ...current, [slot]: null }));
      setBusy((current) => ({ ...current, [slot]: false }));
      setProgress((current) => ({ ...current, [slot]: 100 }));
      await refreshList();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setBusy((current) => ({ ...current, [slot]: false }));
      setUploadError((current) => ({ ...current, [slot]: message }));
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
      const response = await fetch("/api/me/fdp-file", {
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

  async function saveDraftChanges(options?: { closeAfterSave?: boolean; intent?: "save" | "done" }) {
    if (saveLockRef.current || !isDirty || isLocked) return;
    saveLockRef.current = true;

    try {
      if (hasPendingFiles || hasBusyUploads) {
        setToast({ type: "err", msg: "Finish the current uploads before saving." });
        setTimeout(() => setToast(null), 1800);
        return;
      }

      setSaving(true);
      setSaveIntent(options?.intent ?? "save");
      const persisted = await persistProgress({
        ...form,
        status: form.status === "final" ? "final" : "draft",
      });
      setForm(persisted);
      setLastPersistedSnapshot(stableStringify(persisted));
      setSubmitted(false);
      setSubmitAttemptedFinal(false);
      await refreshList();
      if (options?.closeAfterSave) {
        closeForm();
        setToast({ type: "ok", msg: "Saved" });
      } else {
        setToast({ type: "ok", msg: "Saved" });
      }
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

  async function generateEntry() {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      setSubmitted(true);

      if (Object.keys(errors).length > 0 || !canGenerate) {
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
        pdfStale,
        pdfSourceHash: form.pdfSourceHash || "",
      };
      const persisted = await persistProgress(draftEntry);
      const response = await fetch(`/api/me/fdp-attended/${encodeURIComponent(persisted.id)}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const text = await response.text();
      let message = `Save failed (${response.status})`;
      let payload: { entry?: FdpAttended; error?: string } | null = null;

      try {
        payload = text ? (JSON.parse(text) as { entry?: FdpAttended; error?: string }) : null;
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        // Ignore parse failures and keep fallback message.
      }

      if (!response.ok) {
        throw new Error(message);
      }

      const nextEntry = {
        ...(payload?.entry ?? persisted),
        pdfSourceHash: prePdfFieldsHash,
        pdfStale: false,
      };
      setForm(nextEntry);
      setLastPersistedSnapshot(stableStringify(nextEntry));
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

      setList((current) => current.filter((item) => item.id !== id));
      if (activeEntryId === id) {
        closeForm();
      }
      setToast({ type: "ok", msg: "Entry deleted." });
      setTimeout(() => setToast(null), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), 1500);
    }
  }

  async function requestEdit(entry: FdpAttended) {
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
      const response = await fetch(`/api/me/fdp-attended/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_edit" }),
      });
      const text = await response.text();
      let message = `Request failed (${response.status})`;
      let updatedEntry: FdpAttended | null = null;

      try {
        const payload = text ? (JSON.parse(text) as FdpAttended & { error?: string }) : null;
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

  async function cancelRequestEdit(entry: FdpAttended) {
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
      const response = await fetch(`/api/me/fdp-attended/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_request_edit" }),
      });
      const text = await response.text();
      let message = `Cancel request failed (${response.status})`;
      let updatedEntry: FdpAttended | null = null;

      try {
        const payload = text ? (JSON.parse(text) as FdpAttended & { error?: string }) : null;
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

  function renderLockedRequestAction(entry: FdpAttended) {
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
          <h1 className="text-2xl font-semibold tracking-tight">FDP — Attended</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record faculty development programmes attended, along with support amount and the two required supporting documents.
          </p>
        </div>

        <div className="flex gap-2">
          {showForm && !isViewMode ? (
            <>
              <MiniButton
                variant="ghost"
                onClick={() => void handleCancel()}
                disabled={isViewMode || saving || loading || hasBusyUploads || isComplete}
              >
                Cancel
              </MiniButton>
              <MiniButton
                variant="ghost"
                onClick={() => void saveDraftChanges()}
                disabled={isViewMode || saving || loading || hasBusyUploads || !isDirty || isComplete || isLocked}
              >
                {saving && saveIntent === "save" ? "Saving..." : "Save"}
              </MiniButton>
              <MiniButton
                onClick={() => void handleDone()}
                disabled={isViewMode || saving || loading || hasBusyUploads || !isComplete || isLocked}
              >
                {saving && saveIntent === "done" ? "Saving..." : "Done"}
              </MiniButton>
            </>
          ) : !showForm ? (
            <MiniButton
              onClick={() => {
                resetForm();
                setFormOpen(true);
                router.replace(pathname, { scroll: false });
              }}
              disabled={loading}
            >
              + Add FDP Entry
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
            title={isViewMode ? "FDP Entry" : "New FDP Entry"}
            subtitle="Add the entry details and upload the required documents."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Academic Year" error={submitted ? errors.academicYear : undefined}>
                <SelectDropdown
                  value={form.academicYear}
                  onChange={(value) => setForm((current) => ({ ...current, academicYear: value }))}
                  options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
                  placeholder="Select academic year"
                  disabled={controlsDisabled}
                  error={submitted && !!errors.academicYear}
                />
              </Field>

              <Field label="Semester Type" error={submitted ? errors.semesterType : undefined}>
                <SelectDropdown
                  value={form.semesterType}
                  onChange={(value) => setForm((current) => ({ ...current, semesterType: value }))}
                  options={SEMESTER_TYPE_DROPDOWN_OPTIONS}
                  placeholder="Select semester type"
                  disabled={controlsDisabled}
                  error={submitted && !!errors.semesterType}
                />
              </Field>

              <Field label="Starting Date" error={submitted ? errors.startDate : undefined}>
                <DateField
                  value={form.startDate}
                  onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
                  disabled={controlsDisabled}
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
                  disabled={controlsDisabled}
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
                  disabled={controlsDisabled}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    submitted && errors.programName ? "border-red-300" : "border-border",
                    controlsDisabled && "cursor-not-allowed opacity-60"
                  )}
                />
              </Field>

              <Field label="Name of the Organising Body" error={submitted ? errors.organisingBody : undefined}>
                <input
                  value={form.organisingBody}
                  onChange={(event) => setForm((current) => ({ ...current, organisingBody: event.target.value }))}
                  disabled={controlsDisabled}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    submitted && errors.organisingBody ? "border-red-300" : "border-border",
                    controlsDisabled && "cursor-not-allowed opacity-60"
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
                  disabled={controlsDisabled}
                  error={submitted && !!errors.supportAmount}
                  placeholder="15000"
                />
              </Field>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {!isViewMode ? (
                  <MiniButton
                    onClick={() => void generateEntry()}
                    disabled={saving || loading || hasBusyUploads || !canGenerate}
                  >
                    {saving && saveIntent === "save" ? "Generating..." : "Generate Entry"}
                  </MiniButton>
                ) : null}
                <EntryPdfActions pdfMeta={form.pdfMeta ?? null} disabled={pdfStale} />
              </div>
              {pdfStale ? (
                <p className="text-sm text-muted-foreground">
                  Entry changed. Regenerate PDF to update Preview/Download.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">Streaks apply only for upcoming FDP dates.</p>
              {uploadsVisible ? (
              <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["permissionLetter", "Upload Permission Letter"],
                  ["completionCertificate", "Upload Completion Certificate"],
                ] as const
              ).map(([slot, label]) => {
                const meta = form[slot];
                const pendingFile = pending[slot];
                const slotBusy = busy[slot];
                const slotProgress = progress[slot] ?? 0;
                const slotError = uploadError[slot];
                const showUploaded = !!meta && !pendingFile;
                const canUploadAndSave = !!pendingFile && !slotBusy && !isLocked && !isViewMode;

                return (
                  <div key={slot} className="space-y-3 rounded-xl border border-border p-4">
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
                            {submitAttemptedFinal ? errors[slot] || "This upload is mandatory." : "No file uploaded yet."}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          {pendingFile
                            ? `Selected: ${pendingFile.name}`
                            : meta
                              ? "Uploaded. Choose a new file and upload to replace it."
                              : "Select a file to enable Upload & Save."}
                        </div>

                        {slotBusy ? (
                          <div className="space-y-2">
                            <ProgressBar value={slotProgress} />
                            <div className="text-xs text-muted-foreground">{slotProgress}% uploading...</div>
                          </div>
                        ) : null}

                        {slotError ? <div className="text-xs text-red-600">{slotError}</div> : null}

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
                              <MiniButton variant="danger" onClick={() => void deleteSlot(slot)} disabled={slotBusy || isLocked}>
                                Delete
                              </MiniButton>
                            </>
                          ) : null}

                          <label
                            className={cx(
                              "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                              slotBusy || isLocked
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
                                const nextFile = event.target.files?.[0] || null;
                                event.currentTarget.value = "";
                                setPending((current) => ({ ...current, [slot]: nextFile }));
                                setUploadError((current) => ({ ...current, [slot]: null }));
                                setProgress((current) => ({ ...current, [slot]: 0 }));
                              }}
                            />
                          </label>

                          <MiniButton onClick={() => void uploadSlot(slot)} disabled={!canUploadAndSave}>
                            {showUploaded ? "Uploaded" : "Upload & Save"}
                          </MiniButton>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
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
                      const lockState = getEditLockState(entry);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`D${index + 1}`}</span>
                                  <Link href={`/data-entry/fdp-attended/${entry.id}`} className="text-base font-semibold hover:opacity-80">
                                    {entry.programName}
                                  </Link>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                </div>
                              </div>

                              {!(activeEntryId && entry.id === activeEntryId) ? (
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <FinalisationBadge lockState={lockState} />
                                  <div className="flex items-center gap-2">
                                    {entry.pdfMeta?.url ? (
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
                                    )}
                                    {renderLockedRequestAction(entry)}
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

                      const lockState = getEditLockState(entry);
                      const entryLocked = isEntryLocked(entry);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`P${index + 1}`}</span>
                                  <FlameStatusIcon tone="gray" />
                                  <Link href={`/data-entry/fdp-attended/${entry.id}`} className="text-base font-semibold hover:opacity-80">
                                    {entry.programName}
                                  </Link>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                </div>
                              </div>

                              {!(activeEntryId && entry.id === activeEntryId) ? (
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <FinalisationBadge lockState={lockState} />
                                  <div className="flex items-center gap-2">
                                    <MiniButton
                                      onClick={() => {
                                        openEntry(entry);
                                        router.push(`${pathname}?id=${entry.id}`, { scroll: false });
                                      }}
                                      disabled={entryLocked}
                                    >
                                      Edit
                                    </MiniButton>
                                    <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                                      Delete entry
                                    </MiniButton>
                                    {renderLockedRequestAction(entry)}
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

                      const lockState = getEditLockState(entry);
                      const entryLocked = isEntryLocked(entry);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`C${index + 1}`}</span>
                                  <FlameStatusIcon tone="color" />
                                  <Link href={`/data-entry/fdp-attended/${entry.id}`} className="text-base font-semibold hover:opacity-80">
                                    {entry.programName}
                                  </Link>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                </div>
                              </div>

                              {!(activeEntryId && entry.id === activeEntryId) ? (
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <FinalisationBadge lockState={lockState} />
                                  <div className="flex items-center gap-2">
                                    <MiniButton
                                      onClick={() => {
                                        openEntry(entry);
                                        router.push(`${pathname}?id=${entry.id}`, { scroll: false });
                                      }}
                                      disabled={entryLocked}
                                    >
                                      Edit
                                    </MiniButton>
                                    <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                                      Delete entry
                                    </MiniButton>
                                    {renderLockedRequestAction(entry)}
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

                      const lockState = getEditLockState(entry);
                      const entryLocked = isEntryLocked(entry);

                      return (
                        <div key={entry.id} className="rounded-xl border border-border p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{`G${index + 1}`}</span>
                                  <SlashedFireIcon />
                                  <Link href={`/data-entry/fdp-attended/${entry.id}`} className="text-base font-semibold hover:opacity-80">
                                    {entry.programName}
                                  </Link>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span>Added: {formatEntryTimestamp(entry.createdAt)}</span>
                                  {showUpdated ? <span>Updated: {formatEntryTimestamp(entry.updatedAt)}</span> : null}
                                </div>
                              </div>

                              {!(activeEntryId && entry.id === activeEntryId) ? (
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <FinalisationBadge lockState={lockState} />
                                  <div className="flex items-center gap-2">
                                    <MiniButton
                                      onClick={() => {
                                        openEntry(entry);
                                        router.push(`${pathname}?id=${entry.id}`, { scroll: false });
                                      }}
                                      disabled={entryLocked}
                                    >
                                      Edit
                                    </MiniButton>
                                    <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)} disabled={entryLocked}>
                                      Delete entry
                                    </MiniButton>
                                    {renderLockedRequestAction(entry)}
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
