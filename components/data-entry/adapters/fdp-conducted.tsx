"use client";

import { useState } from "react";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadField from "@/components/entry/UploadField";
import UploadFieldMulti, { type FileMeta } from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import FacultyPickerRows, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { useUploadController } from "@/hooks/useUploadController";
import { FACULTY_DIRECTORY, type FacultyDirectoryEntry } from "@/lib/faculty-directory";
import {
  cx,
  uuid,
  getInclusiveDays,
  formatDisplayDate,
  formatFacultyDisplay,
  ACADEMIC_YEAR_DROPDOWN_OPTIONS,
} from "@/components/data-entry/adapters/shared";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
  type YearOfStudy,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import { uploadFile } from "@/lib/upload/uploadService";
import type { FdpConducted } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FACULTY_OPTIONS: FacultyDirectoryEntry[] = FACULTY_DIRECTORY;

function emptyForm(): FdpConducted {
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
    eventName: "",
    coordinatorName: "",
    coordinatorEmail: "",
    coCoordinators: [],
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: null,
    geotaggedPhotos: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as FdpConducted;
}

function uploadConductedFileXHR(opts: {
  recordId: string;
  slot: "permissionLetter";
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
    .map((v) => v.trim().toLowerCase())
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

  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete = !!form.permissionLetter && form.geotaggedPhotos.length > 0;

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

  async function uploadSlot() {
    const previousMeta = form.permissionLetter;
    try {
      const meta = await permissionController.uploadAndSave();
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
          buildNextEntry: (current) => ({ ...current, permissionLetter: meta }),
        });
      } finally {
        setUploadPersistingCount((c) => Math.max(0, c - 1));
      }
    } catch (error) {
      showToast("err", error instanceof Error ? error.message : "Upload failed.", 1800);
    }
  }

  async function deleteSlot() {
    const meta = form.permissionLetter;
    if (!meta?.storedPath) { showToast("err", "File path missing.", 1500); return; }
    try {
      const deleted = await permissionController.deleteFile(meta);
      if (!deleted) return;
      setUploadPersistingCount((c) => c + 1);
      try {
        await persistCurrentMutation({
          buildNextEntry: (current) => ({ ...current, permissionLetter: null }),
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
                return withAcademicProgressionCompatibility({ ...c, yearOfStudy: nextYear, currentSemester: nextSemester }) as FdpConducted;
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
            onChange={(value) => setForm((c) => withAcademicProgressionCompatibility({ ...c, currentSemester: value ? Number(value) : null }) as FdpConducted)}
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

        <Field label="Name of the Event" error={submitted ? errors.eventName : undefined}>
          <input
            value={form.eventName}
            onChange={(e) => setForm((c) => ({ ...c, eventName: e.target.value }))}
            disabled={coreFieldDisabled("eventName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-400",
              submitted && errors.eventName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("eventName") && "cursor-not-allowed opacity-60",
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
            const coordinatorEmail = form.coordinatorEmail || email;
            if (row.email.trim().toLowerCase() === coordinatorEmail.trim().toLowerCase()) {
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
              onUpload={() => void uploadSlot()}
              onDelete={() => void deleteSlot()}
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
          </div>
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
      hydrateEntry={(entry) => withAcademicProgressionCompatibility(entry) as FdpConducted}
      validateFields={validateFields}
      renderFormFields={(ctx) => <FdpConductedFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => entry.eventName.trim() || "Untitled event"}
      buildListEntrySubtitle={(entry) => {
        const parts = [`Coordinator: ${entry.coordinatorName || entry.coordinatorEmail || "-"}`];
        if (entry.coCoordinators.length > 0) {
          parts.push(`Co-coordinator(s): ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`);
        }
        return parts.join(" \u2022 ");
      }}
      renderListEntryBody={({ entry }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.currentSemester) parts.push(`Semester ${entry.currentSemester}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} \u2013 ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} days`);
        return (
          <>
            {parts.length > 0 && <div className="text-xs text-muted-foreground">{parts.join(" \u2022 ")}</div>}
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
            </div>
          </>
        );
      }}
      title="FDP \u2014 Conducted"
      subtitle="Record FDPs conducted with duration and the required supporting documents."
      formTitle="FDP Entry"
      formSubtitle="Add the entry details and generate the entry to unlock uploads."
      deleteDescription="This permanently deletes this FDP entry and its associated uploaded files."
    />
  );
}

export default FdpConductedPage;
