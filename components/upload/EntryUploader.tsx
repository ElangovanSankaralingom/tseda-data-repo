"use client";

import { useEffect, useState } from "react";
import UploadField from "@/components/entry/UploadField";
import { useUploadController } from "@/hooks/useUploadController";
import { toUserMessage } from "@/lib/errors";
import { safeAction } from "@/lib/safeAction";
import { deleteFile, uploadFile, type UploadedFile } from "@/lib/upload/uploadService";

type UploadMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
  id?: string;
  name?: string;
  type?: string;
  path?: string;
};

type EntryUploaderStatus = {
  busy: boolean;
  hasPending: boolean;
};

type EntryUploaderProps = {
  title: string;
  mode: "edit" | "view";
  meta: UploadMeta | null;
  uploadEndpoint: string;
  recordId: string;
  slot: string;
  email?: string;
  disabled?: boolean;
  showValidationError?: boolean;
  validationMessage?: string;
  onUploaded: (meta: UploadMeta) => void | Promise<void>;
  onDeleted: (meta: UploadMeta) => void | Promise<void>;
  onStatusChange?: (status: EntryUploaderStatus) => void;
};

export type { UploadMeta, UploadedFile };

export default function EntryUploader({
  title,
  mode,
  meta,
  uploadEndpoint,
  recordId,
  slot,
  email,
  disabled = false,
  showValidationError = false,
  validationMessage,
  onUploaded,
  onDeleted,
  onStatusChange,
}: EntryUploaderProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const locked = disabled || mode === "view";

  const controller = useUploadController<UploadMeta>({
    locked,
    upload: (file, onProgress) =>
      uploadFile({
        endpoint: uploadEndpoint,
        email,
        recordId,
        slot,
        file,
        onProgress,
      }),
    remove: async (currentMeta) => {
      await deleteFile({ endpoint: uploadEndpoint, storedPath: currentMeta.storedPath });
      await Promise.resolve(onDeleted(currentMeta));
    },
  });

  const uploadBusy = controller.busy || persisting;

  useEffect(() => {
    onStatusChange?.({
      busy: uploadBusy,
      hasPending: !!controller.pendingFile,
    });
  }, [controller.pendingFile, onStatusChange, uploadBusy]);

  async function handleUpload() {
    setActionError(null);
    const uploaded = await controller.uploadAndSave();
    if (!uploaded) return;

    setPersisting(true);
    try {
      const result = await safeAction(() => Promise.resolve(onUploaded(uploaded)), {
        context: "EntryUploader.onUploaded",
      });

      if (!result.ok) {
        setActionError(toUserMessage(result.error));
      }
    } finally {
      setPersisting(false);
    }
  }

  async function handleDelete() {
    if (!meta) return;
    setActionError(null);
    const deleted = await controller.deleteFile(meta);
    if (!deleted) return;
  }

  return (
    <UploadField
      title={title}
      mode={mode}
      meta={meta}
      pendingFile={controller.pendingFile}
      progress={controller.progress}
      busy={uploadBusy}
      error={actionError ?? controller.error}
      canChoose={controller.canChoose && !persisting}
      canUpload={controller.canUpload && !persisting}
      canDelete={controller.canDelete && !persisting}
      onSelectFile={(file) => {
        setActionError(null);
        controller.selectFile(file);
      }}
      onUpload={() => void handleUpload()}
      onDelete={() => void handleDelete()}
      showValidationError={showValidationError}
      validationMessage={validationMessage}
    />
  );
}
