"use client";

import { useMemo } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { type FileMetaLike } from "./entryComponentTypes";

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
  needsEntry?: boolean;
  onSelectFile: (file: File | null) => void;
  onUpload: () => void;
  onDelete: () => void;
  showValidationError?: boolean;
  validationMessage?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-[#1E3A5F]" style={{ width: `${pct}%` }} />
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
  needsEntry = false,
  onSelectFile,
  onUpload,
  onDelete,
  showValidationError = false,
  validationMessage,
}: UploadFieldProps) {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const neutralHelper = useMemo(() => {
    if (needsEntry) return "Save the entry first to upload files.";
    if (pendingFile) return `Selected: ${pendingFile.name}`;
    if (meta) return "Uploaded. Choose a new file and upload to replace it.";
    return "Select a file to enable Upload & Save.";
  }, [meta, needsEntry, pendingFile]);

  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
      <div className="text-sm font-semibold text-slate-700">{title}</div>

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
                className={getButtonClass("context")}
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
                  className={getButtonClass("context")}
                >
                  Preview
                </a>
                <ActionButton
                  role="destructive"
                  disabled={!canDelete}
                  onClick={() =>
                    requestConfirmation({
                      title: "Remove uploaded file?",
                      description:
                        "This removes the currently uploaded file from this entry. You can upload a replacement afterward.",
                      confirmLabel: "Remove",
                      cancelLabel: "Cancel",
                      variant: "destructive",
                      onConfirm: onDelete,
                    })
                  }
                >
                  Delete
                </ActionButton>
              </>
            ) : null}

            <label
              className={cx(
                canChoose
                  ? `${getButtonClass("context")} cursor-pointer`
                  : getButtonClass("context", { disabled: true })
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

            <ActionButton role="primary" disabled={!canUpload} onClick={onUpload}>
              {meta && !pendingFile ? "Uploaded" : "Upload & Save"}
            </ActionButton>
          </div>
        </>
      )}
      {confirmationDialog}
    </div>
  );
}
