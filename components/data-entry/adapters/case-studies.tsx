"use client";

import { useState } from "react";
import { Banknote, BanknoteX } from "lucide-react";
import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { cx, uuid } from "@/lib/utils/idHelpers";
import {
  allowedSemestersForYear,
  isSemesterAllowed,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
} from "@/lib/student-academic";
import { withAcademicProgressionCompatibility } from "@/lib/types/academicProgression";
import { safeString, safeNumber, safeBoolString, ensureFileMetaArray, ensureFacultyArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { CaseStudyEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPONSORED_OPTIONS = [
  { label: "Yes", value: "Yes", icon: Banknote },
  { label: "No", value: "No", icon: BanknoteX },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyForm(): CaseStudyEntry {
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
    placeOfVisit: "",
    purposeOfVisit: "",
    coordinatorName: "",
    coordinatorEmail: "",
    staffAccompanying: [],
    sponsored: "",
    fundingAgency: "",
    fundingAmount: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    travelPlan: [],
    geotaggedPhotos: [],
    report: [],
    feedback: [],
    advanceClosure: [],
    numberOfParticipants: null,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  }) as CaseStudyEntry;
}

function hydrateEntry(entry: CaseStudyEntry): CaseStudyEntry {
  const e = entry as unknown as Record<string, unknown>;
  return withAcademicProgressionCompatibility({
    ...emptyForm(),
    ...e,
    academicYear: safeString(e.academicYear),
    yearOfStudy: safeString(e.yearOfStudy),
    currentSemester: safeNumber(e.currentSemester),
    startDate: safeString(e.startDate),
    endDate: safeString(e.endDate),
    placeOfVisit: safeString(e.placeOfVisit),
    purposeOfVisit: safeString(e.purposeOfVisit),
    coordinatorName: safeString(e.coordinatorName),
    coordinatorEmail: safeString(e.coordinatorEmail),
    staffAccompanying: ensureFacultyArray(e.staffAccompanying),
    sponsored: safeBoolString(e.sponsored),
    fundingAgency: safeString(e.fundingAgency),
    fundingAmount: safeNumber(e.fundingAmount) ?? safeNumber(e.amountSupport),
    permissionLetter: ensureFileMetaArray(e.permissionLetter),
    travelPlan: ensureFileMetaArray(e.travelPlan),
    geotaggedPhotos: ensureFileMetaArray(e.geotaggedPhotos),
    report: ensureFileMetaArray(e.report),
    feedback: ensureFileMetaArray(e.feedback),
    advanceClosure: ensureFileMetaArray(e.advanceClosure),
    numberOfParticipants: safeNumber(e.numberOfParticipants) ?? safeNumber(e.participants),
    streak: ensureStreak(e.streak),
  }) as CaseStudyEntry;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: CaseStudyEntry): Record<string, string> {
  const errors = validateEntryFields("case-studies", form as unknown as Record<string, unknown>);

  // Category-specific: staffAccompanying duplicate detection
  const emailCounts = new Map<string, number>();
  const selectedEmails = [form.coordinatorEmail, ...form.staffAccompanying.map((v) => v.email)]
    .map((v) => (v || "").trim().toLowerCase())
    .filter(Boolean);
  for (const selectedEmail of selectedEmails) {
    emailCounts.set(selectedEmail, (emailCounts.get(selectedEmail) ?? 0) + 1);
  }
  form.staffAccompanying.forEach((value, index) => {
    if (value.email && (emailCounts.get(value.email.toLowerCase()) ?? 0) > 1) {
      errors[`staffAccompanying.${index}`] = "This faculty is already selected in another role.";
    }
  });

  if (form.sponsored === "Yes") {
    if (!form.fundingAgency?.trim()) errors.fundingAgency = "Funding agency is required when sponsored.";
    if (form.fundingAmount === null) errors.fundingAmount = "Funding amount is required when sponsored.";
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

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
    submitAttemptedFinal,
    email,
    userDisplayName,
  } = ctx;

  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const [, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete = form.permissionLetter.length > 0 && form.travelPlan.length > 0 && form.geotaggedPhotos.length > 0;

  async function persistStaffRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({
        ...current,
        coordinatorName: userDisplayName || current.coordinatorName,
        coordinatorEmail: email || current.coordinatorEmail,
        staffAccompanying: nextRows,
      }),
      selectResult: (persisted) => persisted.staffAccompanying,
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

        <Field label="Year of Study" error={submitted ? errors.yearOfStudy : undefined}>
          <SelectDropdown
            value={form.yearOfStudy || ""}
            onChange={(value) =>
              setForm((c) => {
                const nextYear = normalizeYearOfStudy(value) ?? "";
                const nextSemester = isSemesterAllowed(nextYear || undefined, c.currentSemester ?? undefined) ? c.currentSemester : null;
                return withAcademicProgressionCompatibility({ ...c, yearOfStudy: nextYear, currentSemester: nextSemester }) as CaseStudyEntry;
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
            onChange={(value) => setForm((c) => withAcademicProgressionCompatibility({ ...c, currentSemester: value ? Number(value) : null }) as CaseStudyEntry)}
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
          <div className="rounded-lg border border-[var(--color-card-border)] bg-[var(--color-body-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{inclusiveDays ?? "-"}</div>
        </Field>

        <Field label="Place of Visit" error={submitted ? errors.placeOfVisit : undefined}>
          <input
            value={form.placeOfVisit || ""}
            onChange={(e) => setForm((c) => ({ ...c, placeOfVisit: e.target.value }))}
            disabled={coreFieldDisabled("placeOfVisit")}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
              submitted && errors.placeOfVisit ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              coreFieldDisabled("placeOfVisit") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Purpose of Visit" error={submitted ? errors.purposeOfVisit : undefined}>
          <input
            value={form.purposeOfVisit || ""}
            onChange={(e) => setForm((c) => ({ ...c, purposeOfVisit: e.target.value }))}
            disabled={coreFieldDisabled("purposeOfVisit")}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
              submitted && errors.purposeOfVisit ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              coreFieldDisabled("purposeOfVisit") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-body-bg)] px-4 py-3 text-sm text-muted-foreground">
        Coordinator: <span className="font-medium text-foreground">{userDisplayName || "-"}</span>
      </div>

      <div className="mt-5">
        <FacultyRowPicker
          title="Staff Accompanying"
          helperText="Add staff members accompanying the visit."
          addLabel="Add Staff"
          rowLabelPrefix="Staff"
          rows={form.staffAccompanying}
          onRowsChange={(rows) => setForm((c) => ({ ...c, staffAccompanying: rows }))}
          onPersistRow={async (rows) => persistStaffRows(rows)}
          facultyEndpoint="/api/faculty"
          parentLocked={coreFieldDisabled("staffAccompanying")}
          viewOnly={isViewMode}
          disableEmails={[form.coordinatorEmail || email]}
          sectionError={errors.staffAccompanying}
          showSectionError={submitted}
          emptyStateText="No staff added."
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
                  "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
                  submitted && errors.fundingAgency ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
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
        <p className="text-sm text-muted-foreground">Streaks apply only for upcoming visit dates.</p>

        {uploadsVisible ? (
          <>
            <StageTwoDivider />
            <div className="animate-highlight-new grid gap-4 sm:grid-cols-2">
              <UploadFieldMulti
                key={`${form.id}-permissionLetter`}
                title="Permission Letter"
                value={form.permissionLetter}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, permissionLetter: [...c.permissionLetter, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, permissionLetter: c.permissionLetter.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/case-studies/file"
                email={email} recordId={form.id} slotName="permissionLetter"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.permissionLetter}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-travelPlan`}
                title="Travel Plan"
                value={form.travelPlan}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, travelPlan: [...c.travelPlan, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, travelPlan: c.travelPlan.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/case-studies/file"
                email={email} recordId={form.id} slotName="travelPlan"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.travelPlan}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-geotaggedPhotos`}
                title="Geotagged Photos"
                value={form.geotaggedPhotos}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, geotaggedPhotos: [...c.geotaggedPhotos, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, geotaggedPhotos: c.geotaggedPhotos.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/case-studies/file"
                email={email} recordId={form.id} slotName="geotaggedPhotos"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.geotaggedPhotos}
                onStatusChange={setPhotoUploadStatus} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-report`}
                title="Report"
                value={form.report}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, report: [...c.report, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, report: c.report.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/case-studies/file"
                email={email} recordId={form.id} slotName="report"
                showRequiredError={false}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-feedback`}
                title="Feedback from Students and Industry"
                value={form.feedback}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, feedback: [...c.feedback, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, feedback: c.feedback.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/case-studies/file"
                email={email} recordId={form.id} slotName="feedback"
                showRequiredError={false}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-advanceClosure`}
                title="Advance Closure"
                value={form.advanceClosure}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, advanceClosure: [...c.advanceClosure, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, advanceClosure: c.advanceClosure.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/case-studies/file"
                email={email} recordId={form.id} slotName="advanceClosure"
                showRequiredError={false}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <Field label="Number of Participants">
                <input
                  type="number"
                  min="0"
                  value={form.numberOfParticipants === null ? "" : String(form.numberOfParticipants)}
                  onChange={(e) => setForm((c) => ({ ...c, numberOfParticipants: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  className={cx(
                    "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
                    "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
                    controlsDisabled && "cursor-not-allowed opacity-60",
                  )}
                  placeholder="e.g. 45"
                />
              </Field>
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

export function CaseStudiesPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<CaseStudyEntry>
      {...props}
      category="case-studies"
      emptyForm={emptyForm}
      hydrateEntry={hydrateEntry}
      validateFields={validateFields}
      renderFormFields={(ctx) => <CaseStudyFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.placeOfVisit || "").trim() || "Untitled visit"}
      buildListEntrySubtitle={(entry) => entry.purposeOfVisit || ""}
      renderListEntryBody={({ entry }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.yearOfStudy) parts.push(entry.yearOfStudy);
        if (entry.currentSemester) parts.push(`Semester ${entry.currentSemester}`);
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
              {entry.permissionLetter.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Permission Letter{entry.permissionLetter.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
              {entry.travelPlan.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Travel Plan{entry.travelPlan.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
              {entry.geotaggedPhotos.map((meta, photoIndex) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Geotagged Photo {photoIndex + 1}
                </a>
              ))}
              {entry.report.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Report{entry.report.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
              {entry.feedback.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Feedback{entry.feedback.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
              {entry.advanceClosure.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Advance Closure{entry.advanceClosure.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
            </div>
          </>
        );
      }}
      title="Case Studies"
      subtitle="Record industry visits and field studies, along with staff details and supporting documents."
      formTitle="Case Study Entry"
      formSubtitle="Add the entry details and generate the entry to unlock uploads."
      deleteDescription="This permanently deletes this case-study entry and its associated uploaded files."
    />
  );
}

export default CaseStudiesPage;
