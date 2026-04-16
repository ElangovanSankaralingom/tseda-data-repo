"use client";

import { useState } from "react";
import { Flag, Globe, Monitor, Building2, CloudSun, Sun, Banknote, BanknoteX } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { t as staticT } from "@/lib/i18n";
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
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { cx, uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { formatCurrency } from "@/lib/i18n/locale";
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
    if (!form.fundingAgency?.trim()) errors.fundingAgency = staticT('entry.fundingAgencyRequired', 'en');
    if (form.fundingAmount === null) errors.fundingAmount = staticT('entry.fundingAmountRequired', 'en');
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
      errors[`coCoordinators.${index}`] = staticT('entry.facultyAlreadySelected', 'en');
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

  const { t, fieldLabel } = useTranslation();
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
        <Field label={fieldLabel('academicYear')} error={submitted ? errors.academicYear : undefined}>
          <SelectDropdown
            value={form.academicYear || ""}
            onChange={(value) => setForm((c) => ({ ...c, academicYear: value }))}
            options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
            placeholder={t('placeholder.selectAcademicYear')}
            disabled={coreFieldDisabled("academicYear")}
            error={submitted && !!errors.academicYear}
          />
        </Field>

        <Field label={fieldLabel('semesterType')} error={submitted ? errors.semesterType : undefined}>
          <SelectDropdown
            value={form.semesterType || ""}
            onChange={(value) => setForm((c) => ({ ...c, semesterType: value }))}
            options={SEMESTER_TYPE_OPTIONS}
            placeholder={t('placeholder.selectSemesterType')}
            disabled={coreFieldDisabled("semesterType")}
            error={submitted && !!errors.semesterType}
          />
        </Field>

        <Field label={fieldLabel('level')} error={submitted ? errors.level : undefined}>
          <SelectDropdown
            value={form.level || ""}
            onChange={(value) => setForm((c) => ({ ...c, level: value }))}
            options={LEVEL_OPTIONS}
            placeholder={t('placeholder.selectLevel')}
            disabled={coreFieldDisabled("level")}
            error={submitted && !!errors.level}
          />
        </Field>

        <Field label={fieldLabel('mode')} error={submitted ? errors.mode : undefined}>
          <SelectDropdown
            value={form.mode || ""}
            onChange={(value) => setForm((c) => ({ ...c, mode: value }))}
            options={MODE_OPTIONS}
            placeholder={t('placeholder.selectMode')}
            disabled={coreFieldDisabled("mode")}
            error={submitted && !!errors.mode}
          />
        </Field>

        <Field label={fieldLabel('startDate')} error={submitted ? errors.startDate : undefined}>
          <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
        </Field>

        <Field label={fieldLabel('endDate')} error={submitted ? errors.endDate : undefined} hint={inclusiveDays ? `Days: ${inclusiveDays}` : undefined}>
          <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
        </Field>

        <Field label={t('entry.numberOfDays')} hint={t('entry.inclusiveDayCount')}>
          <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{inclusiveDays ?? "-"}</div>
        </Field>

        <Field label={fieldLabel('workshopName')} error={submitted ? errors.workshopName : undefined}>
          <input
            value={form.workshopName || ""}
            onChange={(e) => setForm((c) => ({ ...c, workshopName: e.target.value }))}
            disabled={coreFieldDisabled("workshopName")}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
              submitted && errors.workshopName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              coreFieldDisabled("workshopName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label={fieldLabel('resourcePersonName')} error={submitted ? errors.resourcePersonName : undefined}>
          <input
            value={form.resourcePersonName || ""}
            onChange={(e) => setForm((c) => ({ ...c, resourcePersonName: e.target.value }))}
            disabled={coreFieldDisabled("resourcePersonName")}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
              submitted && errors.resourcePersonName ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              coreFieldDisabled("resourcePersonName") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label={fieldLabel('resourcePersonDesignation')} error={submitted ? errors.resourcePersonDesignation : undefined}>
          <input
            value={form.resourcePersonDesignation || ""}
            onChange={(e) => setForm((c) => ({ ...c, resourcePersonDesignation: e.target.value }))}
            disabled={coreFieldDisabled("resourcePersonDesignation")}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
              submitted && errors.resourcePersonDesignation ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              coreFieldDisabled("resourcePersonDesignation") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>

        <Field label={fieldLabel('resourcePersonOrganisation')} error={submitted ? errors.resourcePersonOrganisation : undefined}>
          <input
            value={form.resourcePersonOrganisation || ""}
            onChange={(e) => setForm((c) => ({ ...c, resourcePersonOrganisation: e.target.value }))}
            disabled={coreFieldDisabled("resourcePersonOrganisation")}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
              submitted && errors.resourcePersonOrganisation ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              coreFieldDisabled("resourcePersonOrganisation") && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
        {t('entry.coordinator')} <span className="font-medium text-[var(--color-text-primary)]">{userDisplayName || "-"}</span>
      </div>

      <div className="mt-5">
        <FacultyPickerRows
          title={t('entry.coCoordinatorTitle')}
          helperText={t('entry.coCoordinatorHint')}
          addLabel={t('entry.addCoCoordinator')}
          rowLabelPrefix={t('entry.coCoordinatorLabel')}
          rows={form.coCoordinators}
          onRowsChange={(rows) => setForm((c) => ({ ...c, coCoordinators: rows }))}
          onPersistRow={async (rows) => persistCoCoordinatorRows(rows)}
          facultyEndpoint="/api/faculty"
          parentLocked={coreFieldDisabled("coCoordinators")}
          viewOnly={isViewMode}
          disableEmails={[form.coordinatorEmail || email]}
          sectionError={errors.coCoordinators}
          showSectionError={submitted}
          emptyStateText={t('entry.noCoCoordinators')}
          validateRow={(rows, row, index) => {
            if (!row.email) return t('entry.selectFaculty');
            const coordEmail = form.coordinatorEmail || email;
            if (row.email.trim().toLowerCase() === coordEmail.trim().toLowerCase()) {
              return t('entry.facultyAlreadySelected');
            }
            const duplicates = rows.filter(
              (item, itemIndex) =>
                itemIndex !== index && item.email.trim().toLowerCase() === row.email.trim().toLowerCase()
            ).length;
            return duplicates > 0 ? t('entry.facultyAlreadySelected') : null;
          }}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={fieldLabel('sponsored')} error={submitted ? errors.sponsored : undefined}>
          <SelectDropdown
            value={form.sponsored || ""}
            onChange={(value) => setForm((c) => ({ ...c, sponsored: value, ...(value !== "Yes" ? { fundingAgency: "", fundingAmount: null } : {}) }))}
            options={SPONSORED_OPTIONS}
            placeholder={t('placeholder.select')}
            disabled={coreFieldDisabled("sponsored")}
            error={submitted && !!errors.sponsored}
          />
        </Field>

        {form.sponsored === "Yes" && (
          <>
            <Field label={fieldLabel('fundingAgency')} error={submitted ? errors.fundingAgency : undefined}>
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

            <Field label={fieldLabel('fundingAmount')} error={submitted ? errors.fundingAmount : undefined} hint={t('entry.numbersOnly')}>
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
        <p className="text-sm text-[var(--color-text-muted)]">{t('entry.streakEligibility')}</p>

        {uploadsVisible ? (
          <>
            <StageTwoDivider />
            <div className="animate-highlight-new grid gap-4 sm:grid-cols-2">
              <UploadFieldMulti
                key={`${form.id}-permissionLetter`}
                title={fieldLabel('permissionLetter')}
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
                title={fieldLabel('geotaggedPhotos')}
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
                title={fieldLabel('attendanceSheet')}
                value={form.attendanceSheet}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, attendanceSheet: [...c.attendanceSheet, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, attendanceSheet: c.attendanceSheet.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/workshops/file"
                email={email} recordId={form.id} slotName="attendanceSheet"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.attendanceSheet}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <Field label={fieldLabel('numberOfParticipants')}>
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

              <UploadFieldMulti
                key={`${form.id}-officialPoster`}
                title={fieldLabel('officialPoster')}
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
  const { t } = useTranslation();
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
      buildListEntryTitle={(entry) => (entry.workshopName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.resourcePersonName
          ? `${t('entry.resourcePerson')} ${entry.resourcePersonName}${entry.resourcePersonOrganisation ? ` — ${entry.resourcePersonOrganisation}` : ""}`
          : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.level) parts.push(entry.level);
        if (entry.mode) parts.push(entry.mode);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} ${t('timer.days')}`);
        if (entry.sponsored === "Yes" && entry.fundingAgency) {
          const fundingStr = entry.fundingAmount ? `${entry.fundingAgency} (${formatCurrency(entry.fundingAmount, "en")})` : entry.fundingAgency;
          parts.push(`${t('entry.fundedBy')} ${fundingStr}`);
        }
        if (typeof entry.numberOfParticipants === "number") parts.push(`${entry.numberOfParticipants} ${t('entry.participants')}`);
        if (entry.coCoordinators.length > 0) {
          parts.push(`${t('fields.coCoordinators')}: ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`);
        }
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Geotagged Photo", files: entry.geotaggedPhotos },
              { label: "Attendance Sheet", files: entry.attendanceSheet },
              { label: "Official Poster", files: entry.officialPoster },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.workshopsPageTitle')}
      subtitle={t('entry.workshopsPageSubtitle')}
      formTitle={t('entry.workshopsFormTitle')}
      formSubtitle={t('entry.workshopsFormSubtitle')}
      deleteDescription={t('entry.workshopsDeleteDesc')}
    />
  );
}

export default WorkshopsPage;
