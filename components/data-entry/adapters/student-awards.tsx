"use client";

import { Calendar, Medal, GraduationCap, FileCheck2, CloudSun, Sun } from "lucide-react";
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
import type { StudentAwardEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/** Student Awards — DLC-scoped department record (B2). */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const PROGRAMME_OPTIONS = [
  { label: "B.Arch", value: "B.Arch" },
  { label: "M.Arch", value: "M.Arch" },
];

const LEVEL_OPTIONS = [
  { label: "Institute", value: "Institute" },
  { label: "State", value: "State" },
  { label: "National", value: "National" },
  { label: "International", value: "International" },
];

function emptyForm(): StudentAwardEntry {
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
    awardTitle: "",
    awardedBy: "",
    awardLevel: "",
    awardDate: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    awardProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as StudentAwardEntry;
}

function validateFields(form: StudentAwardEntry): Record<string, string> {
  return validateEntryFields("student-awards", form as unknown as Record<string, unknown>);
}

function StudentAwardFormFields({ ctx }: { ctx: FormFieldsContext<StudentAwardEntry> }) {
  const {
    form, setForm, submitted, errors, coreFieldDisabled, controlsDisabled,
    isViewMode, uploadsVisible, persistCurrentMutation, email,
  } = ctx;
  const { t, fieldLabel } = useTranslation();

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.regNo ? 1 : 0) + (form.studentName ? 1 : 0) + (form.programme ? 1 : 0);
  const group3Complete =
    (form.awardTitle ? 1 : 0) + (form.awardedBy ? 1 : 0) + (form.awardLevel ? 1 : 0) + (form.awardDate ? 1 : 0);

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

      <FormFieldGroup step={3} title={t('entry.groupAward')} icon={Medal} accent="#f59e0b" filled={group3Complete} total={4} disabled={coreFieldDisabled("awardTitle")} animationDelay={120}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('awardTitle')} error={submitted ? errors.awardTitle : undefined} fieldKey="awardTitle">
              <TextInput value={form.awardTitle || ""} onChange={(e) => setForm((c) => ({ ...c, awardTitle: e.target.value }))} disabled={coreFieldDisabled("awardTitle")} error={submitted && !!errors.awardTitle} placeholder={t('placeholder.awardTitle')} />
            </Field>
            <Field label={fieldLabel('awardedBy')} error={submitted ? errors.awardedBy : undefined} fieldKey="awardedBy">
              <TextInput value={form.awardedBy || ""} onChange={(e) => setForm((c) => ({ ...c, awardedBy: e.target.value }))} disabled={coreFieldDisabled("awardedBy")} error={submitted && !!errors.awardedBy} placeholder={t('placeholder.awardedBy')} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('awardLevel')} error={submitted ? errors.awardLevel : undefined} fieldKey="awardLevel">
              <SelectDropdown value={form.awardLevel || ""} onChange={(value) => setForm((c) => ({ ...c, awardLevel: value }))} options={LEVEL_OPTIONS} placeholder={t('placeholder.selectLevel')} disabled={coreFieldDisabled("awardLevel")} error={submitted && !!errors.awardLevel} />
            </Field>
            <Field label={fieldLabel('awardDate')} error={submitted ? errors.awardDate : undefined} fieldKey="awardDate">
              <DateField value={form.awardDate} onChange={(v) => setForm((c) => ({ ...c, awardDate: v }))} disabled={coreFieldDisabled("awardDate")} error={submitted && !!errors.awardDate} />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {uploadsVisible && (
        <FormFieldGroup step={4} title={t('entry.groupProofs')} icon={FileCheck2} accent="#10b981" filled={form.awardProof.length > 0 ? 1 : 0} total={1} disabled={controlsDisabled} animationDelay={180}>
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadFieldMulti
              key={`${form.id}-awardProof`}
              title={fieldLabel('awardProof')}
              value={form.awardProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, awardProof: [...c.awardProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, awardProof: c.awardProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/student-awards/file"
              email={email} recordId={form.id} slotName="awardProof"
              showRequiredError={false}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function StudentAwardsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<StudentAwardEntry>
      {...props}
      category="student-awards"
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
          awardTitle: safeString(e.awardTitle),
          awardedBy: safeString(e.awardedBy),
          awardLevel: safeString(e.awardLevel),
          awardDate: safeString(e.awardDate),
          awardProof: ensureFileMetaArray(e.awardProof),
          streak: ensureStreak(e.streak),
        } as StudentAwardEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <StudentAwardFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.studentName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.awardTitle ? `${entry.awardTitle}${entry.awardLevel ? ` — ${entry.awardLevel}` : ""}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.regNo) parts.push(entry.regNo);
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.awardedBy) parts.push(entry.awardedBy);
        if (entry.awardDate) parts.push(formatDisplayDate(entry.awardDate));
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[{ label: "Certificate", files: entry.awardProof }]} group={group} />
          </>
        );
      }}
      title={t('entry.studentAwardsPageTitle')}
      subtitle={t('entry.studentAwardsPageSubtitle')}
      formTitle={t('entry.studentAwardsFormTitle')}
      formSubtitle={t('entry.studentPlacementsFormSubtitle')}
      deleteDescription={t('entry.studentRecordDeleteDesc')}
    />
  );
}

export default StudentAwardsPage;
