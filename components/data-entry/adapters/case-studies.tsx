"use client";

import { useState } from "react";
import { Banknote, BanknoteX, Calendar, MapPin, Clock, Users, Unlock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { t as staticT } from "@/lib/i18n";
import TextInput from "@/components/controls/TextInput";
import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import FacultyRowPicker, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid } from "@/lib/utils/idHelpers";
import { formatCurrency } from "@/lib/i18n/locale";
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
      errors[`staffAccompanying.${index}`] = staticT('entry.facultyAlreadySelected', 'en');
    }
  });

  if (form.sponsored === "Yes") {
    if (!form.fundingAgency?.trim()) errors.fundingAgency = staticT('entry.fundingAgencyRequired', 'en');
    if (form.fundingAmount === null) errors.fundingAmount = staticT('entry.fundingAmountRequired', 'en');
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

  const { t, fieldLabel } = useTranslation();
  const normalizedStudentYear = normalizeYearOfStudy(form.yearOfStudy);
  const semesterOptions = allowedSemestersForYear(normalizedStudentYear);
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const [, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete = form.permissionLetter.length > 0 && form.travelPlan.length > 0 && form.geotaggedPhotos.length > 0;

  // Count filled fields per group for completion badges
  const group1Filled = [
    form.academicYear,
    form.yearOfStudy,
    form.currentSemester !== null,
  ].filter(Boolean).length;
  const group1Total = 3;

  const group2Filled = [
    form.placeOfVisit,
    form.purposeOfVisit,
  ].filter(Boolean).length;
  const group2Total = 2;

  const group3Filled = [
    form.startDate,
    form.endDate,
    inclusiveDays !== null,
  ].filter(Boolean).length;
  const group3Total = 3;

  const group4Filled = [
    form.coordinatorEmail,
    form.staffAccompanying.length > 0,
  ].filter(Boolean).length;
  const group4Total = 2;

  const group5Filled = [
    form.sponsored,
    form.sponsored === "Yes" ? form.fundingAgency : true,
    form.sponsored === "Yes" ? form.fundingAmount !== null : true,
  ].filter(Boolean).length;
  const group5Total = form.sponsored === "Yes" ? 3 : 1;

  const group6Filled = [
    form.permissionLetter.length > 0,
    form.travelPlan.length > 0,
    form.geotaggedPhotos.length > 0,
    form.report.length > 0,
    form.feedback.length > 0,
    form.advanceClosure.length > 0,
    form.numberOfParticipants !== null,
  ].filter(Boolean).length;
  const group6Total = 7;

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
    <div className="space-y-4">
      {/* Group 1: Academic Period */}
      <FormFieldGroup
        step={1}
        title={t('entry.groupAcademicPeriod')}
        icon={Calendar}
        accent="#60a5fa"
        filled={group1Filled}
        total={group1Total}
        disabled={coreFieldDisabled("academicYear")}
        animationDelay={0}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('academicYear')} error={submitted ? errors.academicYear : undefined} fieldKey="academicYear">
            <SelectDropdown
              value={form.academicYear || ""}
              onChange={(value) => setForm((c) => ({ ...c, academicYear: value }))}
              options={ACADEMIC_YEAR_DROPDOWN_OPTIONS}
              placeholder={t('placeholder.selectAcademicYear')}
              disabled={coreFieldDisabled("academicYear")}
              error={submitted && !!errors.academicYear}
            />
          </Field>

          <Field label={fieldLabel('yearOfStudy')} error={submitted ? errors.yearOfStudy : undefined} fieldKey="yearOfStudy">
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
              placeholder={t('placeholder.selectYearOfStudy')}
              disabled={coreFieldDisabled("yearOfStudy")}
              error={submitted && !!errors.yearOfStudy}
            />
          </Field>

          <Field label={fieldLabel('currentSemester')} error={submitted ? errors.currentSemester : undefined} hint={normalizedStudentYear ? t('placeholder.semesterBasedOnYear') : t('placeholder.selectYearFirst')} fieldKey="currentSemester">
            <SelectDropdown
              value={form.currentSemester === null ? "" : String(form.currentSemester)}
              onChange={(value) => setForm((c) => withAcademicProgressionCompatibility({ ...c, currentSemester: value ? Number(value) : null }) as CaseStudyEntry)}
              options={semesterOptions.map((o) => ({ label: String(o), value: String(o) }))}
              placeholder={normalizedStudentYear ? t('placeholder.selectCurrentSemester') : t('placeholder.selectYearFirst')}
              disabled={coreFieldDisabled("currentSemester") || !normalizedStudentYear}
              error={submitted && !!errors.currentSemester}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 2: Visit Details */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupVisitDetails')}
        icon={MapPin}
        accent="var(--color-primary)"
        filled={group2Filled}
        total={group2Total}
        disabled={coreFieldDisabled("placeOfVisit")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('placeOfVisit')} error={submitted ? errors.placeOfVisit : undefined} fieldKey="placeOfVisit">
            <TextInput
              value={form.placeOfVisit || ""}
              onChange={(e) => setForm((c) => ({ ...c, placeOfVisit: e.target.value }))}
              disabled={coreFieldDisabled("placeOfVisit")}
              error={submitted && !!errors.placeOfVisit}
              placeholder={t('placeholder.placeOfVisit')}
            />
          </Field>

          <Field label={fieldLabel('purposeOfVisit')} error={submitted ? errors.purposeOfVisit : undefined} fieldKey="purposeOfVisit">
            <TextInput
              value={form.purposeOfVisit || ""}
              onChange={(e) => setForm((c) => ({ ...c, purposeOfVisit: e.target.value }))}
              disabled={coreFieldDisabled("purposeOfVisit")}
              error={submitted && !!errors.purposeOfVisit}
              placeholder={t('placeholder.visitPurpose')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 3: Schedule */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupSchedule')}
        subtitle={t('entry.groupScheduleHint')}
        icon={Clock}
        accent="#f59e0b"
        filled={group3Filled}
        total={group3Total}
        disabled={coreFieldDisabled("startDate")}
        animationDelay={120}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={fieldLabel('startDate')} error={submitted ? errors.startDate : undefined} fieldKey="startDate">
              <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
            </Field>

            <Field label={fieldLabel('endDate')} error={submitted ? errors.endDate : undefined} hint={inclusiveDays ? `Days: ${inclusiveDays}` : undefined} fieldKey="endDate">
              <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
            </Field>

            <Field label={t('entry.numberOfDays')} hint={t('entry.inclusiveDayCount')}>
              <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{inclusiveDays ?? "-"}</div>
            </Field>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">{t('entry.streakEligibility')}</p>
        </div>
      </FormFieldGroup>

      {/* Group 4: Participants & Staff */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupParticipants')}
        icon={Users}
        accent="#06b6d4"
        filled={group4Filled}
        total={group4Total}
        disabled={coreFieldDisabled("staffAccompanying")}
        animationDelay={180}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            {t('entry.coordinator')} <span className="font-medium text-[var(--color-text-primary)]">{userDisplayName || "-"}</span>
          </div>

          <FacultyRowPicker
            title={t('entry.staffAccompanyingTitle')}
            helperText={t('entry.staffAccompanyingHint')}
            addLabel={t('entry.addStaff')}
            rowLabelPrefix={t('entry.staffLabel')}
            rows={form.staffAccompanying}
            onRowsChange={(rows) => setForm((c) => ({ ...c, staffAccompanying: rows }))}
            onPersistRow={async (rows) => persistStaffRows(rows)}
            facultyEndpoint="/api/faculty"
            parentLocked={coreFieldDisabled("staffAccompanying")}
            viewOnly={isViewMode}
            disableEmails={[form.coordinatorEmail || email]}
            sectionError={errors.staffAccompanying}
            showSectionError={submitted}
            emptyStateText={t('entry.noStaffAdded')}
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
      </FormFieldGroup>

      {/* Group 5: Funding */}
      <FormFieldGroup
        step={5}
        title={t('entry.groupFunding')}
        icon={Banknote}
        accent="#a78bfa"
        filled={group5Filled}
        total={group5Total}
        disabled={coreFieldDisabled("sponsored")}
        animationDelay={240}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('sponsored')} error={submitted ? errors.sponsored : undefined} fieldKey="sponsored">
            <PillSelect
              value={form.sponsored || ""}
              onChange={(value) => setForm((c) => ({ ...c, sponsored: value, ...(value !== "Yes" ? { fundingAgency: "", fundingAmount: null } : {}) }))}
              options={SPONSORED_OPTIONS}
              accent="#a78bfa"
              disabled={coreFieldDisabled("sponsored")}
              error={submitted && !!errors.sponsored}
            />
          </Field>

          {form.sponsored === "Yes" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={fieldLabel('fundingAgency')} error={submitted ? errors.fundingAgency : undefined} fieldKey="fundingAgency">
                <TextInput
                  value={form.fundingAgency || ""}
                  onChange={(e) => setForm((c) => ({ ...c, fundingAgency: e.target.value }))}
                  disabled={coreFieldDisabled("fundingAgency")}
                  error={submitted && !!errors.fundingAgency}
                  placeholder={t('placeholder.fundingAgency')}
                />
              </Field>

              <Field label={fieldLabel('fundingAmount')} error={submitted ? errors.fundingAmount : undefined} hint={t('entry.numbersOnly')} fieldKey="fundingAmount">
                <CurrencyField
                  value={form.fundingAmount === null ? "" : String(form.fundingAmount)}
                  onChange={(value) => setForm((c) => ({ ...c, fundingAmount: value === "" ? null : Number(value) }))}
                  disabled={coreFieldDisabled("fundingAmount")}
                  error={submitted && !!errors.fundingAmount}
                  placeholder="50000"
                />
              </Field>
            </div>
          )}
        </div>
      </FormFieldGroup>

      {/* Group 6: Stage 2 Documents */}
      {uploadsVisible ? (
        <FormFieldGroup
          step={6}
          title={t('entry.groupDocuments')}
          icon={Unlock}
          accent="#10b981"
          filled={group6Filled}
          total={group6Total}
          disabled={controlsDisabled}
          animationDelay={300}
        >
          <div className="space-y-4">
            <StageTwoDivider />

            <div className="grid gap-4 sm:grid-cols-2">
              <UploadFieldMulti
                key={`${form.id}-permissionLetter`}
                title={fieldLabel('permissionLetter')}
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
                title={fieldLabel('travelPlan')}
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
                title={fieldLabel('geotaggedPhotos')}
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
                title={fieldLabel('report')}
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
                title={fieldLabel('feedback')}
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
                title={fieldLabel('advanceClosure')}
                value={form.advanceClosure}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, advanceClosure: [...c.advanceClosure, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, advanceClosure: c.advanceClosure.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/case-studies/file"
                email={email} recordId={form.id} slotName="advanceClosure"
                showRequiredError={false}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <Field label={fieldLabel('numberOfParticipants')} fieldKey="numberOfParticipants">
                <TextInput
                  type="number"
                  min="0"
                  value={form.numberOfParticipants === null ? "" : String(form.numberOfParticipants)}
                  onChange={(e) => setForm((c) => ({ ...c, numberOfParticipants: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  placeholder={t('placeholder.numberOfParticipants')}
                />
              </Field>
            </div>
          </div>
        </FormFieldGroup>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function CaseStudiesPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<CaseStudyEntry>
      {...props}
      category="case-studies"
      emptyForm={emptyForm}
      hydrateEntry={hydrateEntry}
      validateFields={validateFields}
      renderFormFields={(ctx) => <CaseStudyFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.placeOfVisit || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => entry.purposeOfVisit || ""}
      renderListEntryBody={({ entry, group }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.yearOfStudy) parts.push(entry.yearOfStudy);
        if (entry.currentSemester) parts.push(`${t('entry.semester')} ${entry.currentSemester}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} ${t('timer.days')}`);
        if (entry.sponsored === "Yes" && entry.fundingAgency) {
          const fundingStr = entry.fundingAmount ? `${entry.fundingAgency} (${formatCurrency(entry.fundingAmount, "en")})` : entry.fundingAgency;
          parts.push(`${t('entry.fundedBy')} ${fundingStr}`);
        }
        if (typeof entry.numberOfParticipants === "number") parts.push(`${entry.numberOfParticipants} ${t('entry.participants')}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Travel Plan", files: entry.travelPlan },
              { label: "Geotagged Photo", files: entry.geotaggedPhotos },
              { label: "Report", files: entry.report },
              { label: "Feedback", files: entry.feedback },
              { label: "Advance Closure", files: entry.advanceClosure },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.caseStudiesPageTitle')}
      subtitle={t('entry.caseStudiesPageSubtitle')}
      formTitle={t('entry.caseStudiesFormTitle')}
      formSubtitle={t('entry.caseStudiesFormSubtitle')}
      deleteDescription={t('entry.caseStudiesDeleteDesc')}
    />
  );
}

export default CaseStudiesPage;
