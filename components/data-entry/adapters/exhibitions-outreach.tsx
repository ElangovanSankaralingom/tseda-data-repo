"use client";

import { useState } from "react";
import { Calendar, Landmark, Clock, Unlock, CloudSun, Sun, MapPin } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid } from "@/lib/utils/idHelpers";
import { safeString, ensureFileMetaArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { ExhibitionOutreachEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Exhibitions & Outreach — PERMISSION flow (S4 ruling): public-facing
 * events beyond academics need prior approval. public_exhibition scores
 * 2 per event, capped at 4.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const EVENT_KIND_OPTIONS = [
  { label: "Public Exhibition", value: "Public Exhibition" },
  { label: "Community Outreach", value: "Community Outreach" },
];

function emptyForm(): ExhibitionOutreachEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    eventName: "",
    eventKind: "",
    venue: "",
    startDate: "",
    endDate: "",
    externalExperts: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    documentation: [],
    photographs: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as ExhibitionOutreachEntry;
}

function validateFields(form: ExhibitionOutreachEntry): Record<string, string> {
  return validateEntryFields("exhibitions-outreach", form as unknown as Record<string, unknown>);
}

function ExhibitionOutreachFormFields({ ctx }: { ctx: FormFieldsContext<ExhibitionOutreachEntry> }) {
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
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const [, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete = form.permissionLetter.length > 0 && form.documentation.length > 0;

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.eventName ? 1 : 0) + (form.eventKind ? 1 : 0) + (form.venue ? 1 : 0);
  const group3Complete = (form.startDate ? 1 : 0) + (form.endDate ? 1 : 0);
  const group4Complete =
    (form.permissionLetter.length > 0 ? 1 : 0) +
    (form.documentation.length > 0 ? 1 : 0) +
    (form.photographs.length > 0 ? 1 : 0);

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

      {/* Group 2: The event */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupPublicEvent')}
        icon={Landmark}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("eventName") && coreFieldDisabled("eventKind")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('eventName')} error={submitted ? errors.eventName : undefined} fieldKey="eventName">
            <TextInput
              value={form.eventName || ""}
              onChange={(e) => setForm((c) => ({ ...c, eventName: e.target.value }))}
              disabled={coreFieldDisabled("eventName")}
              error={submitted && !!errors.eventName}
              placeholder={t('placeholder.exhibitionEventName')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('eventKind')} error={submitted ? errors.eventKind : undefined} fieldKey="eventKind">
              <PillSelect
                value={form.eventKind || ""}
                onChange={(value) => setForm((c) => ({ ...c, eventKind: value }))}
                options={EVENT_KIND_OPTIONS}
                disabled={coreFieldDisabled("eventKind")}
                error={submitted && !!errors.eventKind}
              />
            </Field>

            <Field label={fieldLabel('venue')} error={submitted ? errors.venue : undefined} fieldKey="venue">
              <TextInput
                value={form.venue || ""}
                onChange={(e) => setForm((c) => ({ ...c, venue: e.target.value }))}
                disabled={coreFieldDisabled("venue")}
                error={submitted && !!errors.venue}
                placeholder={t('placeholder.exhibitionVenue')}
              />
            </Field>
          </div>

          <Field label={fieldLabel('externalExperts')} hint={t('entry.exhibitionExternalsHint')} fieldKey="externalExperts">
            <TextInput
              value={form.externalExperts || ""}
              onChange={(e) => setForm((c) => ({ ...c, externalExperts: e.target.value }))}
              disabled={coreFieldDisabled("externalExperts")}
              placeholder={t('placeholder.exhibitionExternals')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 3: Schedule */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupSchedule')}
        icon={Clock}
        accent="#f59e0b"
        filled={group3Complete}
        total={2}
        disabled={coreFieldDisabled("startDate") && coreFieldDisabled("endDate")}
        animationDelay={120}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('startDate')} error={submitted ? errors.startDate : undefined} fieldKey="startDate">
            <DateField value={form.startDate} onChange={(v) => setForm((c) => ({ ...c, startDate: v }))} disabled={coreFieldDisabled("startDate")} error={submitted && !!errors.startDate} />
          </Field>

          <Field label={fieldLabel('endDate')} error={submitted ? errors.endDate : undefined} fieldKey="endDate">
            <DateField value={form.endDate} onChange={(v) => setForm((c) => ({ ...c, endDate: v }))} disabled={coreFieldDisabled("endDate")} error={submitted && !!errors.endDate} />
          </Field>

          <Field label={t('entry.numberOfDays')} hint={t('entry.inclusiveDayCount')}>
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{inclusiveDays ?? "-"}</div>
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 4: Documents (Stage 2 — unlocked by Generate) */}
      {uploadsVisible && (
        <FormFieldGroup
          step={4}
          title={t('entry.groupDocuments')}
          icon={Unlock}
          accent="#10b981"
          filled={group4Complete}
          total={3}
          disabled={controlsDisabled}
          animationDelay={180}
        >
          <div className="space-y-4">
            <StageTwoDivider />

            <div className="grid gap-4 sm:grid-cols-2">
              <UploadFieldMulti
                key={`${form.id}-permissionLetter`}
                title={fieldLabel('permissionLetter')}
                value={form.permissionLetter}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, permissionLetter: [...c.permissionLetter, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, permissionLetter: c.permissionLetter.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/exhibitions-outreach/file"
                email={email} recordId={form.id} slotName="permissionLetter"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.permissionLetter}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-documentation`}
                title={fieldLabel('documentation')}
                value={form.documentation}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, documentation: [...c.documentation, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, documentation: c.documentation.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/exhibitions-outreach/file"
                email={email} recordId={form.id} slotName="documentation"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.documentation}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-photographs`}
                title={fieldLabel('photographs')}
                value={form.photographs}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, photographs: [...c.photographs, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, photographs: c.photographs.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/exhibitions-outreach/file"
                email={email} recordId={form.id} slotName="photographs"
                showRequiredError={false}
                onStatusChange={setPhotoUploadStatus} disabled={controlsDisabled} viewOnly={isViewMode}
              />
            </div>
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function ExhibitionsOutreachPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<ExhibitionOutreachEntry>
      {...props}
      category="exhibitions-outreach"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          eventName: safeString(e.eventName),
          eventKind: safeString(e.eventKind),
          venue: safeString(e.venue),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          externalExperts: safeString(e.externalExperts),
          permissionLetter: ensureFileMetaArray(e.permissionLetter),
          documentation: ensureFileMetaArray(e.documentation),
          photographs: ensureFileMetaArray(e.photographs),
          streak: ensureStreak(e.streak),
        } as ExhibitionOutreachEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <ExhibitionOutreachFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.eventName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => entry.eventKind || ""}
      renderListEntryBody={({ entry, group }) => {
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        if (entry.venue) parts.push(entry.venue);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Documentation", files: entry.documentation },
              { label: "Photographs", files: entry.photographs },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.exhibitionsOutreachPageTitle')}
      subtitle={t('entry.exhibitionsOutreachPageSubtitle')}
      formTitle={t('entry.exhibitionsOutreachFormTitle')}
      formSubtitle={t('entry.exhibitionsOutreachFormSubtitle')}
      deleteDescription={t('entry.exhibitionsOutreachDeleteDesc')}
    />
  );
}

export default ExhibitionsOutreachPage;
