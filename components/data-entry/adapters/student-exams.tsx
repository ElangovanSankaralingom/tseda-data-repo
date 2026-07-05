"use client";

import { Calendar, ClipboardCheck, GraduationCap, FileCheck2, CloudSun, Sun } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid } from "@/lib/utils/idHelpers";
import { safeString, ensureFileMetaArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { StudentExamEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/** Competitive Exams — DLC-scoped department record (B2). */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const PROGRAMME_OPTIONS = [
  { label: "B.Arch", value: "B.Arch" },
  { label: "M.Arch", value: "M.Arch" },
];

function emptyForm(): StudentExamEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    regNo: "",
    studentName: "",
    programme: "",
    examName: "",
    scoreOrRank: "",
    examDate: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    scoreProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as StudentExamEntry;
}

function validateFields(form: StudentExamEntry): Record<string, string> {
  return validateEntryFields("student-exams", form as unknown as Record<string, unknown>);
}

function StudentExamFormFields({ ctx }: { ctx: FormFieldsContext<StudentExamEntry> }) {
  const {
    form, setForm, submitted, errors, coreFieldDisabled, controlsDisabled,
    isViewMode, uploadsVisible, persistCurrentMutation, email,
  } = ctx;
  const { t, fieldLabel } = useTranslation();

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.regNo ? 1 : 0) + (form.studentName ? 1 : 0) + (form.programme ? 1 : 0);
  const group3Complete = (form.examName ? 1 : 0) + (form.scoreOrRank ? 1 : 0) + (form.examDate ? 1 : 0);

  return (
    <div className="space-y-4">
      <FormFieldGroup step={1} title={t('entry.groupAcademicPeriod')} icon={Calendar} accent="#60a5fa" filled={group1Complete} total={2} disabled={coreFieldDisabled("academicYear") && coreFieldDisabled("semesterType")} animationDelay={0}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={fieldLabel('academicYear')} error={submitted ? errors.academicYear : undefined} fieldKey="academicYear">
            <SelectDropdown value={form.academicYear || ""} onChange={(value) => setForm((c) => ({ ...c, academicYear: value }))} options={ACADEMIC_YEAR_DROPDOWN_OPTIONS} placeholder={t('placeholder.selectAcademicYear')} disabled={coreFieldDisabled("academicYear")} error={submitted && !!errors.academicYear} />
          </Field>
          <Field label={fieldLabel('semesterType')} error={submitted ? errors.semesterType : undefined} fieldKey="semesterType">
            <PillSelect value={form.semesterType || ""} onChange={(value) => setForm((c) => ({ ...c, semesterType: value }))} options={SEMESTER_TYPE_OPTIONS} accent="#60a5fa" disabled={coreFieldDisabled("semesterType")} error={submitted && !!errors.semesterType} />
          </Field>
        </div>
      </FormFieldGroup>

      <FormFieldGroup step={2} title={t('entry.groupStudent')} icon={GraduationCap} accent="var(--color-primary)" filled={group2Complete} total={3} disabled={coreFieldDisabled("regNo") && coreFieldDisabled("studentName")} animationDelay={60}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('regNo')} error={submitted ? errors.regNo : undefined} fieldKey="regNo">
            <TextInput value={form.regNo || ""} onChange={(e) => setForm((c) => ({ ...c, regNo: e.target.value }))} disabled={coreFieldDisabled("regNo")} error={submitted && !!errors.regNo} placeholder={t('placeholder.regNo')} />
          </Field>
          <Field label={fieldLabel('studentName')} error={submitted ? errors.studentName : undefined} fieldKey="studentName">
            <TextInput value={form.studentName || ""} onChange={(e) => setForm((c) => ({ ...c, studentName: e.target.value }))} disabled={coreFieldDisabled("studentName")} error={submitted && !!errors.studentName} placeholder={t('placeholder.studentName')} />
          </Field>
          <Field label={fieldLabel('programme')} error={submitted ? errors.programme : undefined} fieldKey="programme">
            <SelectDropdown value={form.programme || ""} onChange={(value) => setForm((c) => ({ ...c, programme: value }))} options={PROGRAMME_OPTIONS} placeholder={t('placeholder.selectProgramme')} disabled={coreFieldDisabled("programme")} error={submitted && !!errors.programme} />
          </Field>
        </div>
      </FormFieldGroup>

      <FormFieldGroup step={3} title={t('entry.groupExam')} icon={ClipboardCheck} accent="#f59e0b" filled={group3Complete} total={3} disabled={coreFieldDisabled("examName")} animationDelay={120}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('examName')} error={submitted ? errors.examName : undefined} fieldKey="examName">
            <TextInput value={form.examName || ""} onChange={(e) => setForm((c) => ({ ...c, examName: e.target.value }))} disabled={coreFieldDisabled("examName")} error={submitted && !!errors.examName} placeholder={t('placeholder.examName')} />
          </Field>
          <Field label={fieldLabel('scoreOrRank')} error={submitted ? errors.scoreOrRank : undefined} fieldKey="scoreOrRank">
            <TextInput value={form.scoreOrRank || ""} onChange={(e) => setForm((c) => ({ ...c, scoreOrRank: e.target.value }))} disabled={coreFieldDisabled("scoreOrRank")} error={submitted && !!errors.scoreOrRank} placeholder={t('placeholder.scoreOrRank')} />
          </Field>
          <Field label={fieldLabel('examDate')} error={submitted ? errors.examDate : undefined} fieldKey="examDate">
            <DateField value={form.examDate} onChange={(v) => setForm((c) => ({ ...c, examDate: v }))} disabled={coreFieldDisabled("examDate")} error={submitted && !!errors.examDate} />
          </Field>
        </div>
      </FormFieldGroup>

      {uploadsVisible && (
        <FormFieldGroup step={4} title={t('entry.groupProofs')} icon={FileCheck2} accent="#10b981" filled={form.scoreProof.length > 0 ? 1 : 0} total={1} disabled={controlsDisabled} animationDelay={180}>
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadFieldMulti
              key={`${form.id}-scoreProof`}
              title={fieldLabel('scoreProof')}
              value={form.scoreProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, scoreProof: [...c.scoreProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, scoreProof: c.scoreProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/student-exams/file"
              email={email} recordId={form.id} slotName="scoreProof"
              showRequiredError={false}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function StudentExamsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<StudentExamEntry>
      {...props}
      category="student-exams"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          regNo: safeString(e.regNo),
          studentName: safeString(e.studentName),
          programme: safeString(e.programme),
          examName: safeString(e.examName),
          scoreOrRank: safeString(e.scoreOrRank),
          examDate: safeString(e.examDate),
          scoreProof: ensureFileMetaArray(e.scoreProof),
          streak: ensureStreak(e.streak),
        } as StudentExamEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <StudentExamFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.studentName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.examName ? `${entry.examName}${entry.scoreOrRank ? ` — ${entry.scoreOrRank}` : ""}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.regNo) parts.push(entry.regNo);
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.programme) parts.push(entry.programme);
        if (entry.examDate) parts.push(formatDisplayDate(entry.examDate));
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[{ label: "Score Proof", files: entry.scoreProof }]} group={group} />
          </>
        );
      }}
      title={t('entry.studentExamsPageTitle')}
      subtitle={t('entry.studentExamsPageSubtitle')}
      formTitle={t('entry.studentExamsFormTitle')}
      formSubtitle={t('entry.studentPlacementsFormSubtitle')}
      deleteDescription={t('entry.studentRecordDeleteDesc')}
    />
  );
}

export default StudentExamsPage;
