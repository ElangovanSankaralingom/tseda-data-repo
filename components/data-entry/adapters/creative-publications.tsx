"use client";

import { Calendar, FileCheck2, Brush, Link2, CloudSun, Sun } from "lucide-react";
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
import type { CreativePublicationEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Creative Publications — record flow (roadmap #11). Essays, critiques,
 * and visual narratives in reputed design platforms/magazines; individual
 * recognition, 5 points per published piece.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

function emptyForm(): CreativePublicationEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    workTitle: "",
    publicationName: "",
    publicationDate: "",
    issn: "",
    workUrl: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    publicationCopy: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as CreativePublicationEntry;
}

function validateFields(form: CreativePublicationEntry): Record<string, string> {
  return validateEntryFields("creative-publications", form as unknown as Record<string, unknown>);
}

function CreativePublicationFormFields({ ctx }: { ctx: FormFieldsContext<CreativePublicationEntry> }) {
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
  const group2Complete = (form.workTitle ? 1 : 0) + (form.publicationName ? 1 : 0) + (form.publicationDate ? 1 : 0);
  const group3Complete = (form.issn ? 1 : 0) + (form.workUrl ? 1 : 0);
  const group4Complete = form.publicationCopy.length > 0 ? 1 : 0;

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

      {/* Group 2: The work */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupCreativeWork')}
        icon={Brush}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("workTitle") && coreFieldDisabled("publicationName")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('workTitle')} error={submitted ? errors.workTitle : undefined} fieldKey="workTitle">
            <TextInput
              value={form.workTitle || ""}
              onChange={(e) => setForm((c) => ({ ...c, workTitle: e.target.value }))}
              disabled={coreFieldDisabled("workTitle")}
              error={submitted && !!errors.workTitle}
              placeholder={t('placeholder.creativeWorkTitle')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('publicationName')} error={submitted ? errors.publicationName : undefined} hint={t('entry.creativePlatformHint')} fieldKey="publicationName">
              <TextInput
                value={form.publicationName || ""}
                onChange={(e) => setForm((c) => ({ ...c, publicationName: e.target.value }))}
                disabled={coreFieldDisabled("publicationName")}
                error={submitted && !!errors.publicationName}
                placeholder={t('placeholder.creativePlatform')}
              />
            </Field>

            <Field label={fieldLabel('publicationDate')} error={submitted ? errors.publicationDate : undefined} fieldKey="publicationDate">
              <DateField
                value={form.publicationDate}
                onChange={(v) => setForm((c) => ({ ...c, publicationDate: v }))}
                disabled={coreFieldDisabled("publicationDate")}
                error={submitted && !!errors.publicationDate}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 3: Identifiers */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupIdentifiers')}
        icon={Link2}
        accent="#f59e0b"
        filled={group3Complete}
        total={2}
        disabled={coreFieldDisabled("issn") && coreFieldDisabled("workUrl")}
        animationDelay={120}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={fieldLabel('issn')} fieldKey="issn">
            <TextInput
              value={form.issn || ""}
              onChange={(e) => setForm((c) => ({ ...c, issn: e.target.value }))}
              disabled={coreFieldDisabled("issn")}
              placeholder={t('placeholder.issn')}
            />
          </Field>

          <Field label={fieldLabel('workUrl')} fieldKey="workUrl">
            <TextInput
              value={form.workUrl || ""}
              onChange={(e) => setForm((c) => ({ ...c, workUrl: e.target.value }))}
              disabled={coreFieldDisabled("workUrl")}
              placeholder={t('placeholder.creativeWorkUrl')}
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
              key={`${form.id}-publicationCopy`}
              title={fieldLabel('publicationCopy')}
              value={form.publicationCopy}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, publicationCopy: [...c.publicationCopy, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, publicationCopy: c.publicationCopy.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/creative-publications/file"
              email={email} recordId={form.id} slotName="publicationCopy"
              showRequiredError={submitAttemptedFinal && form.publicationCopy.length === 0}
              requiredErrorText={errors.publicationCopy}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function CreativePublicationsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<CreativePublicationEntry>
      {...props}
      category="creative-publications"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          workTitle: safeString(e.workTitle),
          publicationName: safeString(e.publicationName),
          publicationDate: safeString(e.publicationDate),
          issn: safeString(e.issn),
          workUrl: safeString(e.workUrl),
          publicationCopy: ensureFileMetaArray(e.publicationCopy),
          streak: ensureStreak(e.streak),
        } as CreativePublicationEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <CreativePublicationFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.workTitle || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => entry.publicationName || ""}
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.publicationDate) parts.push(formatDisplayDate(entry.publicationDate));
        if (entry.issn) parts.push(`ISSN ${entry.issn}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Publication Copy", files: entry.publicationCopy },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.creativePublicationsPageTitle')}
      subtitle={t('entry.creativePublicationsPageSubtitle')}
      formTitle={t('entry.creativePublicationsFormTitle')}
      formSubtitle={t('entry.creativePublicationsFormSubtitle')}
      deleteDescription={t('entry.creativePublicationsDeleteDesc')}
    />
  );
}

export default CreativePublicationsPage;
