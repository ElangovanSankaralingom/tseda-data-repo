"use client";

import { Banknote, Briefcase, Calendar, FileCheck2, Users, CloudSun, Sun, FlaskConical, Handshake } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import CurrencyField from "@/components/controls/CurrencyField";
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
import { formatCurrency } from "@/lib/i18n/locale";
import { safeString, safeNumber, ensureFileMetaArray, ensureFacultyArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { ResearchFundingEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Research Funding & Consultancy — record flow (S6: data enter alone).
 * `kind` routes to the award metric; `amountInr` picks the tier. Investors
 * fan out copies to listed TCE faculty.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const KIND_OPTIONS = [
  { label: "R&D", value: "R&D", icon: FlaskConical },
  { label: "Consultancy", value: "Consultancy", icon: Handshake },
  { label: "Other", value: "Other", icon: Briefcase },
];

function emptyForm(): ResearchFundingEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    kind: "",
    projectTitle: "",
    agencyOrClient: "",
    amountInr: null,
    sanctionDate: "",
    durationText: "",
    investigators: [],
    externalInvestigators: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    sanctionOrder: [],
    supportingProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as ResearchFundingEntry;
}

function validateFields(form: ResearchFundingEntry): Record<string, string> {
  return validateEntryFields("research-funding", form as unknown as Record<string, unknown>);
}

function ResearchFundingFormFields({ ctx }: { ctx: FormFieldsContext<ResearchFundingEntry> }) {
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

  async function persistInvestigatorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({ ...current, investigators: nextRows }),
      selectResult: (persisted) => persisted.investigators,
    });
  }

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.kind ? 1 : 0) + (form.projectTitle ? 1 : 0) + (form.agencyOrClient ? 1 : 0);
  const group3Complete = (form.amountInr !== null ? 1 : 0) + (form.sanctionDate ? 1 : 0) + (form.durationText ? 1 : 0);
  const group4Complete = (form.investigators.length > 0 ? 1 : 0) + (form.externalInvestigators ? 1 : 0);
  const group5Complete = (form.sanctionOrder.length > 0 ? 1 : 0) + (form.supportingProof.length > 0 ? 1 : 0);

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

      {/* Group 2: Project */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupProject')}
        icon={Briefcase}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("kind") && coreFieldDisabled("projectTitle")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('fundingKind')} error={submitted ? errors.kind : undefined} hint={t('entry.fundingKindHint')} fieldKey="kind">
            <PillSelect
              value={form.kind || ""}
              onChange={(value) => setForm((c) => ({ ...c, kind: value }))}
              options={KIND_OPTIONS}
              disabled={coreFieldDisabled("kind")}
              error={submitted && !!errors.kind}
            />
          </Field>

          <Field label={fieldLabel('projectTitle')} error={submitted ? errors.projectTitle : undefined} fieldKey="projectTitle">
            <TextInput
              value={form.projectTitle || ""}
              onChange={(e) => setForm((c) => ({ ...c, projectTitle: e.target.value }))}
              disabled={coreFieldDisabled("projectTitle")}
              error={submitted && !!errors.projectTitle}
              placeholder={t('placeholder.projectTitle')}
            />
          </Field>

          <Field label={fieldLabel('agencyOrClient')} error={submitted ? errors.agencyOrClient : undefined} fieldKey="agencyOrClient">
            <TextInput
              value={form.agencyOrClient || ""}
              onChange={(e) => setForm((c) => ({ ...c, agencyOrClient: e.target.value }))}
              disabled={coreFieldDisabled("agencyOrClient")}
              error={submitted && !!errors.agencyOrClient}
              placeholder={t('placeholder.agencyOrClient')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 3: Amount & Dates */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupFunding')}
        icon={Banknote}
        accent="#f59e0b"
        filled={group3Complete}
        total={3}
        disabled={coreFieldDisabled("amountInr") && coreFieldDisabled("sanctionDate")}
        animationDelay={120}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('amountInr')} error={submitted ? errors.amountInr : undefined} hint={t('entry.amountTierHint')} fieldKey="amountInr">
            <CurrencyField
              value={form.amountInr === null ? "" : String(form.amountInr)}
              onChange={(value) => setForm((c) => ({ ...c, amountInr: value === "" ? null : Number(value) }))}
              disabled={coreFieldDisabled("amountInr")}
              error={submitted && !!errors.amountInr}
              placeholder="500000"
            />
          </Field>

          <Field label={fieldLabel('sanctionDate')} error={submitted ? errors.sanctionDate : undefined} fieldKey="sanctionDate">
            <DateField
              value={form.sanctionDate}
              onChange={(v) => setForm((c) => ({ ...c, sanctionDate: v }))}
              disabled={coreFieldDisabled("sanctionDate")}
              error={submitted && !!errors.sanctionDate}
            />
          </Field>

          <Field label={fieldLabel('durationText')} fieldKey="durationText">
            <TextInput
              value={form.durationText || ""}
              onChange={(e) => setForm((c) => ({ ...c, durationText: e.target.value }))}
              disabled={coreFieldDisabled("durationText")}
              placeholder={t('placeholder.durationText')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 4: Investigators */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupInvestigators')}
        icon={Users}
        accent="#06b6d4"
        filled={group4Complete}
        total={2}
        disabled={coreFieldDisabled("investigators")}
        animationDelay={180}
      >
        <div className="space-y-4">
          <FacultyPickerRows
            title={t('entry.investigatorTitle')}
            helperText={t('entry.investigatorHint')}
            addLabel={t('entry.addInvestigator')}
            rowLabelPrefix={t('entry.investigatorLabel')}
            rows={form.investigators}
            onRowsChange={(rows) => setForm((c) => ({ ...c, investigators: rows }))}
            onPersistRow={async (rows) => persistInvestigatorRows(rows)}
            facultyEndpoint="/api/faculty"
            parentLocked={coreFieldDisabled("investigators")}
            viewOnly={isViewMode}
            disableEmails={[email]}
            sectionError={errors.investigators}
            showSectionError={submitted}
            emptyStateText={t('entry.noInvestigators')}
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

          <Field label={fieldLabel('externalInvestigators')} hint={t('entry.externalAuthorsHint')} fieldKey="externalInvestigators">
            <TextInput
              value={form.externalInvestigators || ""}
              onChange={(e) => setForm((c) => ({ ...c, externalInvestigators: e.target.value }))}
              disabled={coreFieldDisabled("externalInvestigators")}
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
              key={`${form.id}-sanctionOrder`}
              title={fieldLabel('sanctionOrder')}
              value={form.sanctionOrder}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, sanctionOrder: [...c.sanctionOrder, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, sanctionOrder: c.sanctionOrder.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/research-funding/file"
              email={email} recordId={form.id} slotName="sanctionOrder"
              showRequiredError={submitAttemptedFinal && form.sanctionOrder.length === 0}
              requiredErrorText={errors.sanctionOrder}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />

            <UploadFieldMulti
              key={`${form.id}-supportingProof`}
              title={fieldLabel('supportingProof')}
              value={form.supportingProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, supportingProof: [...c.supportingProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, supportingProof: c.supportingProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/research-funding/file"
              email={email} recordId={form.id} slotName="supportingProof"
              showRequiredError={false}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function ResearchFundingPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<ResearchFundingEntry>
      {...props}
      category="research-funding"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          kind: safeString(e.kind),
          projectTitle: safeString(e.projectTitle),
          agencyOrClient: safeString(e.agencyOrClient),
          amountInr: safeNumber(e.amountInr),
          sanctionDate: safeString(e.sanctionDate),
          durationText: safeString(e.durationText),
          investigators: ensureFacultyArray(e.investigators),
          externalInvestigators: safeString(e.externalInvestigators),
          sanctionOrder: ensureFileMetaArray(e.sanctionOrder),
          supportingProof: ensureFileMetaArray(e.supportingProof),
          streak: ensureStreak(e.streak),
        } as ResearchFundingEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <ResearchFundingFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.projectTitle || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.agencyOrClient ? `${entry.kind ? `${entry.kind} — ` : ""}${entry.agencyOrClient}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (typeof entry.amountInr === "number") parts.push(formatCurrency(entry.amountInr, "en"));
        if (entry.sanctionDate) parts.push(formatDisplayDate(entry.sanctionDate));
        if (entry.durationText) parts.push(entry.durationText);
        if (entry.investigators.length > 0) {
          parts.push(`${t('fields.investigators')}: ${entry.investigators.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Sanction / Work Order", files: entry.sanctionOrder },
              { label: "Receipts", files: entry.supportingProof },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.researchFundingPageTitle')}
      subtitle={t('entry.researchFundingPageSubtitle')}
      formTitle={t('entry.researchFundingFormTitle')}
      formSubtitle={t('entry.researchFundingFormSubtitle')}
      deleteDescription={t('entry.researchFundingDeleteDesc')}
    />
  );
}

export default ResearchFundingPage;
