"use client";

import { useMemo, useState } from "react";
import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import EntryUploader from "@/components/upload/EntryUploader";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import MultiPhotoUpload from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_OPTIONS, ACADEMIC_YEAR_DROPDOWN_OPTIONS, getAcademicYearRange } from "@/lib/utils/academicYear";
import { isISODate, getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { cx, uuid } from "@/lib/utils/idHelpers";
import { FACULTY } from "@/lib/facultyDirectory";
import { nowISTTimestampISO } from "@/lib/time";
import { hydratePdfSnapshot } from "@/lib/pdfSnapshot";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
  type YearOfStudy,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import type { StaffSelection, CaseStudyEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

const SINGLE_UPLOAD_SLOTS: Array<{ slot: "permissionLetter" | "travelPlan"; label: string }> = [
  { slot: "permissionLetter", label: "Permission Letter" },
  { slot: "travelPlan", label: "Travel Plan" },
];

const FACULTY_OPTIONS = FACULTY;

function buildStaffKey(selection: StaffSelection) {
  const email = selection.email.trim().toLowerCase();
  if (email) return `email:${email}`;
  return `name:${selection.name.trim().toLowerCase()}`;
}

function emptyStaff(): StaffSelection {
  return { id: uuid(), name: "", email: "", isLocked: false, savedAtISO: null };
}

function emptyForm(): CaseStudyEntry {
  return withAcademicProgressionCompatibility({
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    academicYear: "",
    startDate: "",
    endDate: "",
    coordinator: emptyStaff(),
    placeOfVisit: "",
    purposeOfVisit: "",
    staffAccompanying: [],
    yearOfStudy: "",
    currentSemester: null,
    participants: null,
    amountSupport: null,
    pdfMeta: null,
    pdfSourceHash: "",
    pdfStale: false,
    permissionLetter: null,
    travelPlan: null,
    geotaggedPhotos: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as CaseStudyEntry;
}

function hydrateEntry(entry: CaseStudyEntry): CaseStudyEntry {
  return withAcademicProgressionCompatibility(
    hydratePdfSnapshot(entry, "case-studies") as CaseStudyEntry,
  ) as CaseStudyEntry;
}

function validateFields(form: CaseStudyEntry): Record<string, string> {
  const errors = validateEntryFields("case-studies", form as unknown as Record<string, unknown>);

  // Category-specific: staffAccompanying duplicate detection
  const duplicateKeys = new Map<string, number>();
  form.staffAccompanying.forEach((staff) => {
    const key = buildStaffKey(staff);
    if (key !== "name:") {
      duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
    }
  });
  form.staffAccompanying.forEach((staff, index) => {
    if (!staff.name.trim()) {
      errors[`staffAccompanying.${index}`] = "Staff member is required.";
      return;
    }
    const key = buildStaffKey(staff);
    if (key !== "name:" && (duplicateKeys.get(key) ?? 0) > 1) {
      errors[`staffAccompanying.${index}`] = "This faculty is already selected in another row.";
    }
  });

  return errors;
}

function validateRowForFacultySave(entryDraft: CaseStudyEntry, row: StaffSelection) {
  const selectedEmail = row.email.trim().toLowerCase();
  if (!selectedEmail) {
    return { ok: false, error: "Select a faculty member first." };
  }

  const matchingFaculty = FACULTY_OPTIONS.find((f) => f.email.trim().toLowerCase() === selectedEmail);
  if (!matchingFaculty) {
    return { ok: false, error: "Select a listed faculty member." };
  }

  const duplicateCount = entryDraft.staffAccompanying.filter(
    (s) => s.email.trim().toLowerCase() === selectedEmail,
  ).length;
  if (duplicateCount > 1) {
    return { ok: false, error: "This faculty is already selected in another row." };
  }

  if (!ACADEMIC_YEAR_OPTIONS.includes(entryDraft.academicYear as (typeof ACADEMIC_YEAR_OPTIONS)[number])) {
    return { ok: false, error: "Select academic year first." };
  }

  if (!isISODate(entryDraft.startDate)) {
    return { ok: false, error: "Select a valid starting date first." };
  }

  const range = getAcademicYearRange(entryDraft.academicYear);
  if (range && (entryDraft.startDate < range.start || entryDraft.startDate > range.end)) {
    return { ok: false, error: `Starting date must fall within ${entryDraft.academicYear}.` };
  }

  if (!isISODate(entryDraft.endDate) || entryDraft.endDate < entryDraft.startDate) {
    return { ok: false, error: "Select a valid ending date first." };
  }

  return { ok: true, error: null };
}

function CaseStudyFormFields({ ctx }: { ctx: FormFieldsContext<CaseStudyEntry> }) {
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
    email,
    userDisplayName,
  } = ctx;

  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);

  const [singleUploadStatus, setSingleUploadStatus] = useState<
    Record<"permissionLetter" | "travelPlan", { hasPending: boolean; busy: boolean }>
  >({
    permissionLetter: { hasPending: false, busy: false },
    travelPlan: { hasPending: false, busy: false },
  });
  const [photoUploadStatus, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  // Keep status in sync — these are unused by BaseEntryAdapter but needed by EntryUploader/MultiPhotoUpload
  void singleUploadStatus;
  void photoUploadStatus;

  const coordinatorRow: FacultyRowValue = useMemo(
    () => ({
      id: form.coordinator?.id ?? "",
      name: userDisplayName,
      email,
      isLocked: true,
      savedAtISO: null,
    }),
    [email, userDisplayName, form.coordinator?.id],
  );

  // ---- Staff persistence via persistCurrentMutation ----

  async function persistStaffRows(
    nextRows: StaffSelection[],
    context: {
      row: StaffSelection;
      rowId: string;
      index: number;
      previousRows: StaffSelection[];
      savedAtISO: string;
    },
  ) {
    const savedRows = nextRows
      .filter((s) => s.isLocked && s.email.trim())
      .map((s) => ({
        ...s,
        email: s.email.trim().toLowerCase(),
        savedAtISO: s.savedAtISO ?? nowISTTimestampISO(),
      }));

    const entryToValidate: CaseStudyEntry = {
      ...form,
      coordinator: coordinatorRow,
      staffAccompanying: nextRows,
    };

    const rowValidation = validateRowForFacultySave(entryToValidate, context.row);
    if (!rowValidation.ok) {
      throw new Error(rowValidation.error ?? "Save faculty failed.");
    }

    const result = await persistCurrentMutation({
      buildNextEntry: (current) => ({
        ...current,
        coordinator: coordinatorRow,
        staffAccompanying: savedRows,
      }),
      selectResult: (persisted) => persisted,
    });

    const savedEntry = result as unknown as CaseStudyEntry;
    const mergedRows = nextRows.map((item) => {
      const savedStaff =
        savedEntry.staffAccompanying?.find(
          (c) => c.email.trim().toLowerCase() === item.email.trim().toLowerCase(),
        ) ?? null;

      return savedStaff
        ? {
            ...item,
            id: savedStaff.id ?? item.id,
            name: savedStaff.name,
            email: savedStaff.email,
            isLocked: !!savedStaff.isLocked,
            savedAtISO: savedStaff.savedAtISO ?? item.savedAtISO ?? null,
          }
        : item;
    });

    setForm((current) => ({
      ...current,
      sharedEntryId: savedEntry.sharedEntryId,
      sourceEmail: savedEntry.sourceEmail,
      coordinator: savedEntry.coordinator,
      createdAt: savedEntry.createdAt,
      updatedAt: savedEntry.updatedAt,
      staffAccompanying: mergedRows,
    }));

    showToast("ok", `Saved for ${context.row.name}.`, 1400);
    return mergedRows;
  }

  const requiredUploadsComplete = !!form.permissionLetter && !!form.travelPlan && form.geotaggedPhotos.length > 0;

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
          label="Starting Date"
          error={submitted ? errors.startDate : undefined}
          hint={form.academicYear ? getAcademicYearRange(form.academicYear)?.label : undefined}
        >
          <DateField
            value={form.startDate}
            onChange={(v) => setForm((c) => ({ ...c, startDate: v }))}
            disabled={coreFieldDisabled("startDate")}
            error={submitted && !!errors.startDate}
          />
        </Field>

        <Field
          label="Ending Date"
          error={submitted ? errors.endDate : undefined}
          hint={
            inclusiveDays
              ? `Number of Days: ${inclusiveDays}`
              : "Number of Days will be calculated automatically."
          }
        >
          <DateField
            value={form.endDate}
            onChange={(v) => setForm((c) => ({ ...c, endDate: v }))}
            disabled={coreFieldDisabled("endDate")}
            error={submitted && !!errors.endDate}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Place of Visit" error={submitted ? errors.placeOfVisit : undefined}>
          <input
            value={form.placeOfVisit}
            onChange={(e) => setForm((c) => ({ ...c, placeOfVisit: e.target.value }))}
            disabled={coreFieldDisabled("placeOfVisit")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-400",
              submitted && errors.placeOfVisit
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
            )}
          />
        </Field>

        <Field label="Purpose of Visit" error={submitted ? errors.purposeOfVisit : undefined}>
          <textarea
            value={form.purposeOfVisit}
            onChange={(e) => setForm((c) => ({ ...c, purposeOfVisit: e.target.value }))}
            rows={4}
            disabled={coreFieldDisabled("purposeOfVisit")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-400",
              submitted && errors.purposeOfVisit
                ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
            )}
          />
        </Field>

        <Field label="Year of Study" error={submitted ? errors.yearOfStudy : undefined}>
          <SelectDropdown
            value={form.yearOfStudy}
            onChange={(value) =>
              setForm((c) => {
                const nextYear = normalizeYearOfStudy(value) ?? "";
                const nextSemester = isSemesterAllowed(nextYear || undefined, c.currentSemester ?? undefined)
                  ? c.currentSemester
                  : null;
                return withAcademicProgressionCompatibility({
                  ...c,
                  yearOfStudy: nextYear,
                  currentSemester: nextSemester,
                }) as CaseStudyEntry;
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
                }) as CaseStudyEntry,
              )
            }
            options={semesterOptions.map((o) => ({ label: String(o), value: String(o) }))}
            placeholder={normalizedStudentYear ? "Select current semester" : "Select year of study first"}
            error={submitted && !!errors.currentSemester}
          />
        </Field>

        <Field
          label="Amount of Support"
          error={submitted ? errors.amountSupport : undefined}
          hint="Optional. Digits only"
        >
          <CurrencyField
            value={form.amountSupport === null ? "" : String(form.amountSupport)}
            onChange={(value) => setForm((c) => ({ ...c, amountSupport: value === "" ? null : Number(value) }))}
            disabled={coreFieldDisabled("amountSupport")}
            error={submitted && !!errors.amountSupport}
            placeholder="Enter amount"
          />
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
        Coordinator: <span className="font-medium text-foreground">{userDisplayName || "-"}</span>
      </div>

      <div className="mt-5">
        <FacultyRowPicker
          title="Staff Accompanying"
          helperText="Add at least one staff member. Already selected faculty are disabled in other rows."
          addLabel="Add Staff"
          rowLabelPrefix="Staff"
          rows={form.staffAccompanying}
          onRowsChange={(rows) => setForm((c) => ({ ...c, staffAccompanying: rows }))}
          onPersistRow={persistStaffRows}
          facultyOptions={FACULTY_OPTIONS}
          parentLocked={coreFieldDisabled("staffAccompanying")}
          viewOnly={isViewMode}
          sectionError={errors.staffAccompanying}
          showSectionError={submitted}
          emptyStateText="No staff added."
          validateRow={(rows, row) => {
            const tempEntry: CaseStudyEntry = {
              ...form,
              coordinator: coordinatorRow,
              staffAccompanying: rows,
            };
            return validateRowForFacultySave(tempEntry, row).error;
          }}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Number of Participants" hint="Optional. Digits only">
          <input
            inputMode="numeric"
            value={form.participants === null ? "" : String(form.participants)}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setForm((c) => ({ ...c, participants: digits === "" ? null : Number(digits) }));
            }}
            disabled={coreFieldDisabled("participants")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/20 placeholder:text-slate-400"
          />
        </Field>
      </div>

      <div className="mt-5 space-y-4">
        {uploadsVisible ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {SINGLE_UPLOAD_SLOTS.map(({ slot, label }) => (
              <EntryUploader
                key={slot}
                title={label}
                mode={isViewMode ? "view" : "edit"}
                meta={form[slot]}
                uploadEndpoint="/api/me/case-studies/file"
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
                    buildNextEntry: (current) => ({ ...current, [slot]: meta }),
                  });
                }}
                onDeleted={async () => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({ ...current, [slot]: null }),
                  });
                }}
              />
            ))}

            <MultiPhotoUpload
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
                      (item) => item.storedPath !== meta.storedPath,
                    ),
                  }),
                });
              }}
              uploadEndpoint="/api/me/case-studies/file"
              email={email}
              recordId={form.id}
              slotName="geotaggedPhotos"
              disabled={controlsDisabled}
              viewOnly={isViewMode}
              showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
              onStatusChange={setPhotoUploadStatus}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

export function CaseStudiesPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<CaseStudyEntry>
      {...props}
      category="case-studies"
      emptyForm={emptyForm}
      hydrateEntry={hydrateEntry}
      validateFields={validateFields}
      renderFormFields={(ctx) => <CaseStudyFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) =>
        `${entry.academicYear} • ${entry.yearOfStudy || "-"} • Semester ${entry.currentSemester ?? "-"}`
      }
      buildListEntrySubtitle={(entry) =>
        `${entry.placeOfVisit} • ${entry.yearOfStudy || "-"} • Semester ${entry.currentSemester ?? "-"}`
      }
      renderListEntryBody={({ entry }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} days`);
        if (entry.staffAccompanying.length > 0) parts.push(`${entry.staffAccompanying.length} staff`);
        if (entry.amountSupport !== null && entry.amountSupport !== undefined)
          parts.push(`₹${Number(entry.amountSupport).toLocaleString("en-IN")}`);
        return (
          <>
            {parts.length > 0 && (
              <div className="text-xs text-muted-foreground">{parts.join(" • ")}</div>
            )}
            {entry.purposeOfVisit ? (
              <div className="text-xs text-muted-foreground line-clamp-2">{entry.purposeOfVisit}</div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {entry.permissionLetter ? (
                <a className="underline" href={entry.permissionLetter.url} target="_blank" rel="noreferrer">
                  Permission Letter
                </a>
              ) : null}
              {entry.travelPlan ? (
                <a className="underline" href={entry.travelPlan.url} target="_blank" rel="noreferrer">
                  Travel Plan
                </a>
              ) : null}
              {entry.geotaggedPhotos.map((meta, photoIndex) => (
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
      title="Case Studies"
      subtitle="Record case study visits with academic context, staff involvement, dates, and the required supporting documents."
      formTitle="Case Study Entry"
      formSubtitle="Add the entry details and generate the entry to unlock uploads."
      deleteDescription="This permanently deletes this case-study entry and its associated uploaded files."
    />
  );
}

export default CaseStudiesPage;
