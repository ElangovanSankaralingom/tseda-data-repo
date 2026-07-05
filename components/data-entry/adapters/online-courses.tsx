"use client";

import { Calendar, MonitorPlay, Clock, Unlock, CloudSun, Sun } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { t as staticT } from "@/lib/i18n";
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
import { safeString, ensureFileMetaArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { OnlineCourseEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Online / Industry-Supported Courses — PERMISSION flow (S3 ruling):
 * Dean-signed approval before development. courseKind routes the metric:
 * TCE Online (weeks tier 10/15/20) vs Industry-Supported (credits 4/8).
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const COURSE_KIND_OPTIONS = [
  { label: "TCE Online Course", value: "TCE Online Course" },
  { label: "Industry-Supported Course", value: "Industry-Supported Course" },
];

const DURATION_OPTIONS = [
  { label: "4 weeks", value: "4" },
  { label: "8 weeks", value: "8" },
  { label: "12 weeks", value: "12" },
];

const NEW_RERUN_OPTIONS = [
  { label: "New", value: "New" },
  { label: "Rerun", value: "Rerun" },
];

const CREDIT_OPTIONS = [
  { label: "One Credit", value: "1" },
  { label: "Two Credits", value: "2" },
];

function emptyForm(): OnlineCourseEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    courseName: "",
    courseKind: "",
    durationWeeks: "",
    newOrRerun: "",
    credits: "",
    industryExpert: "",
    startDate: "",
    endDate: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    deanProof: [],
    coursePageProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as OnlineCourseEntry;
}

function validateFields(form: OnlineCourseEntry): Record<string, string> {
  const errors = validateEntryFields("online-courses", form as unknown as Record<string, unknown>);
  // Conditional by kind — "proper data needed for all the entries".
  if (form.courseKind === "TCE Online Course") {
    if (!form.durationWeeks) errors.durationWeeks = staticT('entry.durationWeeksRequired', 'en');
    if (!form.newOrRerun) errors.newOrRerun = staticT('entry.newOrRerunRequired', 'en');
  }
  if (form.courseKind === "Industry-Supported Course") {
    if (!form.credits) errors.credits = staticT('entry.creditsRequired', 'en');
    if (!form.industryExpert?.trim()) errors.industryExpert = staticT('entry.industryExpertRequired', 'en');
  }
  return errors;
}

function OnlineCourseFormFields({ ctx }: { ctx: FormFieldsContext<OnlineCourseEntry> }) {
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

  const isTceOnline = form.courseKind === "TCE Online Course";
  const isIndustry = form.courseKind === "Industry-Supported Course";
  const requiredUploadsComplete = form.permissionLetter.length > 0 && form.deanProof.length > 0;

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete =
    (form.courseName ? 1 : 0) +
    (form.courseKind ? 1 : 0) +
    (isTceOnline ? (form.durationWeeks ? 1 : 0) + (form.newOrRerun ? 1 : 0) : 0) +
    (isIndustry ? (form.credits ? 1 : 0) + (form.industryExpert ? 1 : 0) : 0);
  const group2Total = 2 + (isTceOnline || isIndustry ? 2 : 0);
  const group3Complete = (form.startDate ? 1 : 0) + (form.endDate ? 1 : 0);
  const group4Complete =
    (form.permissionLetter.length > 0 ? 1 : 0) +
    (form.deanProof.length > 0 ? 1 : 0) +
    (form.coursePageProof.length > 0 ? 1 : 0);

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

      {/* Group 2: The course — kind drives which tier fields appear */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupCourse')}
        icon={MonitorPlay}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={group2Total}
        disabled={coreFieldDisabled("courseName") && coreFieldDisabled("courseKind")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('courseName')} error={submitted ? errors.courseName : undefined} fieldKey="courseName">
            <TextInput
              value={form.courseName || ""}
              onChange={(e) => setForm((c) => ({ ...c, courseName: e.target.value }))}
              disabled={coreFieldDisabled("courseName")}
              error={submitted && !!errors.courseName}
              placeholder={t('placeholder.onlineCourseName')}
            />
          </Field>

          <Field label={fieldLabel('courseKind')} error={submitted ? errors.courseKind : undefined} hint={t('entry.courseKindHint')} fieldKey="courseKind">
            <PillSelect
              value={form.courseKind || ""}
              onChange={(value) => setForm((c) => ({ ...c, courseKind: value }))}
              options={COURSE_KIND_OPTIONS}
              disabled={coreFieldDisabled("courseKind")}
              error={submitted && !!errors.courseKind}
            />
          </Field>

          {isTceOnline ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={fieldLabel('durationWeeks')} error={submitted ? errors.durationWeeks : undefined} fieldKey="durationWeeks">
                <SelectDropdown
                  value={form.durationWeeks || ""}
                  onChange={(value) => setForm((c) => ({ ...c, durationWeeks: value }))}
                  options={DURATION_OPTIONS}
                  placeholder={t('placeholder.selectDuration')}
                  disabled={coreFieldDisabled("durationWeeks")}
                  error={submitted && !!errors.durationWeeks}
                />
              </Field>

              <Field label={fieldLabel('newOrRerun')} error={submitted ? errors.newOrRerun : undefined} fieldKey="newOrRerun">
                <PillSelect
                  value={form.newOrRerun || ""}
                  onChange={(value) => setForm((c) => ({ ...c, newOrRerun: value }))}
                  options={NEW_RERUN_OPTIONS}
                  disabled={coreFieldDisabled("newOrRerun")}
                  error={submitted && !!errors.newOrRerun}
                />
              </Field>
            </div>
          ) : null}

          {isIndustry ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={fieldLabel('credits')} error={submitted ? errors.credits : undefined} fieldKey="credits">
                <PillSelect
                  value={form.credits || ""}
                  onChange={(value) => setForm((c) => ({ ...c, credits: value }))}
                  options={CREDIT_OPTIONS}
                  disabled={coreFieldDisabled("credits")}
                  error={submitted && !!errors.credits}
                />
              </Field>

              <Field label={fieldLabel('industryExpert')} error={submitted ? errors.industryExpert : undefined} fieldKey="industryExpert">
                <TextInput
                  value={form.industryExpert || ""}
                  onChange={(e) => setForm((c) => ({ ...c, industryExpert: e.target.value }))}
                  disabled={coreFieldDisabled("industryExpert")}
                  error={submitted && !!errors.industryExpert}
                  placeholder={t('placeholder.industryExpert')}
                />
              </Field>
            </div>
          ) : null}
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

      {/* Group 4: Documents (Stage 2 — unlocked by Generate) */}
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
                uploadEndpoint="/api/me/online-courses/file"
                email={email} recordId={form.id} slotName="permissionLetter"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.permissionLetter}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-deanProof`}
                title={fieldLabel('deanProof')}
                value={form.deanProof}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, deanProof: [...c.deanProof, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, deanProof: c.deanProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/online-courses/file"
                email={email} recordId={form.id} slotName="deanProof"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.deanProof}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-coursePageProof`}
                title={fieldLabel('coursePageProof')}
                value={form.coursePageProof}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, coursePageProof: [...c.coursePageProof, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, coursePageProof: c.coursePageProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/online-courses/file"
                email={email} recordId={form.id} slotName="coursePageProof"
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

export function OnlineCoursesPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<OnlineCourseEntry>
      {...props}
      category="online-courses"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          courseName: safeString(e.courseName),
          courseKind: safeString(e.courseKind),
          durationWeeks: safeString(e.durationWeeks),
          newOrRerun: safeString(e.newOrRerun),
          credits: safeString(e.credits),
          industryExpert: safeString(e.industryExpert),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          permissionLetter: ensureFileMetaArray(e.permissionLetter),
          deanProof: ensureFileMetaArray(e.deanProof),
          coursePageProof: ensureFileMetaArray(e.coursePageProof),
          streak: ensureStreak(e.streak),
        } as OnlineCourseEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <OnlineCourseFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.courseName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => entry.courseKind || ""}
      renderListEntryBody={({ entry, group }) => {
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        if (entry.durationWeeks) parts.push(`${entry.durationWeeks} ${t('entry.weeks')}`);
        if (entry.credits) parts.push(`${entry.credits} ${t('entry.credits')}`);
        if (entry.industryExpert) parts.push(entry.industryExpert);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Dean Proof", files: entry.deanProof },
              { label: "Course Page", files: entry.coursePageProof },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.onlineCoursesPageTitle')}
      subtitle={t('entry.onlineCoursesPageSubtitle')}
      formTitle={t('entry.onlineCoursesFormTitle')}
      formSubtitle={t('entry.onlineCoursesFormSubtitle')}
      deleteDescription={t('entry.onlineCoursesDeleteDesc')}
    />
  );
}

export default OnlineCoursesPage;
