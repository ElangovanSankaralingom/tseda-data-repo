"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type FacultyOption = {
  name: string;
  email: string;
};

type FacultySelection = {
  name: string;
  email: string;
};

type FdpConducted = {
  id: string;
  startDate: string;
  endDate: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultySelection[];
  permissionLetter: FileMeta | null;
  geotaggedPhoto: FileMeta | null;
  createdAt: string;
  updatedAt: string;
};

const FACULTY_OPTIONS: FacultyOption[] = [
  { name: "Dr. G. Balaji", email: "gbarch@tce.edu" },
  { name: "Dr.J.Jinu Louishidha Kitchley", email: "jinujoshua@tce.edu" },
  { name: "Ar. S. Karthikeya Raja", email: "skrarch@tce.edu" },
  { name: "Dr. I. Chandramathy", email: "cmarch@tce.edu" },
  { name: "Ar. P. Vivek", email: "pvkarch@tce.edu" },
  { name: "Ar. S. Thangalavanya", email: "lavanya_arch@tce.edu" },
  { name: "Ar. M. Sindhuja", email: "crissindhu@tce.edu" },
  { name: "Ar. R. Jeyabalaji", email: "ajarch@tce.edu" },
  { name: "Dr. R. Meena Kumari", email: "rmiarch@tce.edu" },
  { name: "Ar. U. Vijay Anand", email: "uvaarch@tce.edu" },
  { name: "Mr. R. Vinoth Kumar", email: "rvkarch@tce.edu" },
  { name: "Ar. A. Ayswarya", email: "aaarch@tce.edu" },
  { name: "Ar. P. Pavalavelsh", email: "ppharch@tce.edu" },
  { name: "Ar. S. M. Vidhya Sankari", email: "smvsarch@tce.edu" },
  { name: "Ar. C. Piraiarasi", email: "cparch@tce.edu" },
  { name: "Ar. S. Elangovan", email: "senarch@tce.edu" },
  { name: "Ar.G.Vaishali", email: "gviarch@tce.edu" },
  { name: "Ar. M. Lekshmi Shunnma", email: "mlsarch@tce.edu" },
  { name: "Ar. M. Vishal", email: "mvlarch@tce.edu" },
  { name: "Ms. S. Anu", email: "saarch@tce.edu" },
  { name: "Ar. D. Gokul", email: "dglarch@tce.edu" },
  { name: "Ar. A. Geo", email: "agarch@tce.edu" },
  { name: "Ar. Divya Raveendran", email: "drnarch@tce.edu" },
  { name: "Ar. R. Prathiksha", email: "rpaarch@tce.edu" },
  { name: "Ar. SV. Lakshmipriya", email: "svlarch@tce.edu" },
  { name: "Ar. R. Roshma", email: "rrarch@tce.edu" },
  { name: "Ar. A. Akeel Alawdeen Kamal", email: "aakarch@tce.edu" },
  { name: "Ar. R. Saravana Raja", email: "rsrarch@tce.edu" },
  { name: "Ar. Gayathri Suresh", email: "gsharch@tce.edu" },
  { name: "Ar. S. Aravind Roshan", email: "sararch@tce.edu" },
  { name: "Ar. S. Sindhu", email: "ssuarch@tce.edu" },
  { name: "Dr. G. Sooraj", email: "gsjarch@tce.edu" },
];

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

function formatFacultyDisplay(selection: FacultySelection) {
  if (!selection.name) return "";
  return selection.name;
}

function emptyForm(): FdpConducted {
  return {
    id: uuid(),
    startDate: "",
    endDate: "",
    coordinatorName: "",
    coordinatorEmail: "",
    coCoordinators: [],
    permissionLetter: null,
    geotaggedPhoto: null,
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

function FacultySelect({
  value,
  onChange,
  options,
  disabledEmails,
  placeholder,
}: {
  value: FacultySelection;
  onChange: (next: FacultySelection) => void;
  options: FacultyOption[];
  disabledEmails: Set<string>;
  placeholder?: string;
}) {
  const normalizedValueEmail = value.email.toLowerCase();
  const knownCurrent = !!normalizedValueEmail && options.some((option) => option.email === normalizedValueEmail);
  const currentFallbackValue = !knownCurrent && (value.name || value.email) ? "__current__" : "";

  return (
    <select
      value={knownCurrent ? normalizedValueEmail : currentFallbackValue}
      onChange={(event) => {
        if (!event.target.value) {
          onChange({ name: "", email: "" });
          return;
        }

        if (event.target.value === "__current__") {
          onChange(value);
          return;
        }

        const selected = options.find((option) => option.email === event.target.value);
        if (selected) {
          onChange({ name: selected.name, email: selected.email });
        }
      }}
      className={cx(
        "w-full rounded-lg border px-3 py-2 text-sm",
        value.name || value.email ? "border-border" : "border-border text-muted-foreground"
      )}
    >
      <option value="">{placeholder ?? "Select faculty"}</option>
      {currentFallbackValue ? <option value="__current__">{value.name || value.email}</option> : null}
      {options.map((option) => (
        <option key={option.email} value={option.email} disabled={disabledEmails.has(option.email.toLowerCase())}>
          {option.name}
        </option>
      ))}
    </select>
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
  const base = "rounded-lg border px-3 py-2 text-sm";
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

function uploadConductedFileXHR(opts: {
  email: string;
  recordId: string;
  slot: "permissionLetter" | "geotaggedPhoto";
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
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [email, setEmail] = useState("");
  const [list, setList] = useState<FdpConducted[]>([]);
  const [form, setForm] = useState<FdpConducted>(emptyForm);
  const [pending, setPending] = useState<Record<"permissionLetter" | "geotaggedPhoto", File | null>>({
    permissionLetter: null,
    geotaggedPhoto: null,
  });
  const [busy, setBusy] = useState<Record<"permissionLetter" | "geotaggedPhoto", boolean>>({
    permissionLetter: false,
    geotaggedPhoto: false,
  });
  const [progress, setProgress] = useState<Record<"permissionLetter" | "geotaggedPhoto", number>>({
    permissionLetter: 0,
    geotaggedPhoto: 0,
  });
  const [uploadError, setUploadError] = useState<Record<"permissionLetter" | "geotaggedPhoto", string | null>>({
    permissionLetter: null,
    geotaggedPhoto: null,
  });
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

    if (!isISODate(form.startDate)) {
      nextErrors.startDate = "Starting date is required.";
    }

    if (!isISODate(form.endDate)) {
      nextErrors.endDate = "Ending date is required.";
    } else if (isISODate(form.startDate) && form.endDate < form.startDate) {
      nextErrors.endDate = "Ending date must be on or after starting date.";
    }

    if (form.coordinatorName.trim().length === 0) {
      nextErrors.coordinator = "Coordinator is required.";
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

    if (form.coordinatorEmail && (emailCounts.get(form.coordinatorEmail.toLowerCase()) ?? 0) > 1) {
      nextErrors.coordinator = "This faculty is already selected in another role.";
    }

    form.coCoordinators.forEach((value, index) => {
      if (value.email && (emailCounts.get(value.email.toLowerCase()) ?? 0) > 1) {
        nextErrors[`coCoordinators.${index}`] = "This faculty is already selected in another role.";
      }
    });

    if (!form.permissionLetter) {
      nextErrors.permissionLetter = "Permission letter is mandatory.";
    }

    if (!form.geotaggedPhoto) {
      nextErrors.geotaggedPhoto = "Geotagged photo is mandatory.";
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
  const hasPendingFiles = !!pending.permissionLetter || !!pending.geotaggedPhoto;
  const hasBusyUploads = busy.permissionLetter || busy.geotaggedPhoto;
  const canSave = Object.keys(errors).length === 0 && !saving && !loading && !hasBusyUploads && !hasPendingFiles;

  const disabledForCoordinator = useMemo(() => {
    const next = new Set(selectedEmails);
    if (form.coordinatorEmail) {
      next.delete(form.coordinatorEmail.toLowerCase());
    }
    return next;
  }, [form.coordinatorEmail, selectedEmails]);

  function getDisabledForCoCoordinatorRow(index: number) {
    const next = new Set(selectedEmails);
    const currentEmail = form.coCoordinators[index]?.email?.toLowerCase();

    if (currentEmail) {
      next.delete(currentEmail);
    }

    return next;
  }

  function resetForm() {
    setForm(emptyForm());
    setPending({
      permissionLetter: null,
      geotaggedPhoto: null,
    });
    setBusy({
      permissionLetter: false,
      geotaggedPhoto: false,
    });
    setProgress({
      permissionLetter: 0,
      geotaggedPhoto: 0,
    });
    setUploadError({
      permissionLetter: null,
      geotaggedPhoto: null,
    });
  }

  function closeForm() {
    resetForm();
    setFormOpen(false);
  }

  async function refreshList() {
    const response = await fetch(`/api/me/fdp-conducted?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    const items = await response.json();

    if (!response.ok) {
      throw new Error(items?.error || "Failed to refresh saved entries.");
    }

    setList(Array.isArray(items) ? (items as FdpConducted[]) : []);
  }

  async function deleteStoredFile(storedPath: string) {
    await fetch("/api/me/fdp-conducted-file", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storedPath }),
    }).catch(() => null);
  }

  async function uploadSlot(slot: "permissionLetter" | "geotaggedPhoto") {
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

  async function deleteSlot(slot: "permissionLetter" | "geotaggedPhoto") {
    const meta = form[slot];
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
      const response = await fetch("/api/me/fdp-conducted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, entry: form }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Save failed.");
      }

      await refreshList();
      setToast({ type: "ok", msg: "FDP Conducted saved." });
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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">FDP — Conducted</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record FDPs conducted with coordinator details, duration, and the required supporting documents.
          </p>
        </div>

        <div className="flex gap-2">
          {formOpen ? (
            <>
              <MiniButton variant="ghost" onClick={closeForm} disabled={saving || loading || hasBusyUploads}>
                Cancel
              </MiniButton>
              <MiniButton onClick={() => void saveEntry()} disabled={!canSave}>
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
            subtitle="Mandatory: dates, coordinator, permission letter, and geotagged photo."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starting Date" error={errors.startDate}>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    errors.startDate ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="Ending Date" error={errors.endDate} hint={inclusiveDays ? `Days: ${inclusiveDays}` : undefined}>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    errors.endDate ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="Number of Days" hint="Inclusive day count">
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {inclusiveDays ?? "-"}
                </div>
              </Field>

              <Field label="Coordinator" error={errors.coordinator}>
                <FacultySelect
                  value={{
                    name: form.coordinatorName,
                    email: form.coordinatorEmail,
                  }}
                  onChange={(next) =>
                    setForm((current) => ({
                      ...current,
                      coordinatorName: next.name,
                      coordinatorEmail: next.email,
                    }))
                  }
                  options={FACULTY_OPTIONS}
                  disabledEmails={disabledForCoordinator}
                  placeholder="Select coordinator"
                />
              </Field>
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

              {errors.coCoordinators ? (
                <div className="mt-2 text-xs text-red-600">{errors.coCoordinators}</div>
              ) : null}

              {form.coCoordinators.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {form.coCoordinators.map((value, index) => (
                    <div
                      key={`${index}-${value.email || value.name}`}
                      className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    >
                      <div className="flex-1">
                        <Field label={`Co-coordinator ${index + 1}`} error={errors[`coCoordinators.${index}`]}>
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
                            placeholder="Select co-coordinator"
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

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["permissionLetter", "Upload Permission Letter"],
                  ["geotaggedPhoto", "Upload Geotagged Photo"],
                ] as const
              ).map(([slot, label]) => {
                const meta = form[slot];
                const pendingFile = pending[slot];
                const slotBusy = busy[slot];
                const slotProgress = progress[slot] ?? 0;
                const slotError = uploadError[slot];
                const showUploaded = !!meta && !pendingFile;
                const canUploadAndSave = !!pendingFile && !slotBusy && !showUploaded;

                return (
                  <div key={slot} className="space-y-3 rounded-xl border border-border p-4">
                    <div className="text-sm font-semibold">{label}</div>

                    {meta ? (
                      <div className="text-xs text-muted-foreground">
                        <a className="underline" href={meta.url} target="_blank" rel="noreferrer">
                          {meta.fileName}
                        </a>{" "}
                        • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
                      </div>
                    ) : (
                      <div className="text-xs text-red-600">
                        {errors[slot] || "This upload is mandatory."}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {pendingFile
                        ? `Selected: ${pendingFile.name}`
                        : meta
                        ? "Uploaded. Choose a new file only if you want to replace."
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
                          <MiniButton variant="danger" onClick={() => void deleteSlot(slot)} disabled={slotBusy}>
                            Delete
                          </MiniButton>
                        </>
                      ) : null}

                      <label
                        className={cx(
                          "rounded-lg border border-border px-3 py-2 text-sm",
                          slotBusy
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
                  </div>
                );
              })}
            </div>
          </SectionCard>
        ) : null}

        {!loading ? (
          <SectionCard
            title="Saved FDP Conducted Entries"
            subtitle="Your saved records are stored locally and keyed by your signed-in email."
          >
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              <div className="space-y-3">
                {list.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {formatFacultyDisplay({
                            name: entry.coordinatorName,
                            email: entry.coordinatorEmail,
                          })}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {entry.coCoordinators.length > 0
                            ? `Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`
                            : "No co-coordinators recorded."}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Start: {formatDisplayDate(entry.startDate)} {" • "}
                          End: {formatDisplayDate(entry.endDate)} {" • "}
                          Days: {getInclusiveDays(entry.startDate, entry.endDate) ?? "-"}
                          {" • "}
                          Updated: {new Date(entry.updatedAt).toLocaleString()}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {entry.permissionLetter ? (
                            <a className="underline" href={entry.permissionLetter.url} target="_blank" rel="noreferrer">
                              Permission Letter
                            </a>
                          ) : null}
                          {entry.geotaggedPhoto ? (
                            <a className="underline" href={entry.geotaggedPhoto.url} target="_blank" rel="noreferrer">
                              Geotagged Photo
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <MiniButton variant="danger" onClick={() => void deleteEntry(entry.id)}>
                        Delete entry
                      </MiniButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
