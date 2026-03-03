"use client";

import { useMemo } from "react";

type FileMetaLike = {
  fileName: string;
  size: number;
  uploadedAt: string;
  url: string;
} | null;

type UploadFieldProps = {
  title: string;
  mode: "edit" | "view";
  meta: FileMetaLike;
  pendingFile: File | null;
  progress: number;
  busy: boolean;
  error: string | null;
  canChoose: boolean;
  canUpload: boolean;
  canDelete: boolean;
  onSelectFile: (file: File | null) => void;
  onUpload: () => void;
  onDelete: () => void;
  showValidationError?: boolean;
  validationMessage?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ActionButton({
  children,
  disabled,
  danger = false,
  dark = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  dark?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm",
        disabled
          ? dark
            ? "pointer-events-none cursor-not-allowed border-neutral-300 bg-neutral-300 text-neutral-500 opacity-100"
            : "pointer-events-none cursor-not-allowed border-border bg-transparent text-muted-foreground opacity-60"
          : dark
            ? "border-black bg-black text-white transition-colors hover:bg-neutral-800"
          : danger
            ? "border-border text-red-600 transition hover:bg-red-50"
            : "border-border transition hover:bg-muted"
      )}
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

export default function UploadField({
  title,
  mode,
  meta,
  pendingFile,
  progress,
  busy,
  error,
  canChoose,
  canUpload,
  canDelete,
  onSelectFile,
  onUpload,
  onDelete,
  showValidationError = false,
  validationMessage,
}: UploadFieldProps) {
  const neutralHelper = useMemo(() => {
    if (pendingFile) return `Selected: ${pendingFile.name}`;
    if (meta) return "Uploaded. Choose a new file and upload to replace it.";
    return "Select a file to enable Upload & Save.";
  }, [meta, pendingFile]);

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="text-sm font-semibold">{title}</div>

      {mode === "view" ? (
        meta ? (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {meta.fileName} • {(meta.size / (1024 * 1024)).toFixed(2)} MB •{" "}
              {new Date(meta.uploadedAt).toLocaleString()}
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
            <div className={cx("text-xs", showValidationError ? "text-red-600" : "text-muted-foreground")}>
              {showValidationError ? validationMessage || "This upload is mandatory." : "No file uploaded yet."}
            </div>
          )}

          <div className="text-xs text-muted-foreground">{neutralHelper}</div>

          {busy ? (
            <div className="space-y-2">
              <ProgressBar value={progress} />
              <div className="text-xs text-muted-foreground">{progress}% uploading...</div>
            </div>
          ) : null}

          {error ? <div className="text-xs text-red-600">{error}</div> : null}

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
                <ActionButton danger disabled={!canDelete} onClick={onDelete}>
                  Delete
                </ActionButton>
              </>
            ) : null}

            <label
              className={cx(
                "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                canChoose
                  ? "cursor-pointer transition hover:bg-muted"
                  : "pointer-events-none cursor-not-allowed opacity-60"
              )}
            >
              Choose file
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                disabled={!canChoose}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  event.currentTarget.value = "";
                  onSelectFile(nextFile);
                }}
              />
            </label>

            <ActionButton dark disabled={!canUpload} onClick={onUpload}>
              {meta && !pendingFile ? "Uploaded" : "Upload & Save"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}
