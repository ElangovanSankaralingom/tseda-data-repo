"use client";

import { Calendar, UsersRound, Clock, Unlock, CloudSun, Sun, Rabbit, Turtle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid } from "@/lib/utils/idHelpers";
import { safeString, safeNumber, ensureFileMetaArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { MentoringProgramEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Mentoring Programs — PERMISSION flow (S3 ruling): fast/slow-learner
 * programmes need prior approval. fast_slow_learners awards a fixed 5
 * once per year; outcome proofs (schedules, certificates, arrear
 * clearance) complete the entry.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const TARGET_GROUP_OPTIONS = [
  { label: "Fast Learners", value: "Fast Learners", icon: Rabbit },
  { label: "Slow Learners", value: "Slow Learners", icon: Turtle },
];

function emptyForm(): MentoringProgramEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    programName: "",
    targetGroup: "",
    activityDetail: "",
    startDate: "",
    endDate: "",
    studentsCovered: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    outcomeProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as MentoringProgramEntry;
}

function validateFields(form: MentoringProgramEntry): Record<string, string> {
  return validateEntryFields("mentoring-programs", form as unknown as Record<string, unknown>);
}

function MentoringProgramFormFields({ ctx }: { ctx: FormFieldsContext<MentoringProgramEntry> }) {
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
  const requiredUploadsComplete = form.permissionLetter.length > 0 && form.outcomeProof.length > 0;

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.programName ? 1 : 0) + (form.targetGroup ? 1 : 0) + (form.activityDetail ? 1 : 0);
  const group3Complete = (form.startDate ? 1 : 0) + (form.endDate ? 1 : 0);
  const group4Complete =
    (form.permissionLetter.length > 0 ? 1 : 0) +
    (form.outcomeProof.length > 0 ? 1 : 0) +
    (typeof form.studentsCovered === "number" ? 1 : 0);

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

      {/* Group 2: The programme */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupMentoring')}
        icon={UsersRound}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("programName") && coreFieldDisabled("targetGroup")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('programName')} error={submitted ? errors.programName : undefined} fieldKey="programName">
            <TextInput
              value={form.programName || ""}
              onChange={(e) => setForm((c) => ({ ...c, programName: e.target.value }))}
              disabled={coreFieldDisabled("programName")}
              error={submitted && !!errors.programName}
              placeholder={t('placeholder.mentoringProgramName')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('targetGroup')} error={submitted ? errors.targetGroup : undefined} hint={t('entry.targetGroupHint')} fieldKey="targetGroup">
              <PillSelect
                value={form.targetGroup || ""}
                onChange={(value) => setForm((c) => ({ ...c, targetGroup: value }))}
                options={TARGET_GROUP_OPTIONS}
                disabled={coreFieldDisabled("targetGroup")}
                error={submitted && !!errors.targetGroup}
              />
            </Field>

            <Field label={fieldLabel('activityDetail')} error={submitted ? errors.activityDetail : undefined} fieldKey="activityDetail">
              <TextInput
                value={form.activityDetail || ""}
                onChange={(e) => setForm((c) => ({ ...c, activityDetail: e.target.value }))}
                disabled={coreFieldDisabled("activityDetail")}
                error={submitted && !!errors.activityDetail}
                placeholder={t('placeholder.mentoringActivity')}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={fieldLabel('startDate')} error={submitted ? errors.startDate : undefined} fieldKey="startDate">
            <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
          </Field>

          <Field label={fieldLabel('endDate')} error={submitted ? errors.endDate : undefined} fieldKey="endDate">
            <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 4: Outcomes (Stage 2 — unlocked by Generate) */}
      {uploadsVisible && (
        <FormFieldGroup
          step={4}
          title={t('entry.groupDocuments')}
          icon={Unlock}
          accent="#10b981"
          filled={group4Complete}
          total={3}
          disabled={controlsDisabled}
          animationDelay={180}
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
                uploadEndpoint="/api/me/mentoring-programs/file"
                email={email} recordId={form.id} slotName="permissionLetter"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.permissionLetter}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-outcomeProof`}
                title={fieldLabel('outcomeProof')}
                value={form.outcomeProof}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, outcomeProof: [...c.outcomeProof, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, outcomeProof: c.outcomeProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/mentoring-programs/file"
                email={email} recordId={form.id} slotName="outcomeProof"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.outcomeProof}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <Field label={fieldLabel('studentsCovered')} fieldKey="studentsCovered">
                <TextInput
                  type="number"
                  min="0"
                  value={form.studentsCovered === null ? "" : String(form.studentsCovered)}
                  onChange={(e) => setForm((c) => ({ ...c, studentsCovered: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  placeholder={t('placeholder.numberOfParticipants')}
                />
              </Field>
            </div>
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function MentoringProgramsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<MentoringProgramEntry>
      {...props}
      category="mentoring-programs"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          programName: safeString(e.programName),
          targetGroup: safeString(e.targetGroup),
          activityDetail: safeString(e.activityDetail),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          studentsCovered: safeNumber(e.studentsCovered),
          permissionLetter: ensureFileMetaArray(e.permissionLetter),
          outcomeProof: ensureFileMetaArray(e.outcomeProof),
          streak: ensureStreak(e.streak),
        } as MentoringProgramEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <MentoringProgramFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.programName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => entry.targetGroup || ""}
      renderListEntryBody={({ entry, group }) => {
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        if (typeof entry.studentsCovered === "number") parts.push(`${entry.studentsCovered} ${t('entry.participants')}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Outcome Proof", files: entry.outcomeProof },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.mentoringProgramsPageTitle')}
      subtitle={t('entry.mentoringProgramsPageSubtitle')}
      formTitle={t('entry.mentoringProgramsFormTitle')}
      formSubtitle={t('entry.mentoringProgramsFormSubtitle')}
      deleteDescription={t('entry.mentoringProgramsDeleteDesc')}
    />
  );
}

export default MentoringProgramsPage;
