"use client";

import { useState } from "react";
import { MiniButton, ProgressBar } from "./AccountUI";
import { uploadCertificateXHR } from "./uploadHelpers";
import {
  cx,
  getErrorMessage,
  type FileMeta,
} from "./types";

type CertificateBlockProps = {
  category: "academicOutsideTCE" | "industry";
  entryId: string;
  certificate: FileMeta | null | undefined;
  certErrorKey: string;
  errors: Record<string, string>;
  shouldShowError: (key: string) => boolean;
  onCertificateChange: (meta: FileMeta | null) => Promise<void>;
};

export default function CertificateBlock({
  category,
  entryId,
  certificate,
  certErrorKey,
  errors,
  shouldShowError,
  onCertificateChange,
}: CertificateBlockProps) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleDelete() {
    try {
      if (!certificate?.storedPath) {
        setLocalError("File path missing. Re-upload the certificate once.");
        return;
      }

      const r = await fetch("/api/me/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: certificate.storedPath }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Delete failed");

      setPendingFile(null);
      setProgress(0);
      setBusy(false);
      setLocalError(null);

      await onCertificateChange(null);
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error, "Delete failed."));
    }
  }

  async function handleUpload() {
    if (!pendingFile) {
      setLocalError("Select a file first.");
      return;
    }

    const max = 20 * 1024 * 1024;
    const allowed =
      pendingFile.type === "application/pdf" || pendingFile.type === "image/png" || pendingFile.type === "image/jpeg";

    if (!allowed) {
      setLocalError("Only PDF/JPG/PNG allowed.");
      return;
    }
    if (pendingFile.size > max) {
      setLocalError("Max file size is 20MB.");
      return;
    }

    try {
      setLocalError(null);
      setBusy(true);
      setProgress(0);

      const meta = await uploadCertificateXHR({
        category,
        entryId,
        file: pendingFile,
        onProgress: (pct) => setProgress(pct),
      });

      setPendingFile(null);
      setBusy(false);
      setProgress(100);

      await onCertificateChange(meta);
    } catch (error: unknown) {
      setBusy(false);
      setLocalError(getErrorMessage(error, "Upload failed."));
    }
  }

  const canUploadAndSave = !busy && !!pendingFile;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Certificate (mandatory)</div>

          {certificate ? (
            <div className="mt-1 text-xs text-muted-foreground">
              <a className="underline" href={certificate.url} target="_blank">
                {certificate.fileName}
              </a>{" "}
              • {new Date(certificate.uploadedAt).toLocaleString()}
            </div>
          ) : shouldShowError(certErrorKey) ? (
            <div className="mt-1 text-xs text-red-600">{errors[certErrorKey] || "Certificate is mandatory."}</div>
          ) : null}

          <div className="mt-2 text-xs text-muted-foreground">
            {pendingFile ? `Selected: ${pendingFile.name}` : "Select a file to enable Upload & Save."}
          </div>

          {busy ? (
            <div className="mt-2 space-y-2">
              <ProgressBar value={progress} />
              <div className="text-xs text-muted-foreground">{progress}% uploading…</div>
            </div>
          ) : null}

          {localError ? <div className="mt-2 text-xs text-red-600">{localError}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {certificate ? (
            <MiniButton variant="danger" onClick={() => void handleDelete()} disabled={busy}>
              Delete Certificate
            </MiniButton>
          ) : null}

          <label
            className={cx(
              "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
              busy
                ? "pointer-events-none cursor-not-allowed opacity-60"
                : "cursor-pointer transition hover:bg-muted"
            )}
          >
            Choose file
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                e.currentTarget.value = "";
                setPendingFile(f);
                setLocalError(null);
                setProgress(0);
              }}
            />
          </label>

          <MiniButton
            onClick={() => void handleUpload()}
            disabled={!canUploadAndSave}
          >
            Upload & Save
          </MiniButton>
        </div>
      </div>
    </div>
  );
}
