"use client";

import { Flag, Globe, Monitor, Building2, CloudSun, Sun, Banknote, BanknoteX, Calendar, BookOpen, Clock, Unlock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { t as staticT } from "@/lib/i18n";
import TextInput from "@/components/controls/TextInput";
import CurrencyField from "@/components/controls/CurrencyField";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid } from "@/lib/utils/idHelpers";
import { formatCurrency } from "@/lib/i18n/locale";
import type { FdpAttended } from "@/components/data-entry/adapters/adapterTypes";
import { safeString, safeNumber, safeBoolString, ensureFileMetaArray, ensureStreak } from "@/lib/entries/hydrateEntry";
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
    if (!form.fundingAgency?.trim()) errors.fundingAgency = staticT('entry.fundingAgencyRequired', 'en');
    if (form.fundingAmount === null || form.fundingAmount === undefined) errors.fundingAmount = staticT('entry.fundingAmountRequired', 'en');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function FdpAttendedFormFields({ ctx }: { ctx: FormFieldsContext<FdpAttended> }) {
  const { form, setForm, submitted, errors, coreFieldDisabled, controlsDisabled, isViewMode, uploadsVisible, persistCurrentMutation, submitAttemptedFinal, email } = ctx;
  const { t, fieldLabel } = useTranslation();

  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);

  // Per-group completion counts
  const g1Filled = [form.academicYear, form.semesterType].filter(Boolean).length;
  const g2Filled = [form.programName, form.organisingBody, form.level, form.mode].filter(Boolean).length;
  const g3Filled = [form.startDate, form.endDate].filter(Boolean).length;
  const g4Filled = [form.sponsored].filter(Boolean).length
    + (form.sponsored === "Yes" ? [form.fundingAgency].filter(Boolean).length + (form.fundingAmount !== null && form.fundingAmount !== undefined ? 1 : 0) : 0);
  const g4Total = form.sponsored === "Yes" ? 3 : 1;
  const g5Filled = (form.permissionLetter?.length > 0 ? 1 : 0) + (form.completionCertificate?.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* ── Group 1: Academic Period ── */}
      <FormFieldGroup
        step={1}
        title={t('entry.groupAcademicPeriod')}
        subtitle={t('entry.groupAcademicPeriodHint')}
        icon={Calendar}
        accent="#60a5fa"
        filled={g1Filled}
        total={2}
        animationDelay={0}
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label={fieldLabel('semesterType')} error={submitted ? errors.semesterType : undefined} fieldKey="semesterType">
            <PillSelect
              value={form.semesterType || ""}
              onChange={(value) => setForm((c) => ({ ...c, semesterType: value }))}
              options={SEMESTER_TYPE_OPTIONS}
              disabled={coreFieldDisabled("semesterType")}
              error={submitted && !!errors.semesterType}
              accent="#60a5fa"
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* ── Group 2: Program Details ── */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupProgramDetails')}
        subtitle={t('entry.groupProgramDetailsHint')}
        icon={BookOpen}
        accent="var(--color-primary)"
        filled={g2Filled}
        total={4}
        animationDelay={60}
      >
        <div className="space-y-4">
          {/* Program name gets full width — it's the hero field */}
          <Field label={fieldLabel('programName')} error={submitted ? errors.programName : undefined} fieldKey="programName">
            <TextInput
              value={form.programName || ""}
              onChange={(e) => setForm((c) => ({ ...c, programName: e.target.value }))}
              disabled={coreFieldDisabled("programName")}
              error={submitted && !!errors.programName}
              placeholder={t('placeholder.programName')}
            />
          </Field>
          <Field label={fieldLabel('organisingBody')} error={submitted ? errors.organisingBody : undefined} fieldKey="organisingBody">
            <TextInput
              value={form.organisingBody || ""}
              onChange={(e) => setForm((c) => ({ ...c, organisingBody: e.target.value }))}
              disabled={coreFieldDisabled("organisingBody")}
              error={submitted && !!errors.organisingBody}
              placeholder={t('placeholder.organisingBody')}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('level')} error={submitted ? errors.level : undefined} fieldKey="level">
              <PillSelect
                value={form.level || ""}
                onChange={(value) => setForm((c) => ({ ...c, level: value }))}
                options={LEVEL_OPTIONS}
                disabled={coreFieldDisabled("level")}
                error={submitted && !!errors.level}
              />
            </Field>
            <Field label={fieldLabel('mode')} error={submitted ? errors.mode : undefined} fieldKey="mode">
              <PillSelect
                value={form.mode || ""}
                onChange={(value) => setForm((c) => ({ ...c, mode: value }))}
                options={MODE_OPTIONS}
                disabled={coreFieldDisabled("mode")}
                error={submitted && !!errors.mode}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* ── Group 3: Schedule ── */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupSchedule')}
        subtitle={t('entry.groupScheduleHint')}
        icon={Clock}
        accent="#f59e0b"
        filled={g3Filled}
        total={2}
        animationDelay={120}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('startDate')} error={submitted ? errors.startDate : undefined} fieldKey="startDate">
            <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
          </Field>
          <Field label={fieldLabel('endDate')} error={submitted ? errors.endDate : undefined} fieldKey="endDate">
            <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
          </Field>
          <Field label={t('entry.numberOfDays')} hint={t('entry.inclusiveDayCount')}>
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{inclusiveDays ?? "-"}</div>
          </Field>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{t('entry.streakEligibility')}</p>
      </FormFieldGroup>

      {/* ── Group 4: Funding ── */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupFunding')}
        subtitle={t('entry.groupFundingHint')}
        icon={Banknote}
        accent="#a78bfa"
        filled={g4Filled}
        total={g4Total}
        animationDelay={180}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('sponsored')} error={submitted ? errors.sponsored : undefined} fieldKey="sponsored">
            <PillSelect
              value={form.sponsored || ""}
              onChange={(value) => setForm((c) => ({ ...c, sponsored: value, ...(value === "No" ? { fundingAgency: "", fundingAmount: null } : {}) }))}
              options={SPONSORED_OPTIONS}
              disabled={coreFieldDisabled("sponsored")}
              error={submitted && !!errors.sponsored}
              accent="#a78bfa"
            />
          </Field>
          {form.sponsored === "Yes" && (
            <div className="grid gap-4 sm:grid-cols-2 animate-fade-in-up">
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
                  placeholder="15000"
                />
              </Field>
            </div>
          )}
        </div>
      </FormFieldGroup>

      {/* ── Group 5: Supporting Documents (Stage 2) ── */}
      {uploadsVisible ? (
        <>
          <StageTwoDivider />
          <FormFieldGroup
            step={5}
            title={t('entry.groupDocuments')}
            subtitle={t('entry.groupDocumentsHint')}
            icon={Unlock}
            accent="#10b981"
            filled={g5Filled}
            total={2}
            animationDelay={0}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadFieldMulti
                key={`${form.id}-permissionLetter`}
                title={fieldLabel('permissionLetter')}
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
                title={fieldLabel('completionCertificate')}
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
          </FormFieldGroup>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function FdpAttendedPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<FdpAttended>
      {...props}
      category="fdp-attended"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          level: safeString(e.level),
          mode: safeString(e.mode),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          programName: safeString(e.programName),
          organisingBody: safeString(e.organisingBody),
          sponsored: safeBoolString(e.sponsored),
          fundingAgency: safeString(e.fundingAgency),
          fundingAmount: safeNumber(e.fundingAmount) ?? safeNumber(e.supportAmount),
          permissionLetter: ensureFileMetaArray(e.permissionLetter),
          completionCertificate: ensureFileMetaArray(e.completionCertificate),
          streak: ensureStreak(e.streak),
        } as FdpAttended;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <FdpAttendedFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => entry.programName}
      buildListEntrySubtitle={(entry) => entry.organisingBody}
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
        if (entry.sponsored === "Yes" && entry.fundingAgency) parts.push(`${t('entry.fundedBy')} ${entry.fundingAgency}`);
        if (entry.sponsored === "Yes" && typeof entry.fundingAmount === "number") parts.push(formatCurrency(entry.fundingAmount, "en"));
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Completion Certificate", files: entry.completionCertificate },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.fdpAttendedPageTitle')}
      subtitle={t('entry.fdpAttendedPageSubtitle')}
      formTitle={t('entry.fdpAttendedFormTitle')}
      formSubtitle={t('entry.fdpAttendedFormSubtitle')}
      deleteDescription={t('entry.fdpAttendedDeleteDesc')}
    />
  );
}

export default FdpAttendedPage;
