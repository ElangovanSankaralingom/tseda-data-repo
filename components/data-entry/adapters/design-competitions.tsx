"use client";

import { Calendar, Trophy, Clock, Users, Unlock, Flag, Globe, CloudSun, Sun } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import FacultyPickerRows, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { safeString, ensureFileMetaArray, ensureFacultyArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { DesignCompetitionEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Design Competitions — PERMISSION flow (S4 ruling): prior approval to
 * participate. The result (Award / Participation) is known only after the
 * competition, so it lives at stage 2 next to the certificate and drives
 * the design_competition tier (5 / 2).
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const LEVEL_OPTIONS = [
  { label: "National", value: "National", icon: Flag },
  { label: "International", value: "International", icon: Globe },
];

const RESULT_OPTIONS = [
  { label: "Recognized Entry / Award", value: "Recognized Entry / Award" },
  { label: "Participation", value: "Participation" },
];

function emptyForm(): DesignCompetitionEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    competitionName: "",
    level: "",
    organizer: "",
    startDate: "",
    endDate: "",
    entryTheme: "",
    teamMembers: [],
    result: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    certificate: [],
    submissionCopy: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as DesignCompetitionEntry;
}

function validateFields(form: DesignCompetitionEntry): Record<string, string> {
  return validateEntryFields("design-competitions", form as unknown as Record<string, unknown>);
}

function DesignCompetitionFormFields({ ctx }: { ctx: FormFieldsContext<DesignCompetitionEntry> }) {
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
  } = ctx;

  const { t, fieldLabel } = useTranslation();
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);

  async function persistTeamRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({ ...current, teamMembers: nextRows }),
      selectResult: (persisted) => persisted.teamMembers,
    });
  }

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.competitionName ? 1 : 0) + (form.level ? 1 : 0) + (form.organizer ? 1 : 0);
  const group3Complete = (form.startDate ? 1 : 0) + (form.endDate ? 1 : 0);
  const group4Complete = (form.teamMembers.length > 0 ? 1 : 0) + (form.entryTheme ? 1 : 0);
  const group5Complete = (form.result ? 1 : 0) + (form.certificate.length > 0 ? 1 : 0) + (form.submissionCopy.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Group 1: Academic Period — the export-filter spine */}
      <FormFieldGroup
        step={1}
        title={t('entry.groupAcademicPeriod')}
        icon={Calendar}
        accent="#60a5fa"
        filled={group1Complete}
        total={2}
        disabled={coreFieldDisabled("academicYear") && coreFieldDisabled("semesterType")}
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
              accent="#60a5fa"
              disabled={coreFieldDisabled("semesterType")}
              error={submitted && !!errors.semesterType}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 2: The competition */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupCompetition')}
        icon={Trophy}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("competitionName") && coreFieldDisabled("level")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('competitionName')} error={submitted ? errors.competitionName : undefined} fieldKey="competitionName">
            <TextInput
              value={form.competitionName || ""}
              onChange={(e) => setForm((c) => ({ ...c, competitionName: e.target.value }))}
              disabled={coreFieldDisabled("competitionName")}
              error={submitted && !!errors.competitionName}
              placeholder={t('placeholder.competitionName')}
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

            <Field label={fieldLabel('organizer')} error={submitted ? errors.organizer : undefined} fieldKey="organizer">
              <TextInput
                value={form.organizer || ""}
                onChange={(e) => setForm((c) => ({ ...c, organizer: e.target.value }))}
                disabled={coreFieldDisabled("organizer")}
                error={submitted && !!errors.organizer}
                placeholder={t('placeholder.competitionOrganizer')}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 3: Schedule */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupSchedule')}
        icon={Clock}
        accent="#f59e0b"
        filled={group3Complete}
        total={2}
        disabled={coreFieldDisabled("startDate") && coreFieldDisabled("endDate")}
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
      </FormFieldGroup>

      {/* Group 4: Team & entry theme */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupCoordination')}
        icon={Users}
        accent="#06b6d4"
        filled={group4Complete}
        total={2}
        disabled={coreFieldDisabled("teamMembers")}
        animationDelay={180}
      >
        <div className="space-y-4">
          <FacultyPickerRows
            title={t('entry.competitionTeamTitle')}
            helperText={t('entry.competitionTeamHint')}
            addLabel={t('entry.addTeamMember')}
            rowLabelPrefix={t('entry.teamMemberLabel')}
            rows={form.teamMembers}
            onRowsChange={(rows) => setForm((c) => ({ ...c, teamMembers: rows }))}
            onPersistRow={async (rows) => persistTeamRows(rows)}
            facultyEndpoint="/api/faculty"
            parentLocked={coreFieldDisabled("teamMembers")}
            viewOnly={isViewMode}
            disableEmails={[email]}
            sectionError={errors.teamMembers}
            showSectionError={submitted}
            emptyStateText={t('entry.noTeamMembers')}
            validateRow={(rows, row, index) => {
              if (!row.email) return t('entry.selectFaculty');
              if (row.email.trim().toLowerCase() === email.trim().toLowerCase()) {
                return t('entry.facultyAlreadySelected');
              }
              const duplicates = rows.filter(
                (item, itemIndex) =>
                  itemIndex !== index && item.email.trim().toLowerCase() === row.email.trim().toLowerCase()
              ).length;
              return duplicates > 0 ? t('entry.facultyAlreadySelected') : null;
            }}
          />

          <Field label={fieldLabel('entryTheme')} fieldKey="entryTheme">
            <TextInput
              value={form.entryTheme || ""}
              onChange={(e) => setForm((c) => ({ ...c, entryTheme: e.target.value }))}
              disabled={coreFieldDisabled("entryTheme")}
              placeholder={t('placeholder.entryTheme')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 5: Result & proof (Stage 2 — unlocked by Generate) */}
      {uploadsVisible && (
        <FormFieldGroup
          step={5}
          title={t('entry.groupResultProof')}
          icon={Unlock}
          accent="#10b981"
          filled={group5Complete}
          total={3}
          disabled={controlsDisabled}
          animationDelay={240}
        >
          <div className="space-y-4">
            <StageTwoDivider />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={fieldLabel('result')} error={submitAttemptedFinal ? errors.result : undefined} hint={t('entry.resultHint')} fieldKey="result">
                <SelectDropdown
                  value={form.result || ""}
                  onChange={(value) => {
                    setForm((c) => ({ ...c, result: value }));
                    void persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, result: value }) });
                  }}
                  options={RESULT_OPTIONS}
                  placeholder={t('placeholder.selectResult')}
                  disabled={controlsDisabled}
                  error={submitAttemptedFinal && !!errors.result}
                />
              </Field>

              <UploadFieldMulti
                key={`${form.id}-certificate`}
                title={fieldLabel('certificate')}
                value={form.certificate}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, certificate: [...c.certificate, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, certificate: c.certificate.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/design-competitions/file"
                email={email} recordId={form.id} slotName="certificate"
                showRequiredError={submitAttemptedFinal && form.certificate.length === 0}
                requiredErrorText={errors.certificate}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-submissionCopy`}
                title={fieldLabel('submissionCopy')}
                value={form.submissionCopy}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, submissionCopy: [...c.submissionCopy, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, submissionCopy: c.submissionCopy.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/design-competitions/file"
                email={email} recordId={form.id} slotName="submissionCopy"
                showRequiredError={false}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />
            </div>
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function DesignCompetitionsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<DesignCompetitionEntry>
      {...props}
      category="design-competitions"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          competitionName: safeString(e.competitionName),
          level: safeString(e.level),
          organizer: safeString(e.organizer),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          entryTheme: safeString(e.entryTheme),
          result: safeString(e.result),
          teamMembers: ensureFacultyArray(e.teamMembers),
          certificate: ensureFileMetaArray(e.certificate),
          submissionCopy: ensureFileMetaArray(e.submissionCopy),
          streak: ensureStreak(e.streak),
        } as DesignCompetitionEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <DesignCompetitionFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.competitionName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.result ? `${entry.result}${entry.level ? ` — ${entry.level}` : ""}` : entry.level || ""
      }
      renderListEntryBody={({ entry, group }) => {
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        if (entry.organizer) parts.push(entry.organizer);
        if (entry.teamMembers.length > 0) {
          parts.push(`${t('fields.teamMembers')}: ${entry.teamMembers.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Certificate", files: entry.certificate },
              { label: "Submission Copy", files: entry.submissionCopy },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.designCompetitionsPageTitle')}
      subtitle={t('entry.designCompetitionsPageSubtitle')}
      formTitle={t('entry.designCompetitionsFormTitle')}
      formSubtitle={t('entry.designCompetitionsFormSubtitle')}
      deleteDescription={t('entry.designCompetitionsDeleteDesc')}
    />
  );
}

export default DesignCompetitionsPage;
