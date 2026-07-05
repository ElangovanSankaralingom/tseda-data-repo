"use client";

import { Calendar, School, GraduationCap, FileCheck2, CloudSun, Sun } from "lucide-react";
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
import type { StudentHigherStudiesEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/** Higher Studies — DLC-scoped department record (B2). */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const PROGRAMME_OPTIONS = [
  { label: "B.Arch", value: "B.Arch" },
  { label: "M.Arch", value: "M.Arch" },
];

function emptyForm(): StudentHigherStudiesEntry {
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
    institutionName: "",
    courseAdmitted: "",
    country: "",
    qualifyingExam: "",
    admissionDate: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    admitProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as StudentHigherStudiesEntry;
}

function validateFields(form: StudentHigherStudiesEntry): Record<string, string> {
  return validateEntryFields("student-higher-studies", form as unknown as Record<string, unknown>);
}

function HigherStudiesFormFields({ ctx }: { ctx: FormFieldsContext<StudentHigherStudiesEntry> }) {
  const {
    form, setForm, submitted, errors, coreFieldDisabled, controlsDisabled,
    isViewMode, uploadsVisible, persistCurrentMutation, email,
  } = ctx;
  const { t, fieldLabel } = useTranslation();

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.regNo ? 1 : 0) + (form.studentName ? 1 : 0) + (form.programme ? 1 : 0);
  const group3Complete =
    (form.institutionName ? 1 : 0) + (form.courseAdmitted ? 1 : 0) + (form.country ? 1 : 0) + (form.admissionDate ? 1 : 0);

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

      <FormFieldGroup step={3} title={t('entry.groupAdmission')} icon={School} accent="#f59e0b" filled={group3Complete} total={4} disabled={coreFieldDisabled("institutionName")} animationDelay={120}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('institutionName')} error={submitted ? errors.institutionName : undefined} fieldKey="institutionName">
              <TextInput value={form.institutionName || ""} onChange={(e) => setForm((c) => ({ ...c, institutionName: e.target.value }))} disabled={coreFieldDisabled("institutionName")} error={submitted && !!errors.institutionName} placeholder={t('placeholder.institutionName')} />
            </Field>
            <Field label={fieldLabel('courseAdmitted')} error={submitted ? errors.courseAdmitted : undefined} fieldKey="courseAdmitted">
              <TextInput value={form.courseAdmitted || ""} onChange={(e) => setForm((c) => ({ ...c, courseAdmitted: e.target.value }))} disabled={coreFieldDisabled("courseAdmitted")} error={submitted && !!errors.courseAdmitted} placeholder={t('placeholder.courseAdmitted')} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={fieldLabel('country')} error={submitted ? errors.country : undefined} fieldKey="country">
              <TextInput value={form.country || ""} onChange={(e) => setForm((c) => ({ ...c, country: e.target.value }))} disabled={coreFieldDisabled("country")} error={submitted && !!errors.country} placeholder={t('placeholder.country')} />
            </Field>
            <Field label={fieldLabel('qualifyingExam')} fieldKey="qualifyingExam">
              <TextInput value={form.qualifyingExam || ""} onChange={(e) => setForm((c) => ({ ...c, qualifyingExam: e.target.value }))} disabled={coreFieldDisabled("qualifyingExam")} placeholder={t('placeholder.qualifyingExam')} />
            </Field>
            <Field label={fieldLabel('admissionDate')} error={submitted ? errors.admissionDate : undefined} fieldKey="admissionDate">
              <DateField value={form.admissionDate} onChange={(v) => setForm((c) => ({ ...c, admissionDate: v }))} disabled={coreFieldDisabled("admissionDate")} error={submitted && !!errors.admissionDate} />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {uploadsVisible && (
        <FormFieldGroup step={4} title={t('entry.groupProofs')} icon={FileCheck2} accent="#10b981" filled={form.admitProof.length > 0 ? 1 : 0} total={1} disabled={controlsDisabled} animationDelay={180}>
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadFieldMulti
              key={`${form.id}-admitProof`}
              title={fieldLabel('admitProof')}
              value={form.admitProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, admitProof: [...c.admitProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, admitProof: c.admitProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/student-higher-studies/file"
              email={email} recordId={form.id} slotName="admitProof"
              showRequiredError={false}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function StudentHigherStudiesPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<StudentHigherStudiesEntry>
      {...props}
      category="student-higher-studies"
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
          institutionName: safeString(e.institutionName),
          courseAdmitted: safeString(e.courseAdmitted),
          country: safeString(e.country),
          qualifyingExam: safeString(e.qualifyingExam),
          admissionDate: safeString(e.admissionDate),
          admitProof: ensureFileMetaArray(e.admitProof),
          streak: ensureStreak(e.streak),
        } as StudentHigherStudiesEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <HigherStudiesFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.studentName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.institutionName ? `${entry.institutionName}${entry.courseAdmitted ? ` — ${entry.courseAdmitted}` : ""}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.regNo) parts.push(entry.regNo);
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.country) parts.push(entry.country);
        if (entry.admissionDate) parts.push(formatDisplayDate(entry.admissionDate));
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[{ label: "Admit Proof", files: entry.admitProof }]} group={group} />
          </>
        );
      }}
      title={t('entry.studentHigherStudiesPageTitle')}
      subtitle={t('entry.studentHigherStudiesPageSubtitle')}
      formTitle={t('entry.studentHigherStudiesFormTitle')}
      formSubtitle={t('entry.studentPlacementsFormSubtitle')}
      deleteDescription={t('entry.studentRecordDeleteDesc')}
    />
  );
}

export default StudentHigherStudiesPage;
