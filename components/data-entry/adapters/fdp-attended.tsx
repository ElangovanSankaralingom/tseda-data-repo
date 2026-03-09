"use client";

import { useMemo, useCallback, useState } from "react";
import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadField from "@/components/entry/UploadField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { useUploadController } from "@/hooks/useUploadController";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
  type YearOfStudy,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import type { EntryStatus, FileMeta } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";
import { uploadFile } from "@/lib/upload/uploadService";
import { type StreakState } from "@/lib/gamification";

type FdpAttended = {
  id: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  startDate: string;
  endDate: string;
  programName: string;
  organisingBody: string;
  supportAmount: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  permanentlyLocked?: boolean;
  permissionLetter: FileMeta | null;
  completionCertificate: FileMeta | null;
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACADEMIC_YEAR_OPTIONS = [
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
] as const;

const ACADEMIC_YEAR_DROPDOWN_OPTIONS = ACADEMIC_YEAR_OPTIONS.map((option) => ({
  label: option,
  value: option,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getAcademicYearRange(academicYear: string) {
  const match = academicYear.match(/^Academic Year (\d{4})-(\d{4})$/);
  if (!match) return null;
  return {
    start: `${match[1]}-07-01`,
    end: `${match[2]}-06-30`,
    label: `Jul 1, ${match[1]} to Jun 30, ${match[2]}`,
  };
}

function getInclusiveDays(startDate: string, endDate: string) {
  if (!isISODate(startDate) || !isISODate(endDate) || endDate < startDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function formatDisplayDate(value: string) {
  if (!isISODate(value)) return "-";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString();
}

function emptyForm(): FdpAttended {
  return withAcademicProgressionCompatibility({
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    yearOfStudy: "",
    currentSemester: null,
    startDate: "",
    endDate: "",
    programName: "",
    organisingBody: "",
    supportAmount: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: null,
    completionCertificate: null,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as FdpAttended;
}

function uploadFdpFileXHR(opts: {
  recordId: string;
  slot: "permissionLetter" | "completionCertificate";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  return uploadFile({
    endpoint: "/api/me/fdp-file",
    recordId: opts.recordId,
    slot: opts.slot,
    file: opts.file,
    onProgress: opts.onProgress,
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: FdpAttended): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!ACADEMIC_YEAR_OPTIONS.includes(form.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
    errors.academicYear = "Academic year is required.";
  }
  const normalizedYear = normalizeYearOfStudy(form.yearOfStudy);
  if (!normalizedYear) {
    errors.yearOfStudy = "Year of study is required.";
  }
  if (normalizedYear && !isSemesterAllowed(normalizedYear, form.currentSemester ?? undefined)) {
    errors.currentSemester = "Current semester is required.";
  }
  if (!isISODate(form.startDate)) {
    errors.startDate = "Starting date is required.";
  } else {
    const range = getAcademicYearRange(form.academicYear);
    if (range && (form.startDate < range.start || form.startDate > range.end)) {
      errors.startDate = `Starting date must fall within ${form.academicYear} (${range.label}).`;
    }
  }
  if (!isISODate(form.endDate)) {
    errors.endDate = "Ending date is required.";
  } else if (isISODate(form.startDate) && form.endDate < form.startDate) {
    errors.endDate = "Ending date must be on or after starting date.";
  }
  if ((form.programName || "").trim().length === 0) {
    errors.programName = "Program name is required.";
  }
  if ((form.organisingBody || "").trim().length === 0) {
    errors.organisingBody = "Organising body is required.";
  }
  if (form.supportAmount !== null) {
    if (!Number.isFinite(form.supportAmount) || form.supportAmount < 0) {
      errors.supportAmount = "Invalid amount.";
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function FdpAttendedFormFields({ ctx }: { ctx: FormFieldsContext<FdpAttended> }) {
  const { form, setForm, submitted, errors, coreFieldDisabled, isViewMode, pdfState, uploadsVisible, persistCurrentMutation, showToast, submitAttemptedFinal, uploadPersisting, setUploadPersistingCount } = ctx;

  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);

  const permissionController = useUploadController<FileMeta>({
    locked: ctx.controlsDisabled,
    savedToServer: !!form.pdfMeta,
    upload: (file, onProgress) =>
      uploadFdpFileXHR({ recordId: form.id, slot: "permissionLetter", file, onProgress }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Delete failed.");
    },
  });

  const completionController = useUploadController<FileMeta>({
    locked: ctx.controlsDisabled,
    savedToServer: !!form.pdfMeta,
    upload: (file, onProgress) =>
      uploadFdpFileXHR({ recordId: form.id, slot: "completionCertificate", file, onProgress }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Delete failed.");
    },
  });

  async function uploadSlot(slot: "permissionLetter" | "completionCertificate") {
    const controller = slot === "permissionLetter" ? permissionController : completionController;
    const previousMeta = form[slot];
    try {
      const meta = await controller.uploadAndSave();
      if (!meta) return;
      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void fetch("/api/me/fdp-file", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storedPath: previousMeta.storedPath }),
        }).catch(() => null);
      }
      setUploadPersistingCount((c) => c + 1);
      try {
        await persistCurrentMutation({
          buildNextEntry: (current) => ({ ...current, [slot]: meta }) as FdpAttended,
        });
      } finally {
        setUploadPersistingCount((c) => Math.max(0, c - 1));
      }
    } catch (error) {
      showToast("err", error instanceof Error ? error.message : "Upload failed.", 1800);
    }
  }

  async function deleteSlot(slot: "permissionLetter" | "completionCertificate") {
    const meta = form[slot];
    if (!meta?.storedPath) { showToast("err", "File path missing.", 1500); return; }
    try {
      const controller = slot === "permissionLetter" ? permissionController : completionController;
      const deleted = await controller.deleteFile(meta);
      if (!deleted) return;
      setUploadPersistingCount((c) => c + 1);
      try {
        await persistCurrentMutation({
          buildNextEntry: (current) => ({ ...current, [slot]: null }) as FdpAttended,
        });
      } finally {
        setUploadPersistingCount((c) => Math.max(0, c - 1));
      }
      showToast("ok", "File deleted.", 1200);
    } catch (error) {
      showToast("err", error instanceof Error ? error.message : "Delete failed.", 1500);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Academic Year" error={submitted ? errors.academicYear : undefined}>
          <SelectDropdown
            value={form.academicYear}
            onChange={(value) => setForm((c) => ({ ...c, academicYear: value }))}
            options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
            placeholder="Select academic year"
            disabled={coreFieldDisabled("academicYear")}
            error={submitted && !!errors.academicYear}
          />
        </Field>

        <Field label="Year of Study" error={submitted ? errors.yearOfStudy : undefined}>
          <SelectDropdown
            value={form.yearOfStudy}
            onChange={(value) =>
              setForm((c) => {
                const nextYear = normalizeYearOfStudy(value) ?? "";
                const nextSemester = isSemesterAllowed(nextYear || undefined, c.currentSemester ?? undefined) ? c.currentSemester : null;
                return withAcademicProgressionCompatibility({ ...c, yearOfStudy: nextYear, currentSemester: nextSemester }) as FdpAttended;
              })
            }
            options={YEAR_OF_STUDY_OPTIONS}
            placeholder="Select year of study"
            disabled={coreFieldDisabled("yearOfStudy")}
            error={submitted && !!errors.yearOfStudy}
          />
        </Field>

        <Field label="Current Semester" error={submitted ? errors.currentSemester : undefined} hint={normalizedStudentYear ? "Select semester (based on year)" : "Select year of study first"}>
          <SelectDropdown
            value={form.currentSemester === null ? "" : String(form.currentSemester)}
            onChange={(value) => setForm((c) => withAcademicProgressionCompatibility({ ...c, currentSemester: value ? Number(value) : null }) as FdpAttended)}
            options={semesterOptions.map((o) => ({ label: String(o), value: String(o) }))}
            placeholder={normalizedStudentYear ? "Select current semester" : "Select year of study first"}
            disabled={coreFieldDisabled("currentSemester") || !normalizedStudentYear}
            error={submitted && !!errors.currentSemester}
          />
        </Field>

        <Field label="Starting Date" error={submitted ? errors.startDate : undefined}>
          <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
        </Field>

        <Field label="Ending Date" error={submitted ? errors.endDate : undefined} hint={inclusiveDays ? `Days: ${inclusiveDays}` : undefined}>
          <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
        </Field>

        <Field label="Number of Days" hint="Inclusive day count">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">{inclusiveDays ?? "-"}</div>
        </Field>

        <Field label="Name of the Faculty Development Program" error={submitted ? errors.programName : undefined}>
          <input
            value={form.programName}
            onChange={(e) => setForm((c) => ({ ...c, programName: e.target.value }))}
            disabled={coreFieldDisabled("programName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-400",
              submitted && errors.programName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("programName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Name of the Organising Body" error={submitted ? errors.organisingBody : undefined}>
          <input
            value={form.organisingBody}
            onChange={(e) => setForm((c) => ({ ...c, organisingBody: e.target.value }))}
            disabled={coreFieldDisabled("organisingBody")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-400",
              submitted && errors.organisingBody ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("organisingBody") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Amount of Support (₹) — optional" error={submitted ? errors.supportAmount : undefined} hint="Numbers only">
          <CurrencyField
            value={form.supportAmount === null ? "" : String(form.supportAmount)}
            onChange={(value) => setForm((c) => ({ ...c, supportAmount: value === "" ? null : Number(value) }))}
            disabled={coreFieldDisabled("supportAmount")}
            error={submitted && !!errors.supportAmount}
            placeholder="15000"
          />
        </Field>
      </div>

      <div className="mt-5 space-y-4">
        <p className="text-sm text-muted-foreground">Streaks apply only for upcoming FDP dates.</p>
        {uploadsVisible ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadField
              title="Upload Permission Letter"
              mode={isViewMode ? "view" : "edit"}
              meta={form.permissionLetter}
              pendingFile={permissionController.pendingFile}
              progress={permissionController.progress}
              busy={permissionController.busy || uploadPersisting}
              error={permissionController.error}
              canChoose={permissionController.canChoose && !uploadPersisting}
              canUpload={permissionController.canUpload && !uploadPersisting}
              canDelete={permissionController.canDelete && !uploadPersisting}
              needsEntry={permissionController.needsEntry}
              onSelectFile={permissionController.selectFile}
              onUpload={() => void uploadSlot("permissionLetter")}
              onDelete={() => void deleteSlot("permissionLetter")}
              showValidationError={submitAttemptedFinal}
              validationMessage={errors.permissionLetter}
            />
            <UploadField
              title="Upload Completion Certificate"
              mode={isViewMode ? "view" : "edit"}
              meta={form.completionCertificate}
              pendingFile={completionController.pendingFile}
              progress={completionController.progress}
              busy={completionController.busy || uploadPersisting}
              error={completionController.error}
              canChoose={completionController.canChoose && !uploadPersisting}
              canUpload={completionController.canUpload && !uploadPersisting}
              canDelete={completionController.canDelete && !uploadPersisting}
              needsEntry={completionController.needsEntry}
              onSelectFile={completionController.selectFile}
              onUpload={() => void uploadSlot("completionCertificate")}
              onDelete={() => void deleteSlot("completionCertificate")}
              showValidationError={submitAttemptedFinal}
              validationMessage={errors.completionCertificate}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function FdpAttendedPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<FdpAttended>
      {...props}
      category="fdp-attended"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => withAcademicProgressionCompatibility(entry) as FdpAttended}
      validateFields={validateFields}
      renderFormFields={(ctx) => <FdpAttendedFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => entry.programName}
      buildListEntrySubtitle={(entry) => entry.organisingBody}
      renderListEntryBody={({ entry }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.currentSemester) parts.push(`Semester ${entry.currentSemester}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} days`);
        if (typeof entry.supportAmount === "number") parts.push(`₹${entry.supportAmount.toLocaleString("en-IN")}`);
        return (
          <>
            {parts.length > 0 && <div className="text-xs text-muted-foreground">{parts.join(" • ")}</div>}
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {entry.permissionLetter ? <a className="underline" href={entry.permissionLetter.url} target="_blank" rel="noreferrer">Permission Letter</a> : null}
              {entry.completionCertificate ? <a className="underline" href={entry.completionCertificate.url} target="_blank" rel="noreferrer">Completion Certificate</a> : null}
            </div>
          </>
        );
      }}
      title="FDP — Attended"
      subtitle="Record faculty development programmes attended, along with support amount and the two required supporting documents."
      formTitle="FDP Entry"
      formSubtitle="Add the entry details and upload the required documents."
      deleteDescription="This permanently deletes this FDP entry and its associated uploaded files."
    />
  );
}

export default FdpAttendedPage;
