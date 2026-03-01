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

type FdpAttended = {
  id: string;
  programName: string;
  organisingBody: string;
  supportAmount: number | null;
  permissionLetter: FileMeta | null;
  completionCertificate: FileMeta | null;
  createdAt: string;
  updatedAt: string;
};

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
    programName: "",
    organisingBody: "",
    supportAmount: null,
    permissionLetter: null,
    completionCertificate: null,
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

export default function FdpAttendedPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [list, setList] = useState<FdpAttended[]>([]);
  const [form, setForm] = useState<FdpAttended>(emptyForm);
  const [pending, setPending] = useState<Record<"permissionLetter" | "completionCertificate", File | null>>({
    permissionLetter: null,
    completionCertificate: null,
  });
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

    if (!form.permissionLetter) {
      nextErrors.permissionLetter = "Permission letter is mandatory.";
    }

    if (!form.completionCertificate) {
      nextErrors.completionCertificate = "Completion certificate is mandatory.";
    }

    return nextErrors;
  }, [form]);

  const hasPendingFiles = !!pending.permissionLetter || !!pending.completionCertificate;
  const hasBusyUploads = busy.permissionLetter || busy.completionCertificate;
  const canSave = Object.keys(errors).length === 0 && !saving && !loading && !hasBusyUploads && !hasPendingFiles;

  function resetForm() {
    setForm(emptyForm());
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
      const response = await fetch("/api/me/fdp-attended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: form }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Save failed.");
      }

      const listResponse = await fetch("/api/me/fdp-attended", { cache: "no-store" });
      const items = await listResponse.json();
      if (!listResponse.ok) {
        throw new Error(items?.error || "Failed to refresh saved entries.");
      }

      setList(Array.isArray(items) ? (items as FdpAttended[]) : []);
      setToast({ type: "ok", msg: "FDP Attended saved." });
      setTimeout(() => setToast(null), 1400);
      resetForm();
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
          <h1 className="text-2xl font-semibold tracking-tight">FDP — Attended</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill the details and upload both documents to save.
          </p>
        </div>

        <div className="flex gap-2">
          <MiniButton variant="ghost" onClick={resetForm} disabled={saving || loading || hasBusyUploads}>
            Clear
          </MiniButton>
          <MiniButton onClick={() => void saveEntry()} disabled={!canSave}>
            {saving ? "Saving..." : "Save"}
          </MiniButton>
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

        {!loading ? (
          <SectionCard
            title="New FDP Entry"
            subtitle="Mandatory: program name, organising body, permission letter, completion certificate."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name of the Faculty Development Program" error={errors.programName}>
                <input
                  value={form.programName}
                  onChange={(event) => setForm((current) => ({ ...current, programName: event.target.value }))}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    errors.programName ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="Name of the Organising Body" error={errors.organisingBody}>
                <input
                  value={form.organisingBody}
                  onChange={(event) => setForm((current) => ({ ...current, organisingBody: event.target.value }))}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    errors.organisingBody ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="Amount of Support (₹) — optional" error={errors.supportAmount} hint="Numbers only">
                <div className="flex overflow-hidden rounded-lg border border-border">
                  <div className="border-r border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">₹</div>
                  <input
                    inputMode="numeric"
                    value={form.supportAmount === null ? "" : String(form.supportAmount)}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "");
                      setForm((current) => ({
                        ...current,
                        supportAmount: digits === "" ? null : Number(digits),
                      }));
                    }}
                    className="w-full bg-background px-3 py-2 text-sm"
                    placeholder="e.g., 15000"
                  />
                </div>
              </Field>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                const canUploadAndSave = !!pendingFile && !slotBusy && !showUploaded;

                return (
                  <div key={slot} className="space-y-3 rounded-xl border border-border p-4">
                    <div className="text-sm font-semibold">{label}</div>

                    {meta ? (
                      <div className="text-xs text-muted-foreground">
                        <a className="underline" href={meta.url} target="_blank">
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

                      <MiniButton
                        onClick={() => void uploadSlot(slot)}
                        disabled={!canUploadAndSave}
                      >
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
            title="Saved FDP Attended Entries"
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
                        <div className="text-sm font-semibold">{entry.programName}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{entry.organisingBody}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Support:{" "}
                          <span className="font-medium text-foreground">
                            {typeof entry.supportAmount === "number" ? `₹${entry.supportAmount}` : "-"}
                          </span>
                          {" • "}
                          Updated: {new Date(entry.updatedAt).toLocaleString()}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {entry.permissionLetter ? (
                            <a className="underline" href={entry.permissionLetter.url} target="_blank">
                              Permission Letter
                            </a>
                          ) : null}
                          {entry.completionCertificate ? (
                            <a className="underline" href={entry.completionCertificate.url} target="_blank">
                              Completion Certificate
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
