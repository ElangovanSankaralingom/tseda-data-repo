"use client";

import { useState } from "react";
import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadField from "@/components/entry/UploadField";
import UploadFieldMulti, { type FileMeta } from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import FacultyPickerRows, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { useUploadController } from "@/hooks/useUploadController";
import { FACULTY_DIRECTORY, type FacultyDirectoryEntry } from "@/lib/faculty-directory";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { cx, uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { uploadFile } from "@/lib/upload/uploadService";
import type { FdpConducted } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FACULTY_OPTIONS: FacultyDirectoryEntry[] = FACULTY_DIRECTORY;

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD" },
  { label: "EVEN Semester", value: "EVEN" },
] as const;

const LEVEL_OPTIONS = [
  { label: "National", value: "National" },
  { label: "International", value: "International" },
] as const;

const MODE_OPTIONS = [
  { label: "Online", value: "Online" },
  { label: "Offline", value: "Offline" },
] as const;

const SPONSORED_OPTIONS = [
  { label: "Yes", value: "Yes" },
  { label: "No", value: "No" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyForm(): FdpConducted {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    level: "",
    mode: "",
    startDate: "",
    endDate: "",
    programName: "",
    coordinatorName: "",
    coordinatorEmail: "",
    coCoordinators: [],
    sponsored: "",
    fundingAgency: "",
    fundingAmount: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: null,
    geotaggedPhotos: [],
    attendanceSheet: null,
    numberOfParticipants: null,
    officialPoster: null,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as FdpConducted;
}

function uploadConductedFileXHR(opts: {
  recordId: string;
  slot: "permissionLetter" | "attendanceSheet" | "officialPoster";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  return uploadFile({
    endpoint: "/api/me/fdp-conducted/file",
    recordId: opts.recordId,
    slot: opts.slot,
    file: opts.file,
    onProgress: opts.onProgress,
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: FdpConducted): Record<string, string> {
  const errors = validateEntryFields("fdp-conducted", form as unknown as Record<string, unknown>);

  // Category-specific: duplicate co-coordinator emails
  const emailCounts = new Map<string, number>();
  const selectedEmails = [form.coordinatorEmail, ...form.coCoordinators.map((v) => v.email)]
    .map((v) => (v || "").trim().toLowerCase())
    .filter(Boolean);
  for (const selectedEmail of selectedEmails) {
    emailCounts.set(selectedEmail, (emailCounts.get(selectedEmail) ?? 0) + 1);
  }
  form.coCoordinators.forEach((value, index) => {
    if (value.email && (emailCounts.get(value.email.toLowerCase()) ?? 0) > 1) {
      errors[`coCoordinators.${index}`] = "This faculty is already selected in another role.";
    }
  });

  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function FdpConductedFormFields({ ctx }: { ctx: FormFieldsContext<FdpConducted> }) {
  const {
    form,
    setForm,
    submitted,
    errors,
    coreFieldDisabled,
    controlsDisabled,
    isViewMode,
    uploadsVisible,
    persistCurrentMutation,
    showToast,
    submitAttemptedFinal,
    uploadPersisting,
    setUploadPersistingCount,
    email,
    userDisplayName,
  } = ctx;

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const [, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete = !!form.permissionLetter && form.geotaggedPhotos.length > 0 && !!form.attendanceSheet;

  const permissionController = useUploadController<FileMeta>({
    locked: controlsDisabled,
    savedToServer: !!form.pdfMeta,
    upload: (file, onProgress) =>
      uploadConductedFileXHR({ recordId: form.id, slot: "permissionLetter", file, onProgress }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-conducted/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Delete failed.");
    },
  });

  const attendanceController = useUploadController<FileMeta>({
    locked: controlsDisabled,
    savedToServer: !!form.pdfMeta,
    upload: (file, onProgress) =>
      uploadConductedFileXHR({ recordId: form.id, slot: "attendanceSheet", file, onProgress }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-conducted/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Delete failed.");
    },
  });

  const posterController = useUploadController<FileMeta>({
    locked: controlsDisabled,
    savedToServer: !!form.pdfMeta,
    upload: (file, onProgress) =>
      uploadConductedFileXHR({ recordId: form.id, slot: "officialPoster", file, onProgress }),
    remove: async (meta) => {
      const response = await fetch("/api/me/fdp-conducted/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Delete failed.");
    },
  });

  async function uploadSlot(slot: "permissionLetter" | "attendanceSheet" | "officialPoster") {
    const controller = slot === "permissionLetter" ? permissionController : slot === "attendanceSheet" ? attendanceController : posterController;
    const previousMeta = form[slot];
    try {
      const meta = await controller.uploadAndSave();
      if (!meta) return;
      if (previousMeta?.storedPath && previousMeta.storedPath !== meta.storedPath) {
        void fetch("/api/me/fdp-conducted/file", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storedPath: previousMeta.storedPath }),
        }).catch(() => null);
      }
      setUploadPersistingCount((c) => c + 1);
      try {
        await persistCurrentMutation({
          buildNextEntry: (current) => ({ ...current, [slot]: meta }) as FdpConducted,
        });
      } finally {
        setUploadPersistingCount((c) => Math.max(0, c - 1));
      }
    } catch (error) {
      showToast("err", error instanceof Error ? error.message : "Upload failed.", 1800);
    }
  }

  async function deleteSlot(slot: "permissionLetter" | "attendanceSheet" | "officialPoster") {
    const meta = form[slot];
    if (!meta?.storedPath) { showToast("err", "File path missing.", 1500); return; }
    try {
      const controller = slot === "permissionLetter" ? permissionController : slot === "attendanceSheet" ? attendanceController : posterController;
      const deleted = await controller.deleteFile(meta);
      if (!deleted) return;
      setUploadPersistingCount((c) => c + 1);
      try {
        await persistCurrentMutation({
          buildNextEntry: (current) => ({ ...current, [slot]: null }) as FdpConducted,
        });
      } finally {
        setUploadPersistingCount((c) => Math.max(0, c - 1));
      }
      showToast("ok", "File deleted.", 1200);
    } catch (error) {
      showToast("err", error instanceof Error ? error.message : "Delete failed.", 1500);
    }
  }

  async function persistCoCoordinatorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({
        ...current,
        coordinatorName: userDisplayName || current.coordinatorName,
        coordinatorEmail: email || current.coordinatorEmail,
        coCoordinators: nextRows,
      }),
      selectResult: (persisted) => persisted.coCoordinators,
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Academic Year" error={submitted ? errors.academicYear : undefined}>
          <SelectDropdown
            value={form.academicYear || ""}
            onChange={(value) => setForm((c) => ({ ...c, academicYear: value }))}
            options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
            placeholder="Select academic year"
            disabled={coreFieldDisabled("academicYear")}
            error={submitted && !!errors.academicYear}
          />
        </Field>

        <Field label="Semester Type" error={submitted ? errors.semesterType : undefined}>
          <SelectDropdown
            value={form.semesterType || ""}
            onChange={(value) => setForm((c) => ({ ...c, semesterType: value }))}
            options={SEMESTER_TYPE_OPTIONS}
            placeholder="Select semester type"
            disabled={coreFieldDisabled("semesterType")}
            error={submitted && !!errors.semesterType}
          />
        </Field>

        <Field label="Level" error={submitted ? errors.level : undefined}>
          <SelectDropdown
            value={form.level || ""}
            onChange={(value) => setForm((c) => ({ ...c, level: value }))}
            options={LEVEL_OPTIONS}
            placeholder="Select level"
            disabled={coreFieldDisabled("level")}
            error={submitted && !!errors.level}
          />
        </Field>

        <Field label="Mode of FDP" error={submitted ? errors.mode : undefined}>
          <SelectDropdown
            value={form.mode || ""}
            onChange={(value) => setForm((c) => ({ ...c, mode: value }))}
            options={MODE_OPTIONS}
            placeholder="Select mode"
            disabled={coreFieldDisabled("mode")}
            error={submitted && !!errors.mode}
          />
        </Field>

        <Field label="Starting Date" error={submitted ? errors.startDate : undefined}>
          <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
        </Field>

        <Field label="Ending Date" error={submitted ? errors.endDate : undefined} hint={inclusiveDays ? `Days: ${inclusiveDays}` : undefined}>
          <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
        </Field>

        <Field label="Number of Days" hint="Inclusive day count">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{inclusiveDays ?? "-"}</div>
        </Field>

        <Field label="Name of the Faculty Development Program" error={submitted ? errors.programName : undefined}>
          <input
            value={form.programName || ""}
            onChange={(e) => setForm((c) => ({ ...c, programName: e.target.value }))}
            disabled={coreFieldDisabled("programName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.programName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("programName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
        Coordinator: <span className="font-medium text-foreground">{userDisplayName || "-"}</span>
      </div>

      <div className="mt-5">
        <FacultyPickerRows
          title="Co-coordinator(s)"
          helperText="Add co-coordinators only when applicable."
          addLabel="Add Co-coordinator"
          rowLabelPrefix="Co-coordinator"
          rows={form.coCoordinators}
          onRowsChange={(rows) => setForm((c) => ({ ...c, coCoordinators: rows }))}
          onPersistRow={async (rows) => persistCoCoordinatorRows(rows)}
          facultyOptions={FACULTY_OPTIONS}
          parentLocked={coreFieldDisabled("coCoordinators")}
          viewOnly={isViewMode}
          disableEmails={[form.coordinatorEmail || email]}
          sectionError={errors.coCoordinators}
          showSectionError={submitted}
          emptyStateText="No co-coordinators added."
          validateRow={(rows, row, index) => {
            if (!row.email) return "Select a faculty member from the list.";
            const coordEmail = form.coordinatorEmail || email;
            if (row.email.trim().toLowerCase() === coordEmail.trim().toLowerCase()) {
              return "This faculty is already selected in another role.";
            }
            const duplicates = rows.filter(
              (item, itemIndex) =>
                itemIndex !== index && item.email.trim().toLowerCase() === row.email.trim().toLowerCase()
            ).length;
            return duplicates > 0 ? "This faculty is already selected in another role." : null;
          }}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Sponsored" error={submitted ? errors.sponsored : undefined}>
          <SelectDropdown
            value={form.sponsored || ""}
            onChange={(value) => setForm((c) => ({ ...c, sponsored: value, ...(value !== "Yes" ? { fundingAgency: "", fundingAmount: null } : {}) }))}
            options={SPONSORED_OPTIONS}
            placeholder="Select"
            disabled={coreFieldDisabled("sponsored")}
            error={submitted && !!errors.sponsored}
          />
        </Field>

        {form.sponsored === "Yes" && (
          <>
            <Field label="Name of the Funding Agency" error={submitted ? errors.fundingAgency : undefined}>
              <input
                value={form.fundingAgency || ""}
                onChange={(e) => setForm((c) => ({ ...c, fundingAgency: e.target.value }))}
                disabled={coreFieldDisabled("fundingAgency")}
                className={cx(
                  "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
                  submitted && errors.fundingAgency ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
                  coreFieldDisabled("fundingAgency") && "cursor-not-allowed opacity-60",
                )}
              />
            </Field>

            <Field label="Amount of Funding (₹) — optional" error={submitted ? errors.fundingAmount : undefined} hint="Numbers only">
              <CurrencyField
                value={form.fundingAmount === null ? "" : String(form.fundingAmount)}
                onChange={(value) => setForm((c) => ({ ...c, fundingAmount: value === "" ? null : Number(value) }))}
                disabled={coreFieldDisabled("fundingAmount")}
                error={submitted && !!errors.fundingAmount}
                placeholder="50000"
              />
            </Field>
          </>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <p className="text-sm text-muted-foreground">Streaks apply only for upcoming FDP dates.</p>

        {uploadsVisible ? (
          <>
            <StageTwoDivider />
            <div className="animate-highlight-new grid gap-4 sm:grid-cols-2">
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

              <UploadFieldMulti
                key={form.id}
                title="Geotagged Photos"
                value={form.geotaggedPhotos}
                onUploaded={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      geotaggedPhotos: [...current.geotaggedPhotos, meta],
                    }),
                  });
                }}
                onDeleted={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      geotaggedPhotos: current.geotaggedPhotos.filter(
                        (item) => item.storedPath !== meta.storedPath
                      ),
                    }),
                  });
                }}
                uploadEndpoint="/api/me/fdp-conducted/file"
                email={email}
                recordId={form.id}
                slotName="geotaggedPhotos"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.geotaggedPhotos}
                onStatusChange={setPhotoUploadStatus}
                disabled={controlsDisabled}
                viewOnly={isViewMode}
              />

              <UploadField
                title="Upload Attendance Sheet"
                mode={isViewMode ? "view" : "edit"}
                meta={form.attendanceSheet}
                pendingFile={attendanceController.pendingFile}
                progress={attendanceController.progress}
                busy={attendanceController.busy || uploadPersisting}
                error={attendanceController.error}
                canChoose={attendanceController.canChoose && !uploadPersisting}
                canUpload={attendanceController.canUpload && !uploadPersisting}
                canDelete={attendanceController.canDelete && !uploadPersisting}
                needsEntry={attendanceController.needsEntry}
                onSelectFile={attendanceController.selectFile}
                onUpload={() => void uploadSlot("attendanceSheet")}
                onDelete={() => void deleteSlot("attendanceSheet")}
                showValidationError={submitAttemptedFinal}
                validationMessage={errors.attendanceSheet}
              />

              <Field label="Number of Participants">
                <input
                  type="number"
                  min="0"
                  value={form.numberOfParticipants === null ? "" : String(form.numberOfParticipants)}
                  onChange={(e) => setForm((c) => ({ ...c, numberOfParticipants: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  className={cx(
                    "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
                    "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
                    controlsDisabled && "cursor-not-allowed opacity-60",
                  )}
                  placeholder="e.g. 45"
                />
              </Field>

              <UploadField
                title="Upload Official Poster"
                mode={isViewMode ? "view" : "edit"}
                meta={form.officialPoster}
                pendingFile={posterController.pendingFile}
                progress={posterController.progress}
                busy={posterController.busy || uploadPersisting}
                error={posterController.error}
                canChoose={posterController.canChoose && !uploadPersisting}
                canUpload={posterController.canUpload && !uploadPersisting}
                canDelete={posterController.canDelete && !uploadPersisting}
                needsEntry={posterController.needsEntry}
                onSelectFile={posterController.selectFile}
                onUpload={() => void uploadSlot("officialPoster")}
                onDelete={() => void deleteSlot("officialPoster")}
                showValidationError={submitAttemptedFinal}
                validationMessage={errors.officialPoster}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function FdpConductedPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<FdpConducted>
      {...props}
      category="fdp-conducted"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => entry}
      validateFields={validateFields}
      renderFormFields={(ctx) => <FdpConductedFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.programName || "").trim() || "Untitled FDP"}
      buildListEntrySubtitle={(entry) => {
        const parts = [`Coordinator: ${entry.coordinatorName || entry.coordinatorEmail || "-"}`];
        if (entry.coCoordinators.length > 0) {
          parts.push(`Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`);
        }
        return parts.join(" • ");
      }}
      renderListEntryBody={({ entry }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} Semester`);
        if (entry.level) parts.push(entry.level);
        if (entry.mode) parts.push(entry.mode);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} days`);
        if (entry.sponsored === "Yes" && entry.fundingAgency) {
          const fundingStr = entry.fundingAmount ? `${entry.fundingAgency} (₹${entry.fundingAmount.toLocaleString("en-IN")})` : entry.fundingAgency;
          parts.push(`Funded by ${fundingStr}`);
        }
        if (typeof entry.numberOfParticipants === "number") parts.push(`${entry.numberOfParticipants} participants`);
        return (
          <>
            {parts.length > 0 && <div className="text-xs text-muted-foreground">{parts.join(" • ")}</div>}
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {entry.permissionLetter ? (
                <a className="underline" href={entry.permissionLetter.url} target="_blank" rel="noreferrer">
                  Permission Letter
                </a>
              ) : null}
              {entry.geotaggedPhotos.map((meta, photoIndex) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Geotagged Photo {photoIndex + 1}
                </a>
              ))}
              {entry.attendanceSheet ? (
                <a className="underline" href={entry.attendanceSheet.url} target="_blank" rel="noreferrer">
                  Attendance Sheet
                </a>
              ) : null}
              {entry.officialPoster ? (
                <a className="underline" href={entry.officialPoster.url} target="_blank" rel="noreferrer">
                  Official Poster
                </a>
              ) : null}
            </div>
          </>
        );
      }}
      title="FDP — Conducted"
      subtitle="Record faculty development programmes conducted, along with coordinator details and supporting documents."
      formTitle="FDP Entry"
      formSubtitle="Add the entry details and generate the entry to unlock uploads."
      deleteDescription="This permanently deletes this FDP entry and its associated uploaded files."
    />
  );
}

export default FdpConductedPage;
