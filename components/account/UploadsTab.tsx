"use client";

import { useState } from "react";
import { SectionCard, MiniButton, ProgressBar } from "./AccountUI";
import { uploadDocXHR } from "./uploadHelpers";
import {
  cx,
  getErrorMessage,
  type Profile,
  type SaveTabOptions,
} from "./types";

interface UploadsTabProps {
  draft: Profile;
  setDraft: React.Dispatch<React.SetStateAction<Profile>>;
  saveCurrentTab: (options: SaveTabOptions) => Promise<void>;
  showToast: (type: "ok" | "err", msg: string) => void;
}

type DocType = "appointmentLetter" | "joiningLetter" | "aadhar" | "panCard";

export default function UploadsTab({ draft, setDraft, saveCurrentTab, showToast }: UploadsTabProps) {
  const [pendingDocFile, setPendingDocFile] = useState<Record<DocType, File | null>>({
    appointmentLetter: null,
    joiningLetter: null,
    aadhar: null,
    panCard: null,
  });
  const [docProgress, setDocProgress] = useState<Record<string, number>>({});
  const [docBusy, setDocBusy] = useState<Record<string, boolean>>({});
  const [docError, setDocError] = useState<Record<string, string | null>>({});

  async function uploadAndSaveDoc(docType: DocType) {
    const key = `doc:${docType}`;
    const file = pendingDocFile[docType];

    if (!file) {
      setDocError((m) => ({ ...m, [key]: "Select a file first." }));
      return;
    }

    const max = 20 * 1024 * 1024;
    const allowed =
      file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg";

    if (!allowed) {
      setDocError((m) => ({ ...m, [key]: "Only PDF/JPG/PNG allowed." }));
      return;
    }
    if (file.size > max) {
      setDocError((m) => ({ ...m, [key]: "Max file size is 20MB." }));
      return;
    }

    try {
      setDocError((m) => ({ ...m, [key]: null }));
      setDocBusy((m) => ({ ...m, [key]: true }));
      setDocProgress((m) => ({ ...m, [key]: 0 }));

      const meta = await uploadDocXHR({
        docType,
        file,
        onProgress: (pct) => setDocProgress((m) => ({ ...m, [key]: pct })),
      });

      const nextDraft = {
        ...draft,
        uploads: {
          ...(draft.uploads || { appointmentLetter: null, joiningLetter: null, aadhar: null, panCard: null }),
          [docType]: meta,
        },
      };

      setDraft(nextDraft);

      setPendingDocFile((m) => ({ ...m, [docType]: null }));
      setDocBusy((m) => ({ ...m, [key]: false }));
      setDocProgress((m) => ({ ...m, [key]: 100 }));

      await saveCurrentTab({ tab: "uploads", draftOverride: nextDraft });
    } catch (error: unknown) {
      setDocBusy((m) => ({ ...m, [key]: false }));
      setDocError((m) => ({ ...m, [key]: getErrorMessage(error, "Upload failed.") }));
    }
  }

  async function deleteDoc(docType: DocType) {
    const meta = draft.uploads?.[docType];
    if (!meta?.storedPath) {
      showToast("err", "File path missing. Upload again once and Save.");
      return;
    }

    try {
      const r = await fetch("/api/me/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Delete failed");

      const nextDraft = {
        ...draft,
        uploads: {
          ...(draft.uploads || {
            appointmentLetter: null,
            joiningLetter: null,
            aadhar: null,
            panCard: null,
          }),
          [docType]: null,
        },
      };

      setDraft(nextDraft);

      await saveCurrentTab({ tab: "uploads", draftOverride: nextDraft });
    } catch (error: unknown) {
      showToast("err", getErrorMessage(error, "Delete failed."));
    }
  }

  return (
    <SectionCard title="Uploads" subtitle="Single file each. Max 20MB. Choose file → Upload & Save → Preview.">
      <div className="space-y-4">
        {(
          [
            ["appointmentLetter", "Appointment Letter"],
            ["joiningLetter", "Joining Letter"],
            ["aadhar", "Aadhar"],
            ["panCard", "PAN Card"],
          ] as const
        ).map(([docType, label]) => {
          const key = `doc:${docType}`;
          const meta = draft.uploads?.[docType] ?? null;
          const pending = pendingDocFile[docType];
          const busy = !!docBusy[key];
          const pct = docProgress[key] ?? 0;
          const err = docError[key];

          const canUploadAndSave = !!pending && !busy;

          return (
            <div key={docType} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{label}</div>

                  {meta ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      <a className="underline" href={meta.url} target="_blank">
                        {meta.fileName}
                      </a>{" "}
                      • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">No file uploaded.</div>
                  )}

                  <div className="mt-2 text-xs text-muted-foreground">
                    {pending ? `Selected: ${pending.name}` : "Select a file to enable Upload & Save."}
                  </div>

                  {busy ? (
                    <div className="mt-2 space-y-2">
                      <ProgressBar value={pct} />
                      <div className="text-xs text-muted-foreground">{pct}% uploading…</div>
                    </div>
                  ) : null}

                  {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {meta ? (
                    <>
                      <a
                        href={meta.url}
                        target="_blank"
                        className="px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted transition"
                      >
                        Preview
                      </a>
                      <MiniButton variant="danger" onClick={() => void deleteDoc(docType)} disabled={busy}>
                        Delete
                      </MiniButton>
                    </>
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
                        setPendingDocFile((m) => ({ ...m, [docType]: f }));
                        setDocError((m) => ({ ...m, [key]: null }));
                        setDocProgress((m) => ({ ...m, [key]: 0 }));
                      }}
                    />
                  </label>

                  <MiniButton onClick={() => void uploadAndSaveDoc(docType)} disabled={!canUploadAndSave}>
                    Upload & Save
                  </MiniButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
