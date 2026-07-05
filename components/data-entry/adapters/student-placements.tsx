"use client";

import { Calendar, GraduationCap, Building2, FileCheck2, CloudSun, Sun } from "lucide-react";
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
import { safeString, safeNumber, ensureFileMetaArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { StudentPlacementEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Student Placements — DLC-scoped department records (B2): keyed by
 * register number, entered only by the assigned placement DLC. Record
 * flow with no streaks, no feed, no award points.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const PROGRAMME_OPTIONS = [
  { label: "B.Arch", value: "B.Arch" },
  { label: "M.Arch", value: "M.Arch" },
];

const PLACEMENT_TYPE_OPTIONS = [
  { label: "On-Campus", value: "On-Campus" },
  { label: "Off-Campus", value: "Off-Campus" },
  { label: "Internship-to-Offer", value: "Internship-to-Offer" },
];

function emptyForm(): StudentPlacementEntry {
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
    companyName: "",
    roleOffered: "",
    packageLpa: null,
    offerDate: "",
    placementType: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    offerProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as StudentPlacementEntry;
}

function validateFields(form: StudentPlacementEntry): Record<string, string> {
  return validateEntryFields("student-placements", form as unknown as Record<string, unknown>);
}

function StudentPlacementFormFields({ ctx }: { ctx: FormFieldsContext<StudentPlacementEntry> }) {
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
    email,
  } = ctx;

  const { t, fieldLabel } = useTranslation();

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.regNo ? 1 : 0) + (form.studentName ? 1 : 0) + (form.programme ? 1 : 0);
  const group3Complete =
    (form.companyName ? 1 : 0) + (form.placementType ? 1 : 0) + (form.offerDate ? 1 : 0);
  const group4Complete = form.offerProof.length > 0 ? 1 : 0;

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

      {/* Group 2: The student */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupStudent')}
        icon={GraduationCap}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("regNo") && coreFieldDisabled("studentName")}
        animationDelay={60}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('regNo')} error={submitted ? errors.regNo : undefined} fieldKey="regNo">
            <TextInput
              value={form.regNo || ""}
              onChange={(e) => setForm((c) => ({ ...c, regNo: e.target.value }))}
              disabled={coreFieldDisabled("regNo")}
              error={submitted && !!errors.regNo}
              placeholder={t('placeholder.regNo')}
            />
          </Field>

          <Field label={fieldLabel('studentName')} error={submitted ? errors.studentName : undefined} fieldKey="studentName">
            <TextInput
              value={form.studentName || ""}
              onChange={(e) => setForm((c) => ({ ...c, studentName: e.target.value }))}
              disabled={coreFieldDisabled("studentName")}
              error={submitted && !!errors.studentName}
              placeholder={t('placeholder.studentName')}
            />
          </Field>

          <Field label={fieldLabel('programme')} error={submitted ? errors.programme : undefined} fieldKey="programme">
            <SelectDropdown
              value={form.programme || ""}
              onChange={(value) => setForm((c) => ({ ...c, programme: value }))}
              options={PROGRAMME_OPTIONS}
              placeholder={t('placeholder.selectProgramme')}
              disabled={coreFieldDisabled("programme")}
              error={submitted && !!errors.programme}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 3: The offer */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupOffer')}
        icon={Building2}
        accent="#f59e0b"
        filled={group3Complete}
        total={3}
        disabled={coreFieldDisabled("companyName") && coreFieldDisabled("placementType")}
        animationDelay={120}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('companyName')} error={submitted ? errors.companyName : undefined} fieldKey="companyName">
              <TextInput
                value={form.companyName || ""}
                onChange={(e) => setForm((c) => ({ ...c, companyName: e.target.value }))}
                disabled={coreFieldDisabled("companyName")}
                error={submitted && !!errors.companyName}
                placeholder={t('placeholder.companyName')}
              />
            </Field>

            <Field label={fieldLabel('roleOffered')} fieldKey="roleOffered">
              <TextInput
                value={form.roleOffered || ""}
                onChange={(e) => setForm((c) => ({ ...c, roleOffered: e.target.value }))}
                disabled={coreFieldDisabled("roleOffered")}
                placeholder={t('placeholder.roleOffered')}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={fieldLabel('placementType')} error={submitted ? errors.placementType : undefined} fieldKey="placementType">
              <SelectDropdown
                value={form.placementType || ""}
                onChange={(value) => setForm((c) => ({ ...c, placementType: value }))}
                options={PLACEMENT_TYPE_OPTIONS}
                placeholder={t('placeholder.selectPlacementType')}
                disabled={coreFieldDisabled("placementType")}
                error={submitted && !!errors.placementType}
              />
            </Field>

            <Field label={fieldLabel('offerDate')} error={submitted ? errors.offerDate : undefined} fieldKey="offerDate">
              <DateField
                value={form.offerDate}
                onChange={(v) => setForm((c) => ({ ...c, offerDate: v }))}
                disabled={coreFieldDisabled("offerDate")}
                error={submitted && !!errors.offerDate}
              />
            </Field>

            <Field label={fieldLabel('packageLpa')} fieldKey="packageLpa">
              <TextInput
                type="number"
                min="0"
                step="0.1"
                value={form.packageLpa === null ? "" : String(form.packageLpa)}
                onChange={(e) => setForm((c) => ({ ...c, packageLpa: e.target.value === "" ? null : Number(e.target.value) }))}
                disabled={coreFieldDisabled("packageLpa")}
                placeholder={t('placeholder.packageLpa')}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 4: Proof (optional — DLCs enter in bulk) */}
      {uploadsVisible && (
        <FormFieldGroup
          step={4}
          title={t('entry.groupProofs')}
          icon={FileCheck2}
          accent="#10b981"
          filled={group4Complete}
          total={1}
          disabled={controlsDisabled}
          animationDelay={180}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadFieldMulti
              key={`${form.id}-offerProof`}
              title={fieldLabel('offerProof')}
              value={form.offerProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, offerProof: [...c.offerProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, offerProof: c.offerProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/student-placements/file"
              email={email} recordId={form.id} slotName="offerProof"
              showRequiredError={false}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function StudentPlacementsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<StudentPlacementEntry>
      {...props}
      category="student-placements"
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
          companyName: safeString(e.companyName),
          roleOffered: safeString(e.roleOffered),
          packageLpa: safeNumber(e.packageLpa),
          offerDate: safeString(e.offerDate),
          placementType: safeString(e.placementType),
          offerProof: ensureFileMetaArray(e.offerProof),
          streak: ensureStreak(e.streak),
        } as StudentPlacementEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <StudentPlacementFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.studentName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.companyName ? `${entry.companyName}${entry.roleOffered ? ` — ${entry.roleOffered}` : ""}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.regNo) parts.push(entry.regNo);
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.programme) parts.push(entry.programme);
        if (entry.placementType) parts.push(entry.placementType);
        if (entry.offerDate) parts.push(formatDisplayDate(entry.offerDate));
        if (typeof entry.packageLpa === "number") parts.push(`${entry.packageLpa} LPA`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Offer Proof", files: entry.offerProof },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.studentPlacementsPageTitle')}
      subtitle={t('entry.studentPlacementsPageSubtitle')}
      formTitle={t('entry.studentPlacementsFormTitle')}
      formSubtitle={t('entry.studentPlacementsFormSubtitle')}
      deleteDescription={t('entry.studentPlacementsDeleteDesc')}
    />
  );
}

export default StudentPlacementsPage;
