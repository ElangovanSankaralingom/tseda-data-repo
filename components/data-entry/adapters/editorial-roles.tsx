"use client";

import { Calendar, FileCheck2, Link2, PenLine, CloudSun, Sun } from "lucide-react";
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
import type { EditorialRoleEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Editorial Roles — record flow (S5). Individual recognition: no fan-out.
 * Editor / Associate Editor roles score the fixed award points; board and
 * reviewer roles are recorded for the profile/NAAC.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const ROLE_OPTIONS = [
  { label: "Editor", value: "Editor" },
  { label: "Associate Editor", value: "Associate Editor" },
  { label: "Editorial Board Member", value: "Editorial Board Member" },
  { label: "Reviewer", value: "Reviewer" },
];

function emptyForm(): EditorialRoleEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    journalName: "",
    role: "",
    issn: "",
    publisher: "",
    appointmentDate: "",
    detailsText: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    appointmentProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as EditorialRoleEntry;
}

function validateFields(form: EditorialRoleEntry): Record<string, string> {
  return validateEntryFields("editorial-roles", form as unknown as Record<string, unknown>);
}

function EditorialRoleFormFields({ ctx }: { ctx: FormFieldsContext<EditorialRoleEntry> }) {
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

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.journalName ? 1 : 0) + (form.role ? 1 : 0) + (form.appointmentDate ? 1 : 0);
  const group3Complete = (form.issn ? 1 : 0) + (form.publisher ? 1 : 0) + (form.detailsText ? 1 : 0);
  const group4Complete = form.appointmentProof.length > 0 ? 1 : 0;

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

      {/* Group 2: Role */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupEditorialRole')}
        icon={PenLine}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("journalName") && coreFieldDisabled("role")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('journalName')} error={submitted ? errors.journalName : undefined} fieldKey="journalName">
            <TextInput
              value={form.journalName || ""}
              onChange={(e) => setForm((c) => ({ ...c, journalName: e.target.value }))}
              disabled={coreFieldDisabled("journalName")}
              error={submitted && !!errors.journalName}
              placeholder={t('placeholder.journalName')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('role')} error={submitted ? errors.role : undefined} hint={t('entry.editorialRoleHint')} fieldKey="role">
              <SelectDropdown
                value={form.role || ""}
                onChange={(value) => setForm((c) => ({ ...c, role: value }))}
                options={ROLE_OPTIONS}
                placeholder={t('placeholder.selectRole')}
                disabled={coreFieldDisabled("role")}
                error={submitted && !!errors.role}
              />
            </Field>

            <Field label={fieldLabel('appointmentDate')} error={submitted ? errors.appointmentDate : undefined} fieldKey="appointmentDate">
              <DateField
                value={form.appointmentDate}
                onChange={(v) => setForm((c) => ({ ...c, appointmentDate: v }))}
                disabled={coreFieldDisabled("appointmentDate")}
                error={submitted && !!errors.appointmentDate}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 3: Journal details */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupIdentifiers')}
        icon={Link2}
        accent="#f59e0b"
        filled={group3Complete}
        total={3}
        disabled={coreFieldDisabled("issn") && coreFieldDisabled("publisher")}
        animationDelay={120}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('issn')} fieldKey="issn">
              <TextInput
                value={form.issn || ""}
                onChange={(e) => setForm((c) => ({ ...c, issn: e.target.value }))}
                disabled={coreFieldDisabled("issn")}
                placeholder={t('placeholder.issn')}
              />
            </Field>

            <Field label={fieldLabel('publisher')} fieldKey="publisher">
              <TextInput
                value={form.publisher || ""}
                onChange={(e) => setForm((c) => ({ ...c, publisher: e.target.value }))}
                disabled={coreFieldDisabled("publisher")}
                placeholder={t('placeholder.publisher')}
              />
            </Field>
          </div>

          <Field label={fieldLabel('detailsText')} hint={t('entry.editorialDetailsHint')} fieldKey="detailsText">
            <TextInput
              value={form.detailsText || ""}
              onChange={(e) => setForm((c) => ({ ...c, detailsText: e.target.value }))}
              disabled={coreFieldDisabled("detailsText")}
              placeholder={t('placeholder.editorialDetails')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 4: Proofs — part of the draft in the record flow */}
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
              key={`${form.id}-appointmentProof`}
              title={fieldLabel('appointmentProof')}
              value={form.appointmentProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, appointmentProof: [...c.appointmentProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, appointmentProof: c.appointmentProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/editorial-roles/file"
              email={email} recordId={form.id} slotName="appointmentProof"
              showRequiredError={submitAttemptedFinal && form.appointmentProof.length === 0}
              requiredErrorText={errors.appointmentProof}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function EditorialRolesPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<EditorialRoleEntry>
      {...props}
      category="editorial-roles"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          journalName: safeString(e.journalName),
          role: safeString(e.role),
          issn: safeString(e.issn),
          publisher: safeString(e.publisher),
          appointmentDate: safeString(e.appointmentDate),
          detailsText: safeString(e.detailsText),
          appointmentProof: ensureFileMetaArray(e.appointmentProof),
          streak: ensureStreak(e.streak),
        } as EditorialRoleEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <EditorialRoleFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.journalName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => entry.role || ""}
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.appointmentDate) parts.push(formatDisplayDate(entry.appointmentDate));
        if (entry.issn) parts.push(`ISSN ${entry.issn}`);
        if (entry.publisher) parts.push(entry.publisher);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Appointment Proof", files: entry.appointmentProof },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.editorialRolesPageTitle')}
      subtitle={t('entry.editorialRolesPageSubtitle')}
      formTitle={t('entry.editorialRolesFormTitle')}
      formSubtitle={t('entry.editorialRolesFormSubtitle')}
      deleteDescription={t('entry.editorialRolesDeleteDesc')}
    />
  );
}

export default EditorialRolesPage;
