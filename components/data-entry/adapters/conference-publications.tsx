"use client";

import { BookOpen, Calendar, FileCheck2, Users, Link2, CloudSun, Sun, Flag, Globe } from "lucide-react";
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
import type { ConferencePublicationEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Conference Publications — record flow, specially collaborative (S5).
 * No Generate/PDF step: fields + proofs together, Submit locks the entry,
 * streak counts immediately, co-authors receive their own copies.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const LEVEL_OPTIONS = [
  { label: "National", value: "National", icon: Flag },
  { label: "International", value: "International", icon: Globe },
];

const INDEXING_OPTIONS = [
  { label: "Scopus", value: "Scopus" },
  { label: "Web of Science", value: "Web of Science" },
  { label: "UGC-CARE", value: "UGC-CARE" },
  { label: "Other/None", value: "Other/None" },
];

function emptyForm(): ConferencePublicationEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    paperTitle: "",
    conferenceName: "",
    level: "",
    organizedBy: "",
    publicationDate: "",
    issnIsbn: "",
    pageNumbers: "",
    doi: "",
    indexing: "",
    coAuthors: [],
    externalAuthors: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    firstPage: [],
    indexProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as ConferencePublicationEntry;
}

function validateFields(form: ConferencePublicationEntry): Record<string, string> {
  return validateEntryFields("conference-publications", form as unknown as Record<string, unknown>);
}

function ConferencePublicationFormFields({ ctx }: { ctx: FormFieldsContext<ConferencePublicationEntry> }) {
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

  async function persistCoAuthorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({ ...current, coAuthors: nextRows }),
      selectResult: (persisted) => persisted.coAuthors,
    });
  }

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.paperTitle ? 1 : 0) + (form.conferenceName ? 1 : 0) + (form.level ? 1 : 0) + (form.organizedBy ? 1 : 0);
  const group3Complete = (form.publicationDate ? 1 : 0) + (form.indexing ? 1 : 0) + (form.doi ? 1 : 0);
  const group4Complete = (form.coAuthors.length > 0 ? 1 : 0) + (form.externalAuthors ? 1 : 0);
  const group5Complete = (form.firstPage.length > 0 ? 1 : 0) + (form.indexProof.length > 0 ? 1 : 0);

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

      {/* Group 2: Conference */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupConference')}
        icon={BookOpen}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={4}
        disabled={coreFieldDisabled("paperTitle") && coreFieldDisabled("conferenceName")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('paperTitle')} error={submitted ? errors.paperTitle : undefined} fieldKey="paperTitle">
            <TextInput
              value={form.paperTitle || ""}
              onChange={(e) => setForm((c) => ({ ...c, paperTitle: e.target.value }))}
              disabled={coreFieldDisabled("paperTitle")}
              error={submitted && !!errors.paperTitle}
              placeholder={t('placeholder.paperTitle')}
            />
          </Field>

          <Field label={fieldLabel('conferenceName')} error={submitted ? errors.conferenceName : undefined} fieldKey="conferenceName">
            <TextInput
              value={form.conferenceName || ""}
              onChange={(e) => setForm((c) => ({ ...c, conferenceName: e.target.value }))}
              disabled={coreFieldDisabled("conferenceName")}
              error={submitted && !!errors.conferenceName}
              placeholder={t('placeholder.conferenceName')}
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

            <Field label={fieldLabel('organizedBy')} error={submitted ? errors.organizedBy : undefined} fieldKey="organizedBy">
              <TextInput
                value={form.organizedBy || ""}
                onChange={(e) => setForm((c) => ({ ...c, organizedBy: e.target.value }))}
                disabled={coreFieldDisabled("organizedBy")}
                error={submitted && !!errors.organizedBy}
                placeholder={t('placeholder.organizedBy')}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 3: Identifiers & Dates */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupIdentifiers')}
        icon={Link2}
        accent="#f59e0b"
        filled={group3Complete}
        total={3}
        disabled={coreFieldDisabled("publicationDate") && coreFieldDisabled("indexing")}
        animationDelay={120}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('publicationDate')} error={submitted ? errors.publicationDate : undefined} fieldKey="publicationDate">
              <DateField
                value={form.publicationDate}
                onChange={(v) => setForm((c) => ({ ...c, publicationDate: v }))}
                disabled={coreFieldDisabled("publicationDate")}
                error={submitted && !!errors.publicationDate}
              />
            </Field>

            <Field label={fieldLabel('indexing')} error={submitted ? errors.indexing : undefined} fieldKey="indexing">
              <SelectDropdown
                value={form.indexing || ""}
                onChange={(value) => setForm((c) => ({ ...c, indexing: value }))}
                options={INDEXING_OPTIONS}
                placeholder={t('placeholder.selectIndexing')}
                disabled={coreFieldDisabled("indexing")}
                error={submitted && !!errors.indexing}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={fieldLabel('issnIsbn')} fieldKey="issnIsbn">
              <TextInput
                value={form.issnIsbn || ""}
                onChange={(e) => setForm((c) => ({ ...c, issnIsbn: e.target.value }))}
                disabled={coreFieldDisabled("issnIsbn")}
                placeholder={t('placeholder.issn')}
              />
            </Field>

            <Field label={fieldLabel('doi')} fieldKey="doi">
              <TextInput
                value={form.doi || ""}
                onChange={(e) => setForm((c) => ({ ...c, doi: e.target.value }))}
                disabled={coreFieldDisabled("doi")}
                placeholder={t('placeholder.doi')}
              />
            </Field>

            <Field label={fieldLabel('pageNumbers')} fieldKey="pageNumbers">
              <TextInput
                value={form.pageNumbers || ""}
                onChange={(e) => setForm((c) => ({ ...c, pageNumbers: e.target.value }))}
                disabled={coreFieldDisabled("pageNumbers")}
                placeholder={t('placeholder.pageNumbers')}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 4: Authors — the specially collaborative part */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupAuthors')}
        icon={Users}
        accent="#06b6d4"
        filled={group4Complete}
        total={2}
        disabled={coreFieldDisabled("coAuthors")}
        animationDelay={180}
      >
        <div className="space-y-4">
          <FacultyPickerRows
            title={t('entry.coAuthorTitle')}
            helperText={t('entry.coAuthorHint')}
            addLabel={t('entry.addCoAuthor')}
            rowLabelPrefix={t('entry.coAuthorLabel')}
            rows={form.coAuthors}
            onRowsChange={(rows) => setForm((c) => ({ ...c, coAuthors: rows }))}
            onPersistRow={async (rows) => persistCoAuthorRows(rows)}
            facultyEndpoint="/api/faculty"
            parentLocked={coreFieldDisabled("coAuthors")}
            viewOnly={isViewMode}
            disableEmails={[email]}
            sectionError={errors.coAuthors}
            showSectionError={submitted}
            emptyStateText={t('entry.noCoAuthors')}
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

          <Field label={fieldLabel('externalAuthors')} hint={t('entry.externalAuthorsHint')} fieldKey="externalAuthors">
            <TextInput
              value={form.externalAuthors || ""}
              onChange={(e) => setForm((c) => ({ ...c, externalAuthors: e.target.value }))}
              disabled={coreFieldDisabled("externalAuthors")}
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
          total={2}
          disabled={controlsDisabled}
          animationDelay={240}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <UploadFieldMulti
              key={`${form.id}-firstPage`}
              title={fieldLabel('firstPage')}
              value={form.firstPage}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, firstPage: [...c.firstPage, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, firstPage: c.firstPage.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/conference-publications/file"
              email={email} recordId={form.id} slotName="firstPage"
              showRequiredError={submitAttemptedFinal && form.firstPage.length === 0}
              requiredErrorText={errors.firstPage}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />

            <UploadFieldMulti
              key={`${form.id}-indexProof`}
              title={fieldLabel('indexProof')}
              value={form.indexProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, indexProof: [...c.indexProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, indexProof: c.indexProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/conference-publications/file"
              email={email} recordId={form.id} slotName="indexProof"
              showRequiredError={false}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function ConferencePublicationsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<ConferencePublicationEntry>
      {...props}
      category="conference-publications"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          paperTitle: safeString(e.paperTitle),
          conferenceName: safeString(e.conferenceName),
          level: safeString(e.level),
          organizedBy: safeString(e.organizedBy),
          publicationDate: safeString(e.publicationDate),
          issnIsbn: safeString(e.issnIsbn),
          pageNumbers: safeString(e.pageNumbers),
          doi: safeString(e.doi),
          indexing: safeString(e.indexing),
          coAuthors: ensureFacultyArray(e.coAuthors),
          externalAuthors: safeString(e.externalAuthors),
          firstPage: ensureFileMetaArray(e.firstPage),
          indexProof: ensureFileMetaArray(e.indexProof),
          streak: ensureStreak(e.streak),
        } as ConferencePublicationEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <ConferencePublicationFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.paperTitle || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.conferenceName ? `${entry.conferenceName}${entry.level ? ` — ${entry.level}` : ""}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.publicationDate) parts.push(formatDisplayDate(entry.publicationDate));
        if (entry.organizedBy) parts.push(entry.organizedBy);
        if (entry.indexing) parts.push(entry.indexing);
        if (entry.doi) parts.push(`DOI ${entry.doi}`);
        if (entry.coAuthors.length > 0) {
          parts.push(`${t('fields.coAuthors')}: ${entry.coAuthors.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "First Page", files: entry.firstPage },
              { label: "Index Proof", files: entry.indexProof },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.conferencePublicationsPageTitle')}
      subtitle={t('entry.conferencePublicationsPageSubtitle')}
      formTitle={t('entry.conferencePublicationsFormTitle')}
      formSubtitle={t('entry.conferencePublicationsFormSubtitle')}
      deleteDescription={t('entry.conferencePublicationsDeleteDesc')}
    />
  );
}

export default ConferencePublicationsPage;
