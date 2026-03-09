import type { FileMeta } from "@/lib/experience";

export function uploadCertificateXHR(opts: {
  category: "academicOutsideTCE" | "industry";
  entryId: string;
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { category, entryId, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/file", true);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress(pct);
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

    const form = new FormData();
    form.set("kind", "certificate");
    form.set("category", category);
    form.set("entryId", entryId);
    form.set("file", file);

    xhr.send(form);
  });
}

export function uploadDocXHR(opts: {
  docType: "appointmentLetter" | "joiningLetter" | "aadhar" | "panCard";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { docType, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/file", true);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress(pct);
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

    const form = new FormData();
    form.set("kind", "doc");
    form.set("docType", docType);
    form.set("file", file);

    xhr.send(form);
  });
}
