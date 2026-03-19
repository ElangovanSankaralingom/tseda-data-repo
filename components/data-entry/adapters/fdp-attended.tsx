"use client";

import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti, { type FileMeta } from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { uuid, cx } from "@/lib/utils/idHelpers";
import type { FdpAttended } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

function emptyForm(): FdpAttended {
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
    organisingBody: "",
    sponsored: "",
    fundingAgency: "",
    fundingAmount: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    completionCertificate: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as FdpAttended;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: FdpAttended): Record<string, string> {
  const errors = validateEntryFields("fdp-attended", form as unknown as Record<string, unknown>);
  if (form.sponsored === "Yes") {
    if (!form.fundingAgency?.trim()) errors.fundingAgency = "Funding agency is required when sponsored.";
    if (form.fundingAmount === null || form.fundingAmount === undefined) errors.fundingAmount = "Funding amount is required when sponsored.";
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function FdpAttendedFormFields({ ctx }: { ctx: FormFieldsContext<FdpAttended> }) {
  const { form, setForm, submitted, errors, coreFieldDisabled, controlsDisabled, isViewMode, uploadsVisible, persistCurrentMutation, submitAttemptedFinal, email } = ctx;

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);

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

        <Field label="Name of the Organising Body" error={submitted ? errors.organisingBody : undefined}>
          <input
            value={form.organisingBody || ""}
            onChange={(e) => setForm((c) => ({ ...c, organisingBody: e.target.value }))}
            disabled={coreFieldDisabled("organisingBody")}
            className={cx(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-500",
              submitted && errors.organisingBody ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
              coreFieldDisabled("organisingBody") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label="Sponsored" error={submitted ? errors.sponsored : undefined}>
          <SelectDropdown
            value={form.sponsored || ""}
            onChange={(value) => setForm((c) => ({ ...c, sponsored: value, ...(value === "No" ? { fundingAgency: "", fundingAmount: null } : {}) }))}
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
            <Field label="Amount of Funding (₹)" error={submitted ? errors.fundingAmount : undefined} hint="Numbers only">
              <CurrencyField
                value={form.fundingAmount === null ? "" : String(form.fundingAmount)}
                onChange={(value) => setForm((c) => ({ ...c, fundingAmount: value === "" ? null : Number(value) }))}
                disabled={coreFieldDisabled("fundingAmount")}
                error={submitted && !!errors.fundingAmount}
                placeholder="15000"
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
            <UploadFieldMulti
              key={`${form.id}-permissionLetter`}
              title="Permission Letter"
              value={form.permissionLetter}
              onUploaded={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => ({
                    ...current,
                    permissionLetter: [...current.permissionLetter, meta],
                  }),
                });
              }}
              onDeleted={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => ({
                    ...current,
                    permissionLetter: current.permissionLetter.filter(
                      (item) => item.storedPath !== meta.storedPath
                    ),
                  }),
                });
              }}
              uploadEndpoint="/api/me/fdp-attended/file"
              email={email}
              recordId={form.id}
              slotName="permissionLetter"
              showRequiredError={submitAttemptedFinal && form.permissionLetter.length === 0}
              requiredErrorText={errors.permissionLetter}
              onStatusChange={() => {}}
              disabled={controlsDisabled}
              viewOnly={isViewMode}
            />
            <UploadFieldMulti
              key={`${form.id}-completionCertificate`}
              title="Completion Certificate"
              value={form.completionCertificate}
              onUploaded={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => ({
                    ...current,
                    completionCertificate: [...current.completionCertificate, meta],
                  }),
                });
              }}
              onDeleted={async (meta) => {
                await persistCurrentMutation({
                  buildNextEntry: (current) => ({
                    ...current,
                    completionCertificate: current.completionCertificate.filter(
                      (item) => item.storedPath !== meta.storedPath
                    ),
                  }),
                });
              }}
              uploadEndpoint="/api/me/fdp-attended/file"
              email={email}
              recordId={form.id}
              slotName="completionCertificate"
              showRequiredError={submitAttemptedFinal && form.completionCertificate.length === 0}
              requiredErrorText={errors.completionCertificate}
              onStatusChange={() => {}}
              disabled={controlsDisabled}
              viewOnly={isViewMode}
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

export function FdpAttendedPage(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<FdpAttended>
      {...props}
      category="fdp-attended"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => entry}
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
        if (entry.semesterType) parts.push(`${entry.semesterType} Semester`);
        if (entry.level) parts.push(entry.level);
        if (entry.mode) parts.push(entry.mode);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} days`);
        if (entry.sponsored === "Yes" && entry.fundingAgency) parts.push(`Funded by ${entry.fundingAgency}`);
        if (entry.sponsored === "Yes" && typeof entry.fundingAmount === "number") parts.push(`₹${entry.fundingAmount.toLocaleString("en-IN")}`);
        return (
          <>
            {parts.length > 0 && <div className="text-xs text-muted-foreground">{parts.join(" • ")}</div>}
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {entry.permissionLetter.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">Permission Letter{entry.permissionLetter.length > 1 ? ` ${i + 1}` : ""}</a>
              ))}
              {entry.completionCertificate.map((meta, i) => (
                <a key={meta.storedPath} className="underline" href={meta.url} target="_blank" rel="noreferrer">Completion Certificate{entry.completionCertificate.length > 1 ? ` ${i + 1}` : ""}</a>
              ))}
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
