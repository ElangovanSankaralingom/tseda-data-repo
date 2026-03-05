"use client";

export type UploadedFile = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
  name: string;
  type: string;
  path: string;
};

type UploadFileOptions = {
  endpoint: string;
  recordId: string;
  slot: string;
  file: File;
  email?: string;
  onProgress?: (pct: number) => void;
};

type DeleteFileOptions = {
  endpoint: string;
  storedPath: string;
};

type RawUploadedFile = {
  fileName?: unknown;
  mimeType?: unknown;
  size?: unknown;
  uploadedAt?: unknown;
  url?: unknown;
  storedPath?: unknown;
  id?: unknown;
};

function asNonEmptyString(value: unknown) {
  const next = typeof value === "string" ? value.trim() : "";
  return next;
}

export function normalizeUploadedFile(result: unknown): UploadedFile {
  const raw = result && typeof result === "object" ? (result as RawUploadedFile) : {};
  const fileName = asNonEmptyString(raw.fileName);
  const mimeType = asNonEmptyString(raw.mimeType);
  const url = asNonEmptyString(raw.url);
  const storedPath = asNonEmptyString(raw.storedPath);
  const uploadedAt = asNonEmptyString(raw.uploadedAt) || new Date().toISOString();
  const sizeValue = typeof raw.size === "number" ? raw.size : Number(raw.size ?? 0);
  const size = Number.isFinite(sizeValue) && sizeValue >= 0 ? sizeValue : 0;
  const id = asNonEmptyString(raw.id) || storedPath || `${uploadedAt}:${fileName}`;

  if (!fileName || !mimeType || !url || !storedPath) {
    throw new Error("Upload failed (bad response).");
  }

  return {
    id,
    fileName,
    mimeType,
    size,
    uploadedAt,
    url,
    storedPath,
    name: fileName,
    type: mimeType,
    path: storedPath,
  };
}

export function uploadFile({
  endpoint,
  recordId,
  slot,
  file,
  email,
  onProgress,
}: UploadFileOptions): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      onProgress?.(pct);
    };

    xhr.onerror = () => reject(new Error("Upload failed (network)."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    xhr.onload = () => {
      try {
        const isJSON = (xhr.getResponseHeader("content-type") || "").includes("application/json");
        const payload = isJSON ? JSON.parse(xhr.responseText || "{}") : null;

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(normalizeUploadedFile(payload));
          return;
        }

        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : `Upload failed (${xhr.status}).`;
        reject(new Error(message));
      } catch {
        reject(new Error("Upload failed (bad response)."));
      }
    };

    const body = new FormData();
    if (email) {
      body.set("email", email);
    }
    body.set("recordId", recordId);
    body.set("slot", slot);
    body.set("file", file);
    xhr.send(body);
  });
}

export async function deleteFile({ endpoint, storedPath }: DeleteFileOptions): Promise<void> {
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storedPath }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "Delete failed.";
    throw new Error(message);
  }
}
