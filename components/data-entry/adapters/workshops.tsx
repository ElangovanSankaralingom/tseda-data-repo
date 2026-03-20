"use client";

import { useState } from "react";
import { Flag, Globe, Monitor, Building2, CloudSun, Sun, Banknote, BanknoteX } from "lucide-react";
import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import FacultyPickerRows, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { cx, uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { safeString, safeNumber, safeBoolString, ensureFileMetaArray, ensureFacultyArray, ensureFaculty, ensureStreak, extractNestedUpload } from "@/lib/entries/hydrateEntry";
import type { WorkshopEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const LEVEL_OPTIONS = [
  { label: "National", value: "National", icon: Flag },
  { label: "International", value: "International", icon: Globe },
];

const MODE_OPTIONS = [
  { label: "Online", value: "Online", icon: Monitor },
  { label: "Offline", value: "Offline", icon: Building2 },
];

const SPONSORED_OPTIONS = [
  { label: "Yes", value: "Yes", icon: Banknote },
  { label: "No", value: "No", icon: BanknoteX },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyForm(): WorkshopEntry {
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
    workshopName: "",
    resourcePersonName: "",
    resourcePersonDesignation: "",
    resourcePersonOrganisation: "",
    coordinatorName: "",
    coordinatorEmail: "",
    coCoordinators: [],
    sponsored: "",
    fundingAgency: "",
    fundingAmount: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    geotaggedPhotos: [],
    attendanceSheet: [],
    officialPoster: [],
    numberOfParticipants: null,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as WorkshopEntry;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: WorkshopEntry): Record<string, string> {
  const errors = validateEntryFields("workshops", form as unknown as Record<string, unknown>);

  if (form.sponsored === "Yes") {
    if (!form.fundingAgency?.trim()) errors.fundingAgency = "Funding agency is required when sponsored.";
    if (form.fundingAmount === null) errors.fundingAmount = "Funding amount is required when sponsored.";
  }

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

function WorkshopFormFields({ ctx }: { ctx: FormFieldsContext<WorkshopEntry> }) {
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

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const [, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete = form.permissionLetter.length > 0 && form.geotaggedPhotos.length > 0 && form.attendanceSheet.length > 0;

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

        <Field label="Mode" error={submitted ? errors.mode : undefined}>
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

        <Field label="Name of the Workshop" error={submitted ? errors.workshopName : undefined}>
          <input
            value={form.workshopName || ""}
            onChange={(e) => setForm((c) => ({ ...c, workshopName: e.target.value }))}
            disabled={coreFieldDisabled("workshopName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.workshopName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("workshopName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Resource Person Name" error={submitted ? errors.resourcePersonName : undefined}>
          <input
            value={form.resourcePersonName || ""}
            onChange={(e) => setForm((c) => ({ ...c, resourcePersonName: e.target.value }))}
            disabled={coreFieldDisabled("resourcePersonName")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.resourcePersonName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("resourcePersonName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Resource Person Designation" error={submitted ? errors.resourcePersonDesignation : undefined}>
          <input
            value={form.resourcePersonDesignation || ""}
            onChange={(e) => setForm((c) => ({ ...c, resourcePersonDesignation: e.target.value }))}
            disabled={coreFieldDisabled("resourcePersonDesignation")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.resourcePersonDesignation ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("resourcePersonDesignation") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Resource Person Organisation" error={submitted ? errors.resourcePersonOrganisation : undefined}>
          <input
            value={form.resourcePersonOrganisation || ""}
            onChange={(e) => setForm((c) => ({ ...c, resourcePersonOrganisation: e.target.value }))}
            disabled={coreFieldDisabled("resourcePersonOrganisation")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.resourcePersonOrganisation ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("resourcePersonOrganisation") && "cursor-not-allowed opacity-60",
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
          facultyEndpoint="/api/faculty"
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

            <Field label="Amount of Funding (\u20B9) \u2014 optional" error={submitted ? errors.fundingAmount : undefined} hint="Numbers only">
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
        <p className="text-sm text-muted-foreground">Streaks apply only for upcoming workshop dates.</p>

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
                uploadEndpoint="/api/me/workshops/file"
                email={email} recordId={form.id} slotName="permissionLetter"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.permissionLetter}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-geotaggedPhotos`}
                title="Geotagged Photos"
                value={form.geotaggedPhotos}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, geotaggedPhotos: [...c.geotaggedPhotos, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, geotaggedPhotos: c.geotaggedPhotos.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/workshops/file"
                email={email} recordId={form.id} slotName="geotaggedPhotos"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.geotaggedPhotos}
                onStatusChange={setPhotoUploadStatus} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-attendanceSheet`}
                title="Attendance Sheet"
                value={form.attendanceSheet}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, attendanceSheet: [...c.attendanceSheet, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, attendanceSheet: c.attendanceSheet.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/workshops/file"
                email={email} recordId={form.id} slotName="attendanceSheet"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.attendanceSheet}
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
                    "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
                    "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
                    controlsDisabled && "cursor-not-allowed opacity-60",
                  )}
                  placeholder="e.g. 45"
                />
              </Field>

              <UploadFieldMulti
                key={`${form.id}-officialPoster`}
                title="Official Poster"
                value={form.officialPoster}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, officialPoster: [...c.officialPoster, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, officialPoster: c.officialPoster.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/workshops/file"
                email={email} recordId={form.id} slotName="officialPoster"
                showRequiredError={false}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
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

export function WorkshopsPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<WorkshopEntry>
      {...props}
      category="workshops"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          level: safeString(e.level),
          mode: safeString(e.mode),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          workshopName: safeString(e.workshopName) || safeString(e.eventName),
          resourcePersonName: safeString(e.resourcePersonName) || safeString(e.speakerName),
          resourcePersonDesignation: safeString(e.resourcePersonDesignation),
          resourcePersonOrganisation: safeString(e.resourcePersonOrganisation) || safeString(e.organisationName),
          coordinatorName: safeString(e.coordinatorName) || (e.coordinator ? ensureFaculty(e.coordinator).name : ""),
          coordinatorEmail: safeString(e.coordinatorEmail) || (e.coordinator ? ensureFaculty(e.coordinator).email : ""),
          coCoordinators: ensureFacultyArray(e.coCoordinators),
          sponsored: safeBoolString(e.sponsored),
          fundingAgency: safeString(e.fundingAgency),
          fundingAmount: safeNumber(e.fundingAmount),
          numberOfParticipants: safeNumber(e.numberOfParticipants) ?? safeNumber(e.participants),
          permissionLetter: ensureFileMetaArray(e.permissionLetter).length > 0 ? ensureFileMetaArray(e.permissionLetter) : extractNestedUpload(e, "permissionLetter"),
          geotaggedPhotos: ensureFileMetaArray(e.geotaggedPhotos).length > 0 ? ensureFileMetaArray(e.geotaggedPhotos) : extractNestedUpload(e, "geotaggedPhotos"),
          attendanceSheet: ensureFileMetaArray(e.attendanceSheet).length > 0 ? ensureFileMetaArray(e.attendanceSheet) : extractNestedUpload(e, "attendance"),
          officialPoster: ensureFileMetaArray(e.officialPoster),
          streak: ensureStreak(e.streak),
        } as WorkshopEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <WorkshopFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.workshopName || "").trim() || "Untitled workshop"}
      buildListEntrySubtitle={(entry) =>
        entry.resourcePersonName
          ? `Resource Person: ${entry.resourcePersonName}${entry.resourcePersonOrganisation ? ` \u2014 ${entry.resourcePersonOrganisation}` : ""}`
          : ""
      }
      renderListEntryBody={({ entry }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} Semester`);
        if (entry.level) parts.push(entry.level);
        if (entry.mode) parts.push(entry.mode);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} \u2013 ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} days`);
        if (entry.sponsored === "Yes" && entry.fundingAgency) {
          const fundingStr = entry.fundingAmount ? `${entry.fundingAgency} (\u20B9${entry.fundingAmount.toLocaleString("en-IN")})` : entry.fundingAgency;
          parts.push(`Funded by ${fundingStr}`);
        }
        if (typeof entry.numberOfParticipants === "number") parts.push(`${entry.numberOfParticipants} participants`);
        if (entry.coCoordinators.length > 0) {
          parts.push(`Co-coordinators: ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`);
        }
        return (
          <>
            {parts.length > 0 && <div className="text-xs text-muted-foreground">{parts.join(" \u2022 ")}</div>}
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {entry.permissionLetter.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Permission Letter{entry.permissionLetter.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
              {entry.geotaggedPhotos.map((meta, photoIndex) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Geotagged Photo {photoIndex + 1}
                </a>
              ))}
              {entry.attendanceSheet.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Attendance Sheet{entry.attendanceSheet.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
              {entry.officialPoster.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  Official Poster{entry.officialPoster.length > 1 ? ` ${i + 1}` : ""}
                </a>
              ))}
            </div>
          </>
        );
      }}
      title="Workshops"
      subtitle="Record workshops conducted, along with resource person details and supporting documents."
      formTitle="Workshop Entry"
      formSubtitle="Add the entry details and generate the entry to unlock uploads."
      deleteDescription="This permanently deletes this workshop entry and its associated uploaded files."
    />
  );
}

export default WorkshopsPage;
