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
import { hashPrePdfFields, hydratePdfSnapshot } from "@/lib/pdfSnapshot";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import type { FileMeta } from "@/lib/types/entry";
import type { GuestLectureEntry, UploadStatus } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

type UploadSlot =
  | "permissionLetter"
  | "brochure"
  | "attendance"
  | "speakerProfile";

const UPLOAD_CONFIG: Array<{ slot: UploadSlot; label: string }> = [
  { slot: "permissionLetter", label: "Permission Letter" },
  { slot: "brochure", label: "Brochure" },
  { slot: "attendance", label: "Attendance" },
  { slot: "speakerProfile", label: "Speaker Profile" },
];
const EMPTY_UPLOAD_STATUS: Record<UploadSlot, UploadStatus> = {
  permissionLetter: { hasPending: false, busy: false },
  brochure: { hasPending: false, busy: false },
  attendance: { hasPending: false, busy: false },
  speakerProfile: { hasPending: false, busy: false },
};
const FACULTY_OPTIONS = FACULTY;

function emptyUploads(): Record<UploadSlot, FileMeta | null> {
  return {
    permissionLetter: null,
    brochure: null,
    attendance: null,
    speakerProfile: null,
  };
}

function emptyFacultySelection(): FacultyRowValue {
  return { id: uuid(), name: "", email: "", isLocked: false, savedAtISO: null };
}

function emptyForm(): GuestLectureEntry {
  return withAcademicProgressionCompatibility({
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    academicYear: "",
    startDate: "",
    endDate: "",
    eventName: "",
    speakerName: "",
    organizationName: "",
    coordinator: emptyFacultySelection(),
    coCoordinators: [],
    yearOfStudy: "",
    currentSemester: null,
    participants: null,
    pdfMeta: null,
    pdfSourceHash: "",
    pdfStale: false,
    uploads: {
      ...emptyUploads(),
      geotaggedPhotos: [],
    },
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as GuestLectureEntry;
}

function hydrateEntry(entry: GuestLectureEntry): GuestLectureEntry {
  return withAcademicProgressionCompatibility(
    hydratePdfSnapshot(entry, "guest-lectures") as GuestLectureEntry,
  ) as GuestLectureEntry;
}

function validateFields(form: GuestLectureEntry): Record<string, string> {
  const errors = validateEntryFields("guest-lectures", form as unknown as Record<string, unknown>);

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

function GuestLectureFormFields({ ctx }: { ctx: FormFieldsContext<GuestLectureEntry> }) {
  const {
    form,
    setForm,
    submitted,
    errors,
    coreFieldDisabled,
    controlsDisabled,
    isViewMode,
    uploadsVisible,
    submitAttemptedFinal,
    persistCurrentMutation,
    email,
    userDisplayName,
  } = ctx;

  const [singleUploadStatus, setSingleUploadStatus] =
    useState<Record<UploadSlot, UploadStatus>>(EMPTY_UPLOAD_STATUS);
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  // Suppress lint warnings for UI-only state
  void singleUploadStatus;
  void photoUploadStatus;

  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);

  const coordinatorEmail = email || form.coordinator.email;
  const coordinatorDisplay = userDisplayName || form.coordinator.name || "-";

  async function persistCoCoordinatorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) =>
        withAcademicProgressionCompatibility({
          ...current,
          coCoordinators: nextRows,
        }) as GuestLectureEntry,
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

        <Field
          label="Start Date"
          error={submitted ? errors.startDate : undefined}
          hint={form.academicYear ? getAcademicYearRange(form.academicYear)?.label : undefined}
        >
          <DateField
            value={form.startDate}
            onChange={(next) => setForm((c) => ({ ...c, startDate: next }))}
            disabled={coreFieldDisabled("startDate")}
            error={submitted && !!errors.startDate}
          />
        </Field>

        <Field
          label="End Date"
          error={submitted ? errors.endDate : undefined}
          hint={
            inclusiveDays
              ? `Number of Days: ${inclusiveDays}`
              : "Number of Days will be calculated automatically."
          }
        >
          <DateField
            value={form.endDate}
            onChange={(next) => setForm((c) => ({ ...c, endDate: next }))}
            disabled={coreFieldDisabled("endDate")}
            error={submitted && !!errors.endDate}
          />
        </Field>

        <Field label="Name of the Event" error={submitted ? errors.eventName : undefined}>
          <input
            value={form.eventName}
            onChange={(e) => setForm((c) => ({ ...c, eventName: e.target.value }))}
            disabled={coreFieldDisabled("eventName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.eventName
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
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
              submitted && errors.speakerName
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("speakerName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Name of the Organization" error={submitted ? errors.organizationName : undefined}>
          <input
            value={form.organizationName}
            onChange={(e) => setForm((c) => ({ ...c, organizationName: e.target.value }))}
            disabled={coreFieldDisabled("organizationName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.organizationName
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("organizationName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
        Coordinator:{" "}
        <span className="font-medium text-foreground">{coordinatorDisplay}</span>
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
          disableEmails={[coordinatorEmail]}
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
        <Field label="Year of Study" error={submitted ? errors.yearOfStudy : undefined}>
          <SelectDropdown
            value={form.yearOfStudy}
            onChange={(value) =>
              setForm((c) => {
                const nextYear = normalizeYearOfStudy(value) ?? "";
                const nextSemester = isSemesterAllowed(
                  nextYear || undefined,
                  c.currentSemester ?? undefined,
                )
                  ? c.currentSemester
                  : null;
                return withAcademicProgressionCompatibility({
                  ...c,
                  yearOfStudy: nextYear,
                  currentSemester: nextSemester,
                }) as GuestLectureEntry;
              })
            }
            options={YEAR_OF_STUDY_OPTIONS}
            placeholder="Select year"
            disabled={coreFieldDisabled("yearOfStudy")}
            error={submitted && !!errors.yearOfStudy}
          />
        </Field>

        <Field
          label="Current Semester"
          error={submitted ? errors.currentSemester : undefined}
          hint={normalizedStudentYear ? "Select semester (based on year)" : "Select year of study first"}
        >
          <SelectDropdown
            value={form.currentSemester === null ? "" : String(form.currentSemester)}
            disabled={coreFieldDisabled("currentSemester") || !normalizedStudentYear}
            onChange={(value) =>
              setForm((c) =>
                withAcademicProgressionCompatibility({
                  ...c,
                  currentSemester: value ? Number(value) : null,
                }) as GuestLectureEntry,
              )
            }
            options={semesterOptions.map((o) => ({ label: String(o), value: String(o) }))}
            placeholder={normalizedStudentYear ? "Select current semester" : "Select year of study first"}
            error={submitted && !!errors.currentSemester}
          />
        </Field>

        <Field
          label="Number of Participants"
          error={submitted ? errors.participants : undefined}
          hint="Digits only"
        >
          <input
            inputMode="numeric"
            value={form.participants === null ? "" : String(form.participants)}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setForm((c) => ({
                ...c,
                participants: digits === "" ? null : Number(digits),
              }));
            }}
            disabled={coreFieldDisabled("participants")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.participants
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
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
                uploadEndpoint="/api/me/guest-lectures/file"
                email={email}
                recordId={form.id}
                slot={slot}
                disabled={controlsDisabled}
                showValidationError={submitAttemptedFinal}
                validationMessage="This upload is mandatory."
                onStatusChange={(status) =>
                  setSingleUploadStatus((c) => ({ ...c, [slot]: status }))
                }
                onUploaded={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => {
                      const next = { ...current, uploads: { ...current.uploads, [slot]: meta } };
                      if (current.pdfSourceHash) {
                        (next as Record<string, unknown>).pdfSourceHash = hashPrePdfFields(next, "guest-lectures");
                      }
                      return next;
                    },
                  });
                }}
                onDeleted={async () => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => {
                      const next = { ...current, uploads: { ...current.uploads, [slot]: null } };
                      if (current.pdfSourceHash) {
                        (next as Record<string, unknown>).pdfSourceHash = hashPrePdfFields(next, "guest-lectures");
                      }
                      return next;
                    },
                  });
                }}
              />
            ))}

            <MultiPhotoUpload
              title="Geotagged Photos"
              value={form.uploads.geotaggedPhotos}
              onUploaded={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => {
                    const next = {
                      ...current,
                      uploads: { ...current.uploads, geotaggedPhotos: [...current.uploads.geotaggedPhotos, meta] },
                    };
                    if (current.pdfSourceHash) {
                      (next as Record<string, unknown>).pdfSourceHash = hashPrePdfFields(next, "guest-lectures");
                    }
                    return next;
                  },
                });
              }}
              onDeleted={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => {
                    const next = {
                      ...current,
                      uploads: {
                        ...current.uploads,
                        geotaggedPhotos: current.uploads.geotaggedPhotos.filter(
                          (item) => item.storedPath !== meta.storedPath,
                        ),
                      },
                    };
                    if (current.pdfSourceHash) {
                      (next as Record<string, unknown>).pdfSourceHash = hashPrePdfFields(next, "guest-lectures");
                    }
                    return next;
                  },
                });
              }}
              uploadEndpoint="/api/me/guest-lectures/file"
              email={email}
              recordId={form.id}
              slotName="geotaggedPhotos"
              disabled={controlsDisabled}
              viewOnly={isViewMode}
              showRequiredError={submitAttemptedFinal && form.uploads.geotaggedPhotos.length === 0}
              requiredErrorText="At least one geotagged photo is required."
              onStatusChange={setPhotoUploadStatus}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

export function GuestLecturesPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<GuestLectureEntry>
      {...props}
      category="guest-lectures"
      emptyForm={emptyForm}
      hydrateEntry={hydrateEntry}
      validateFields={validateFields}
      renderFormFields={(ctx) => <GuestLectureFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => entry.eventName}
      buildListEntrySubtitle={(entry) => `Speaker: ${entry.speakerName} • ${entry.organizationName}`}
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
        if (entry.participants) parts.push(`${entry.participants} participants`);

        const people: string[] = [];
        const coord = formatFacultyDisplay(entry.coordinator);
        if (coord) people.push(coord);
        if (entry.coCoordinators.length > 0) {
          people.push(...entry.coCoordinators.map(formatFacultyDisplay).filter(Boolean));
        }

        return (
          <>
            {parts.length > 0 && (
              <div className="text-xs text-muted-foreground">{parts.join(" • ")}</div>
            )}
            {people.length > 0 && (
              <div className="text-xs text-muted-foreground">{people.join(", ")}</div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {UPLOAD_CONFIG.map(({ slot, label }) =>
                entry.uploads[slot] ? (
                  <a
                    key={slot}
                    className="underline"
                    href={entry.uploads[slot]?.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label}
                  </a>
                ) : null,
              )}
              {entry.uploads.geotaggedPhotos.map((meta, photoIndex) => (
                <a
                  key={meta.storedPath}
                  className="underline"
                  href={meta.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Geotagged Photo {photoIndex + 1}
                </a>
              ))}
            </div>
          </>
        );
      }}
      title="Guest Lectures"
      subtitle="Record event details, student participation, and the required supporting documents."
      formTitle="Guest Lecture Entry"
      formSubtitle="Add the entry details and generate the entry to unlock uploads."
      deleteDescription="This permanently deletes this guest-lecture entry and its associated uploaded files."
    />
  );
}

export default GuestLecturesPage;
