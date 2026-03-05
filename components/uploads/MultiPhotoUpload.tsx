"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteFile, uploadFile } from "@/lib/upload/uploadService";

export type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type MultiPhotoUploadProps = {
  title: string;
  value: FileMeta[];
  onUploaded: (meta: FileMeta) => void | Promise<void>;
  onDeleted: (meta: FileMeta) => void | Promise<void>;
  uploadEndpoint: string;
  email: string;
  recordId: string;
  slotName: "geotaggedPhotos";
  showRequiredError?: boolean;
  requiredErrorText?: string;
  onStatusChange?: (status: { hasPending: boolean; busy: boolean }) => void;
  disabled?: boolean;
  viewOnly?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-muted">
      <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MultiPhotoUpload({
  title,
  value,
  onUploaded,
  onDeleted,
  uploadEndpoint,
  email,
  recordId,
  slotName,
  showRequiredError,
  requiredErrorText,
  onStatusChange,
  disabled = false,
  viewOnly = false,
}: MultiPhotoUploadProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStatusChange?.({ hasPending: pendingFiles.length > 0, busy });
  }, [busy, onStatusChange, pendingFiles.length]);

  const overallProgress = useMemo(() => {
    if (pendingFiles.length === 0) return 0;
    return Math.round(((completedCount + currentProgress / 100) / pendingFiles.length) * 100);
  }, [completedCount, currentProgress, pendingFiles.length]);

  const hasPending = pendingFiles.length > 0;

  async function deletePhoto(meta: FileMeta) {
    if (disabled) return;

    try {
      await deleteFile({
        endpoint: uploadEndpoint,
        storedPath: meta.storedPath,
      });
      await Promise.resolve(onDeleted(meta));
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Delete failed.";
      setError(message);
    }
  }

  async function uploadSelected() {
    if (!pendingFiles.length || busy || disabled) return;

    try {
      setError(null);
      setBusy(true);
      setCurrentProgress(0);
      setCompletedCount(0);

      for (let index = 0; index < pendingFiles.length; index += 1) {
        const file = pendingFiles[index];
        const allowed =
          file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg";

        if (!allowed) {
          throw new Error("Only PDF/JPG/PNG allowed.");
        }

        if (file.size > 20 * 1024 * 1024) {
          throw new Error("Max file size is 20MB.");
        }

        const meta = await uploadFile({
          endpoint: uploadEndpoint,
          email,
          recordId,
          slot: slotName,
          file,
          onProgress: (pct) => setCurrentProgress(pct),
        });

        await Promise.resolve(onUploaded(meta));
        setCompletedCount(index + 1);
        setCurrentProgress(0);
      }

      setPendingFiles([]);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setError(message);
    } finally {
      setBusy(false);
      setCurrentProgress(0);
    }
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="text-sm font-semibold">{title}</div>

      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((meta) => (
            <div
              key={meta.storedPath}
              className="grid gap-2 rounded-lg border border-border px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0 text-xs text-muted-foreground">
                <a className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  {meta.fileName}
                </a>{" "}
                • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
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
                {!viewOnly ? (
                  <button
                    type="button"
                    onClick={() => void deletePhoto(meta)}
                    disabled={busy || disabled}
                    className={cx(
                      "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm",
                      busy || disabled
                        ? "pointer-events-none cursor-not-allowed border-border bg-transparent text-muted-foreground opacity-60"
                        : "border-border text-red-600 transition hover:bg-red-50"
                    )}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cx("text-xs", viewOnly ? "text-muted-foreground" : showRequiredError ? "text-red-600" : "text-muted-foreground")}>
          {viewOnly
            ? "Not uploaded"
            : showRequiredError
              ? requiredErrorText || "At least one geotagged photo is required."
              : "No geotagged photos uploaded yet."}
        </div>
      )}

      {!viewOnly ? (
        <div className="text-xs text-muted-foreground">
          {hasPending
            ? `${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"} selected`
            : value.length > 0
              ? "Choose more files to add additional photos."
              : "Choose one or more files to enable upload."}
        </div>
      ) : null}

      {!viewOnly && busy ? (
        <div className="space-y-2">
          <ProgressBar value={overallProgress} />
          <div className="text-xs text-muted-foreground">
            {overallProgress}% uploading...
          </div>
        </div>
      ) : null}

      {!viewOnly && error ? <div className="text-xs text-red-600">{error}</div> : null}

      {!viewOnly ? (
        <div className="flex flex-wrap gap-2">
          <label
            className={cx(
              "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
              busy || disabled
                ? "pointer-events-none cursor-not-allowed opacity-60"
                : "cursor-pointer transition hover:bg-muted"
            )}
          >
            Choose files
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                event.currentTarget.value = "";
                setPendingFiles((current) => [...current, ...selected]);
                setError(null);
                setCompletedCount(0);
                setCurrentProgress(0);
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => void uploadSelected()}
            disabled={!hasPending || busy || disabled}
            className={cx(
              "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm",
              !hasPending || busy || disabled
                ? "pointer-events-none cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
                : "border-foreground bg-foreground text-background transition hover:opacity-90"
            )}
          >
            Upload Selected
          </button>
        </div>
      ) : null}
    </div>
  );
}
