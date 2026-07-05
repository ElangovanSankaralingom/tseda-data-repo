"use client";

import { Calendar, FileCheck2, Palette, MapPin, CloudSun, Sun } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import TextArea from "@/components/controls/TextArea";
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
import type { StudioContributionEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Studio Contributions — record flow (Elan's S1 ruling): a descriptive box
 * ("what you did") + proof upload per studio event. Open reviews and
 * exhibitions auto-score; documentation / beyond-syllabus entries are the
 * committee's interview evidence base.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const KIND_OPTIONS = [
  { label: "Open Review / Jury", value: "Open Review / Jury" },
  { label: "Exhibition of Student Work", value: "Exhibition of Student Work" },
  { label: "Studio Documentation", value: "Studio Documentation" },
  { label: "Beyond Syllabus", value: "Beyond Syllabus" },
];

function emptyForm(): StudioContributionEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    contributionKind: "",
    activityTitle: "",
    descriptionText: "",
    eventDate: "",
    venue: "",
    externalParticipants: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    proofs: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as StudioContributionEntry;
}

function validateFields(form: StudioContributionEntry): Record<string, string> {
  return validateEntryFields("studio-contributions", form as unknown as Record<string, unknown>);
}

function StudioContributionFormFields({ ctx }: { ctx: FormFieldsContext<StudioContributionEntry> }) {
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
  const group2Complete =
    (form.contributionKind ? 1 : 0) + (form.activityTitle ? 1 : 0) + (form.descriptionText ? 1 : 0) + (form.eventDate ? 1 : 0);
  const group3Complete = (form.venue ? 1 : 0) + (form.externalParticipants ? 1 : 0);
  const group4Complete = form.proofs.length > 0 ? 1 : 0;

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

      {/* Group 2: The contribution — kind, title, THE descriptive box, date */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupStudioContribution')}
        icon={Palette}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={4}
        disabled={coreFieldDisabled("contributionKind") && coreFieldDisabled("activityTitle")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('contributionKind')} error={submitted ? errors.contributionKind : undefined} hint={t('entry.studioKindHint')} fieldKey="contributionKind">
              <SelectDropdown
                value={form.contributionKind || ""}
                onChange={(value) => setForm((c) => ({ ...c, contributionKind: value }))}
                options={KIND_OPTIONS}
                placeholder={t('placeholder.selectStudioKind')}
                disabled={coreFieldDisabled("contributionKind")}
                error={submitted && !!errors.contributionKind}
              />
            </Field>

            <Field label={fieldLabel('eventDate')} error={submitted ? errors.eventDate : undefined} fieldKey="eventDate">
              <DateField
                value={form.eventDate}
                onChange={(v) => setForm((c) => ({ ...c, eventDate: v }))}
                disabled={coreFieldDisabled("eventDate")}
                error={submitted && !!errors.eventDate}
              />
            </Field>
          </div>

          <Field label={fieldLabel('activityTitle')} error={submitted ? errors.activityTitle : undefined} fieldKey="activityTitle">
            <TextInput
              value={form.activityTitle || ""}
              onChange={(e) => setForm((c) => ({ ...c, activityTitle: e.target.value }))}
              disabled={coreFieldDisabled("activityTitle")}
              error={submitted && !!errors.activityTitle}
              placeholder={t('placeholder.studioActivityTitle')}
            />
          </Field>

          <Field label={fieldLabel('descriptionText')} error={submitted ? errors.descriptionText : undefined} hint={t('entry.studioDescriptionHint')} fieldKey="descriptionText">
            <TextArea
              value={form.descriptionText || ""}
              onChange={(e) => setForm((c) => ({ ...c, descriptionText: e.target.value }))}
              disabled={coreFieldDisabled("descriptionText")}
              error={submitted && !!errors.descriptionText}
              placeholder={t('placeholder.studioDescription')}
              rows={4}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 3: Where and with whom */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupVenueExternals')}
        icon={MapPin}
        accent="#f59e0b"
        filled={group3Complete}
        total={2}
        disabled={coreFieldDisabled("venue") && coreFieldDisabled("externalParticipants")}
        animationDelay={120}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={fieldLabel('venue')} fieldKey="venue">
            <TextInput
              value={form.venue || ""}
              onChange={(e) => setForm((c) => ({ ...c, venue: e.target.value }))}
              disabled={coreFieldDisabled("venue")}
              placeholder={t('placeholder.studioVenue')}
            />
          </Field>

          <Field label={fieldLabel('externalParticipants')} hint={t('entry.studioExternalsHint')} fieldKey="externalParticipants">
            <TextInput
              value={form.externalParticipants || ""}
              onChange={(e) => setForm((c) => ({ ...c, externalParticipants: e.target.value }))}
              disabled={coreFieldDisabled("externalParticipants")}
              placeholder={t('placeholder.studioExternals')}
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
              key={`${form.id}-proofs`}
              title={fieldLabel('proofs')}
              value={form.proofs}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, proofs: [...c.proofs, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, proofs: c.proofs.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/studio-contributions/file"
              email={email} recordId={form.id} slotName="proofs"
              showRequiredError={submitAttemptedFinal && form.proofs.length === 0}
              requiredErrorText={errors.proofs}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function StudioContributionsPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<StudioContributionEntry>
      {...props}
      category="studio-contributions"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          contributionKind: safeString(e.contributionKind),
          activityTitle: safeString(e.activityTitle),
          descriptionText: safeString(e.descriptionText),
          eventDate: safeString(e.eventDate),
          venue: safeString(e.venue),
          externalParticipants: safeString(e.externalParticipants),
          proofs: ensureFileMetaArray(e.proofs),
          streak: ensureStreak(e.streak),
        } as StudioContributionEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <StudioContributionFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.activityTitle || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => entry.contributionKind || ""}
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.eventDate) parts.push(formatDisplayDate(entry.eventDate));
        if (entry.venue) parts.push(entry.venue);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Proofs", files: entry.proofs },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.studioContributionsPageTitle')}
      subtitle={t('entry.studioContributionsPageSubtitle')}
      formTitle={t('entry.studioContributionsFormTitle')}
      formSubtitle={t('entry.studioContributionsFormSubtitle')}
      deleteDescription={t('entry.studioContributionsDeleteDesc')}
    />
  );
}

export default StudioContributionsPage;
