"use client";

import { useState } from "react";
import DateField from "@/components/controls/DateField";
import Field from "@/components/data-entry/Field";
import SelectDropdown from "@/components/controls/SelectDropdown";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import MultiPhotoUpload from "@/components/entry/UploadFieldMulti";
import EntryUploader from "@/components/upload/EntryUploader";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS, getAcademicYearRange } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { cx, uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { FACULTY } from "@/lib/facultyDirectory";
import { hydratePdfSnapshot } from "@/lib/pdfSnapshot";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import type { FileMeta } from "@/lib/types/entry";
import type { WorkshopEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

type UploadSlot =
  | "permissionLetter"
  | "brochure"
  | "attendance"
  | "organiserProfile";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPLOAD_CONFIG: Array<{ slot: UploadSlot; label: string }> = [
  { slot: "permissionLetter", label: "Permission Letter" },
  { slot: "brochure", label: "Brochure" },
  { slot: "attendance", label: "Attendance" },
  { slot: "organiserProfile", label: "Organiser Profile" },
];

const FACULTY_OPTIONS = FACULTY;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyUploads(): Record<UploadSlot, FileMeta | null> {
  return {
    permissionLetter: null,
    brochure: null,
    attendance: null,
    organiserProfile: null,
  };
}

function emptyFacultySelection(): FacultyRowValue {
  return { id: uuid(), name: "", email: "", isLocked: false, savedAtISO: null };
}

function emptyForm(): WorkshopEntry {
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
    speakerName: "",
    organisationName: "",
    coordinator: emptyFacultySelection(),
    coCoordinators: [],
    participants: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    uploads: {
      ...emptyUploads(),
      geotaggedPhotos: [],
    },
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as WorkshopEntry;
}

function hydrateEntry(entry: WorkshopEntry): WorkshopEntry {
  return withAcademicProgressionCompatibility(
    hydratePdfSnapshot(entry, "workshops") as WorkshopEntry,
  ) as WorkshopEntry;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: WorkshopEntry): Record<string, string> {
  const errors = validateEntryFields("workshops", form as unknown as Record<string, unknown>);

  // Category-specific: empty co-coordinator rows
  if (form.coCoordinators.some((value) => value.name.trim().length === 0)) {
    errors.coCoordinators = "Remove empty co-coordinator rows or fill them in.";
  }

  // Category-specific: duplicate co-coordinator emails
  const emailCounts = new Map<string, number>();
  [form.coordinator.email, ...form.coCoordinators.map((value) => value.email)]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .forEach((value) => {
      emailCounts.set(value, (emailCounts.get(value) ?? 0) + 1);
    });
  form.coCoordinators.forEach((value, index) => {
    if (!value.email) {
      errors[`coCoordinators.${index}`] = "Select a faculty member from the list.";
      return;
    }
    if ((emailCounts.get(value.email.toLowerCase()) ?? 0) > 1) {
      errors[`coCoordinators.${index}`] = "This faculty is already selected in another role.";
    }
  });

  // Category-specific: participants must be > 0
  if (form.participants !== null && (!Number.isFinite(form.participants) || form.participants <= 0)) {
    errors.participants = "Participants must be greater than 0.";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function WorkshopFormFields({ ctx }: { ctx: FormFieldsContext<WorkshopEntry> }) {
  const { form, setForm, submitted, errors, coreFieldDisabled, isViewMode, uploadsVisible, persistCurrentMutation, submitAttemptedFinal, controlsDisabled } = ctx;

  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);

  const [, setSingleUploadStatus] = useState<Record<UploadSlot, { hasPending: boolean; busy: boolean }>>({
    permissionLetter: { hasPending: false, busy: false },
    brochure: { hasPending: false, busy: false },
    attendance: { hasPending: false, busy: false },
    organiserProfile: { hasPending: false, busy: false },
  });
  const [, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete =
    !!form.uploads.permissionLetter &&
    !!form.uploads.brochure &&
    !!form.uploads.attendance &&
    !!form.uploads.organiserProfile &&
    form.uploads.geotaggedPhotos.length > 0;

  async function persistCoCoordinatorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) =>
        withAcademicProgressionCompatibility({
          ...current,
          coCoordinators: nextRows,
        }) as WorkshopEntry,
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
                return withAcademicProgressionCompatibility({ ...c, yearOfStudy: nextYear, currentSemester: nextSemester }) as WorkshopEntry;
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
            onChange={(value) => setForm((c) => withAcademicProgressionCompatibility({ ...c, currentSemester: value ? Number(value) : null }) as WorkshopEntry)}
            options={semesterOptions.map((o) => ({ label: String(o), value: String(o) }))}
            placeholder={normalizedStudentYear ? "Select current semester" : "Select year of study first"}
            disabled={coreFieldDisabled("currentSemester") || !normalizedStudentYear}
            error={submitted && !!errors.currentSemester}
          />
        </Field>

        <Field label="Start Date" error={submitted ? errors.startDate : undefined} hint={form.academicYear ? getAcademicYearRange(form.academicYear)?.label : undefined}>
          <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
        </Field>

        <Field label="End Date" error={submitted ? errors.endDate : undefined} hint={inclusiveDays ? `Number of Days: ${inclusiveDays}` : "Number of Days will be calculated automatically."}>
          <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
        </Field>

        <Field label="Name of the Event" error={submitted ? errors.eventName : undefined}>
          <input
            value={form.eventName}
            onChange={(e) => setForm((c) => ({ ...c, eventName: e.target.value }))}
            disabled={coreFieldDisabled("eventName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.eventName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("eventName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Name of the Speaker" error={submitted ? errors.speakerName : undefined}>
          <input
            value={form.speakerName}
            onChange={(e) => setForm((c) => ({ ...c, speakerName: e.target.value }))}
            disabled={coreFieldDisabled("speakerName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.speakerName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("speakerName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Name of the Organisation" error={submitted ? errors.organisationName : undefined}>
          <input
            value={form.organisationName}
            onChange={(e) => setForm((c) => ({ ...c, organisationName: e.target.value }))}
            disabled={coreFieldDisabled("organisationName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.organisationName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("organisationName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
        Coordinator:{" "}
        <span className="font-medium text-foreground">
          {ctx.userDisplayName || form.coordinator.name || "-"}
        </span>
      </div>

      <div className="mt-5">
        <FacultyRowPicker
          title="Co-coordinator(s)"
          helperText="Add co-coordinators only when applicable."
          addLabel="Add Co-coordinator"
          rowLabelPrefix="Co-coordinator"
          rows={form.coCoordinators}
          onRowsChange={(rows) => setForm((c) => ({ ...c, coCoordinators: rows }))}
          onPersistRow={async (rows) => persistCoCoordinatorRows(rows)}
          facultyOptions={FACULTY_OPTIONS}
          disableEmails={[form.coordinator.email]}
          parentLocked={coreFieldDisabled("coCoordinators")}
          viewOnly={isViewMode}
          sectionError={errors.coCoordinators}
          showSectionError={submitted}
          emptyStateText="No co-coordinators added."
          validateRow={(rows, row, index) => {
            if (!row.email) return "Select a faculty member from the list.";
            const duplicates = rows.filter(
              (item, itemIndex) =>
                itemIndex !== index &&
                item.email.trim().toLowerCase() === row.email.trim().toLowerCase(),
            ).length;
            return duplicates > 0 ? "This faculty is already selected in another role." : null;
          }}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Number of Participants" error={submitted ? errors.participants : undefined} hint="Optional. Digits only">
          <input
            inputMode="numeric"
            value={form.participants === null ? "" : String(form.participants)}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setForm((c) => ({ ...c, participants: digits === "" ? null : Number(digits) }));
            }}
            disabled={coreFieldDisabled("participants")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.participants ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("participants") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>
      </div>

      <div className="mt-5 space-y-4">
        {uploadsVisible ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {UPLOAD_CONFIG.map(({ slot, label }) => (
              <EntryUploader
                key={slot}
                title={label}
                mode={isViewMode ? "view" : "edit"}
                meta={form.uploads[slot]}
                uploadEndpoint="/api/me/workshops/file"
                email={ctx.email}
                recordId={form.id}
                slot={slot}
                disabled={controlsDisabled}
                showValidationError={submitAttemptedFinal}
                validationMessage="This upload is mandatory."
                onStatusChange={(status) =>
                  setSingleUploadStatus((current) => ({
                    ...current,
                    [slot]: status,
                  }))
                }
                onUploaded={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      uploads: { ...current.uploads, [slot]: meta },
                    }),
                  });
                }}
                onDeleted={async () => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      uploads: { ...current.uploads, [slot]: null },
                    }),
                  });
                }}
              />
            ))}

            <MultiPhotoUpload
              title="Geotagged Photos"
              value={form.uploads.geotaggedPhotos}
              onUploaded={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => ({
                    ...current,
                    uploads: {
                      ...current.uploads,
                      geotaggedPhotos: [...current.uploads.geotaggedPhotos, meta],
                    },
                  }),
                });
              }}
              onDeleted={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => ({
                    ...current,
                    uploads: {
                      ...current.uploads,
                      geotaggedPhotos: current.uploads.geotaggedPhotos.filter(
                        (item) => item.storedPath !== meta.storedPath,
                      ),
                    },
                  }),
                });
              }}
              uploadEndpoint="/api/me/workshops/file"
              email={ctx.email}
              recordId={form.id}
              slotName="geotaggedPhotos"
              disabled={controlsDisabled}
              viewOnly={isViewMode}
              showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
              requiredErrorText="At least one geotagged photo is required."
              onStatusChange={setPhotoUploadStatus}
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

export function WorkshopsPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<WorkshopEntry>
      {...props}
      category="workshops"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => hydrateEntry(entry)}
      validateFields={validateFields}
      renderFormFields={(ctx) => <WorkshopFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => entry.eventName}
      buildListEntrySubtitle={(entry) => `Speaker: ${entry.speakerName} \u2022 ${entry.organisationName}`}
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
        if (entry.participants) parts.push(`${entry.participants} participants`);

        const people: string[] = [];
        const coord = formatFacultyDisplay(entry.coordinator);
        if (coord) people.push(coord);
        if (entry.coCoordinators.length > 0) people.push(...entry.coCoordinators.map(formatFacultyDisplay).filter(Boolean));

        return (
          <>
            {parts.length > 0 && <div className="text-xs text-muted-foreground">{parts.join(" \u2022 ")}</div>}
            {people.length > 0 && <div className="text-xs text-muted-foreground">{people.join(", ")}</div>}
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {UPLOAD_CONFIG.map(({ slot, label }) =>
                entry.uploads[slot] ? (
                  <a key={slot} className="underline" href={entry.uploads[slot]?.url ?? "#"} target="_blank" rel="noreferrer">{label}</a>
                ) : null,
              )}
              {entry.uploads.geotaggedPhotos.map((meta, photoIndex) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">Geotagged Photo {photoIndex + 1}</a>
              ))}
            </div>
          </>
        );
      }}
      title="Workshops"
      subtitle="Record workshop details and supporting documents."
      formTitle="Workshop Entry"
      formSubtitle="Add the entry details and generate the entry to unlock uploads."
      deleteDescription="This permanently deletes this workshop entry and its associated uploaded files."
    />
  );
}

export default WorkshopsPage;
