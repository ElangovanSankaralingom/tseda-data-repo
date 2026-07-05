"use client";

import { Award, BadgeCheck, Calendar, FileCheck2, Users, Link2, CloudSun, Sun, Flag, Globe, FileUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import FacultyPickerRows, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { safeString, ensureFileMetaArray, ensureFacultyArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { PatentEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Patents — record flow (S6: data enter alone). `status` (Published |
 * Granted) is the award tier: granted 10, published 5. Inventors fan out
 * copies to listed TCE faculty.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const STATUS_OPTIONS = [
  { label: "Published", value: "Published", icon: FileUp },
  { label: "Granted", value: "Granted", icon: BadgeCheck },
];

const LEVEL_OPTIONS = [
  { label: "National", value: "National", icon: Flag },
  { label: "International", value: "International", icon: Globe },
];

function emptyForm(): PatentEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    patentTitle: "",
    status: "",
    level: "",
    applicationNumber: "",
    applicationDate: "",
    statusDate: "",
    inventors: [],
    externalInventors: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    patentDocument: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as PatentEntry;
}

function validateFields(form: PatentEntry): Record<string, string> {
  return validateEntryFields("patents", form as unknown as Record<string, unknown>);
}

function PatentFormFields({ ctx }: { ctx: FormFieldsContext<PatentEntry> }) {
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

  async function persistInventorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({ ...current, inventors: nextRows }),
      selectResult: (persisted) => persisted.inventors,
    });
  }

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.patentTitle ? 1 : 0) + (form.status ? 1 : 0) + (form.level ? 1 : 0);
  const group3Complete = (form.applicationNumber ? 1 : 0) + (form.statusDate ? 1 : 0) + (form.applicationDate ? 1 : 0);
  const group4Complete = (form.inventors.length > 0 ? 1 : 0) + (form.externalInventors ? 1 : 0);
  const group5Complete = form.patentDocument.length > 0 ? 1 : 0;

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

      {/* Group 2: Patent */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupPatent')}
        icon={Award}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("patentTitle") && coreFieldDisabled("status")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('patentTitle')} error={submitted ? errors.patentTitle : undefined} fieldKey="patentTitle">
            <TextInput
              value={form.patentTitle || ""}
              onChange={(e) => setForm((c) => ({ ...c, patentTitle: e.target.value }))}
              disabled={coreFieldDisabled("patentTitle")}
              error={submitted && !!errors.patentTitle}
              placeholder={t('placeholder.patentTitle')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('status')} error={submitted ? errors.status : undefined} hint={t('entry.patentStatusHint')} fieldKey="status">
              <PillSelect
                value={form.status || ""}
                onChange={(value) => setForm((c) => ({ ...c, status: value }))}
                options={STATUS_OPTIONS}
                disabled={coreFieldDisabled("status")}
                error={submitted && !!errors.status}
              />
            </Field>

            <Field label={fieldLabel('level')} error={submitted ? errors.level : undefined} fieldKey="level">
              <PillSelect
                value={form.level || ""}
                onChange={(value) => setForm((c) => ({ ...c, level: value }))}
                options={LEVEL_OPTIONS}
                disabled={coreFieldDisabled("level")}
                error={submitted && !!errors.level}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 3: Application & Dates */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupIdentifiers')}
        icon={Link2}
        accent="#f59e0b"
        filled={group3Complete}
        total={3}
        disabled={coreFieldDisabled("applicationNumber") && coreFieldDisabled("statusDate")}
        animationDelay={120}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('applicationNumber')} error={submitted ? errors.applicationNumber : undefined} fieldKey="applicationNumber">
            <TextInput
              value={form.applicationNumber || ""}
              onChange={(e) => setForm((c) => ({ ...c, applicationNumber: e.target.value }))}
              disabled={coreFieldDisabled("applicationNumber")}
              error={submitted && !!errors.applicationNumber}
              placeholder={t('placeholder.applicationNumber')}
            />
          </Field>

          <Field label={fieldLabel('statusDate')} error={submitted ? errors.statusDate : undefined} fieldKey="statusDate">
            <DateField
              value={form.statusDate}
              onChange={(v) => setForm((c) => ({ ...c, statusDate: v }))}
              disabled={coreFieldDisabled("statusDate")}
              error={submitted && !!errors.statusDate}
            />
          </Field>

          <Field label={fieldLabel('applicationDate')} fieldKey="applicationDate">
            <DateField
              value={form.applicationDate}
              onChange={(v) => setForm((c) => ({ ...c, applicationDate: v }))}
              disabled={coreFieldDisabled("applicationDate")}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 4: Inventors */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupInventors')}
        icon={Users}
        accent="#06b6d4"
        filled={group4Complete}
        total={2}
        disabled={coreFieldDisabled("inventors")}
        animationDelay={180}
      >
        <div className="space-y-4">
          <FacultyPickerRows
            title={t('entry.inventorTitle')}
            helperText={t('entry.inventorHint')}
            addLabel={t('entry.addInventor')}
            rowLabelPrefix={t('entry.inventorLabel')}
            rows={form.inventors}
            onRowsChange={(rows) => setForm((c) => ({ ...c, inventors: rows }))}
            onPersistRow={async (rows) => persistInventorRows(rows)}
            facultyEndpoint="/api/faculty"
            parentLocked={coreFieldDisabled("inventors")}
            viewOnly={isViewMode}
            disableEmails={[email]}
            sectionError={errors.inventors}
            showSectionError={submitted}
            emptyStateText={t('entry.noInventors')}
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

          <Field label={fieldLabel('externalInventors')} hint={t('entry.externalAuthorsHint')} fieldKey="externalInventors">
            <TextInput
              value={form.externalInventors || ""}
              onChange={(e) => setForm((c) => ({ ...c, externalInventors: e.target.value }))}
              disabled={coreFieldDisabled("externalInventors")}
              placeholder={t('placeholder.externalAuthors')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 5: Proofs — part of the draft in the record flow */}
      {uploadsVisible && (
        <FormFieldGroup
          step={5}
          title={t('entry.groupProofs')}
          icon={FileCheck2}
          accent="#10b981"
          filled={group5Complete}
          total={1}
          disabled={controlsDisabled}
          animationDelay={240}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadFieldMulti
              key={`${form.id}-patentDocument`}
              title={fieldLabel('patentDocument')}
              value={form.patentDocument}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, patentDocument: [...c.patentDocument, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, patentDocument: c.patentDocument.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/patents/file"
              email={email} recordId={form.id} slotName="patentDocument"
              showRequiredError={submitAttemptedFinal && form.patentDocument.length === 0}
              requiredErrorText={errors.patentDocument}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function PatentsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<PatentEntry>
      {...props}
      category="patents"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          patentTitle: safeString(e.patentTitle),
          status: safeString(e.status),
          level: safeString(e.level),
          applicationNumber: safeString(e.applicationNumber),
          applicationDate: safeString(e.applicationDate),
          statusDate: safeString(e.statusDate),
          inventors: ensureFacultyArray(e.inventors),
          externalInventors: safeString(e.externalInventors),
          patentDocument: ensureFileMetaArray(e.patentDocument),
          streak: ensureStreak(e.streak),
        } as PatentEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <PatentFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.patentTitle || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.status ? `${entry.status}${entry.level ? ` — ${entry.level}` : ""}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.applicationNumber) parts.push(`# ${entry.applicationNumber}`);
        if (entry.statusDate) parts.push(formatDisplayDate(entry.statusDate));
        if (entry.inventors.length > 0) {
          parts.push(`${t('fields.inventors')}: ${entry.inventors.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Patent Document", files: entry.patentDocument },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.patentsPageTitle')}
      subtitle={t('entry.patentsPageSubtitle')}
      formTitle={t('entry.patentsFormTitle')}
      formSubtitle={t('entry.patentsFormSubtitle')}
      deleteDescription={t('entry.patentsDeleteDesc')}
    />
  );
}

export default PatentsPage;
