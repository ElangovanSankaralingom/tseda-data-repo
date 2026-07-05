"use client";

import { useState } from "react";
import { Calendar, CalendarDays, Clock, Users, Unlock, Flag, Globe, CloudSun, Sun, Crown, UserCog, User } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import TextInput from "@/components/controls/TextInput";
import Field from "@/components/data-entry/Field";
import DateField from "@/components/controls/DateField";
import UploadFieldMulti from "@/components/entry/UploadFieldMulti";
import SelectDropdown from "@/components/controls/SelectDropdown";
import PillSelect from "@/components/controls/PillSelect";
import FacultyPickerRows, { type FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import BaseEntryAdapter, { type FormFieldsContext } from "@/components/data-entry/adapters/BaseEntryAdapter";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { safeString, safeNumber, ensureFileMetaArray, ensureFacultyArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { ConferenceOrganizedEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Conferences Organized — PERMISSION flow (prior approval): generate the
 * permission letter, run the event, upload proofs, finalise. Role drives
 * the 50/30/20 award share; each fanned-out team member sets their own role.
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const LEVEL_OPTIONS = [
  { label: "National", value: "National", icon: Flag },
  { label: "International", value: "International", icon: Globe },
];

const ROLE_OPTIONS = [
  { label: "Coordinator", value: "Coordinator", icon: Crown },
  { label: "Co-Coordinator", value: "Co-Coordinator", icon: UserCog },
  { label: "Committee Member", value: "Committee Member", icon: User },
];

function emptyForm(): ConferenceOrganizedEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    conferenceTitle: "",
    level: "",
    role: "",
    startDate: "",
    endDate: "",
    collaboratingBodies: "",
    organizingTeam: [],
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    eventReport: [],
    committeeProof: [],
    photographs: [],
    numberOfDelegates: null,
    papersPresented: null,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as ConferenceOrganizedEntry;
}

function validateFields(form: ConferenceOrganizedEntry): Record<string, string> {
  return validateEntryFields("conferences-organized", form as unknown as Record<string, unknown>);
}

function ConferenceOrganizedFormFields({ ctx }: { ctx: FormFieldsContext<ConferenceOrganizedEntry> }) {
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

  const requiredUploadsComplete =
    form.permissionLetter.length > 0 && form.eventReport.length > 0 && form.committeeProof.length > 0;

  async function persistTeamRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({ ...current, organizingTeam: nextRows }),
      selectResult: (persisted) => persisted.organizingTeam,
    });
  }

  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.conferenceTitle ? 1 : 0) + (form.level ? 1 : 0) + (form.role ? 1 : 0);
  const group3Complete = (form.startDate ? 1 : 0) + (form.endDate ? 1 : 0);
  const group4Complete = (form.organizingTeam.length > 0 ? 1 : 0) + (form.collaboratingBodies ? 1 : 0);
  const group5Complete =
    (form.permissionLetter.length > 0 ? 1 : 0) +
    (form.eventReport.length > 0 ? 1 : 0) +
    (form.committeeProof.length > 0 ? 1 : 0) +
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

      {/* Group 2: Conference & Role */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupConference')}
        icon={CalendarDays}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={3}
        disabled={coreFieldDisabled("conferenceTitle") && coreFieldDisabled("level") && coreFieldDisabled("role")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('conferenceTitle')} error={submitted ? errors.conferenceTitle : undefined} fieldKey="conferenceTitle">
            <TextInput
              value={form.conferenceTitle || ""}
              onChange={(e) => setForm((c) => ({ ...c, conferenceTitle: e.target.value }))}
              disabled={coreFieldDisabled("conferenceTitle")}
              error={submitted && !!errors.conferenceTitle}
              placeholder={t('placeholder.conferenceTitle')}
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

            <Field label={fieldLabel('role')} error={submitted ? errors.role : undefined} hint={t('entry.roleShareHint')} fieldKey="role">
              <SelectDropdown
                value={form.role || ""}
                onChange={(value) => setForm((c) => ({ ...c, role: value }))}
                options={ROLE_OPTIONS.map(({ label, value }) => ({ label, value }))}
                placeholder={t('placeholder.selectRole')}
                disabled={coreFieldDisabled("role")}
                error={submitted && !!errors.role}
              />
            </Field>
          </div>
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

      {/* Group 4: Team & Collaboration */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupCoordination')}
        icon={Users}
        accent="#06b6d4"
        filled={group4Complete}
        total={2}
        disabled={coreFieldDisabled("organizingTeam")}
        animationDelay={180}
      >
        <div className="space-y-4">
          <FacultyPickerRows
            title={t('entry.organizingTeamTitle')}
            helperText={t('entry.organizingTeamHint')}
            addLabel={t('entry.addTeamMember')}
            rowLabelPrefix={t('entry.teamMemberLabel')}
            rows={form.organizingTeam}
            onRowsChange={(rows) => setForm((c) => ({ ...c, organizingTeam: rows }))}
            onPersistRow={async (rows) => persistTeamRows(rows)}
            facultyEndpoint="/api/faculty"
            parentLocked={coreFieldDisabled("organizingTeam")}
            viewOnly={isViewMode}
            disableEmails={[email]}
            sectionError={errors.organizingTeam}
            showSectionError={submitted}
            emptyStateText={t('entry.noTeamMembers')}
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

          <Field label={fieldLabel('collaboratingBodies')} fieldKey="collaboratingBodies">
            <TextInput
              value={form.collaboratingBodies || ""}
              onChange={(e) => setForm((c) => ({ ...c, collaboratingBodies: e.target.value }))}
              disabled={coreFieldDisabled("collaboratingBodies")}
              placeholder={t('placeholder.collaboratingBodies')}
            />
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 5: Documents (Stage 2 — unlocked by Generate) */}
      {uploadsVisible && (
        <FormFieldGroup
          step={5}
          title={t('entry.groupDocuments')}
          icon={Unlock}
          accent="#10b981"
          filled={group5Complete}
          total={4}
          disabled={controlsDisabled}
          animationDelay={240}
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
                uploadEndpoint="/api/me/conferences-organized/file"
                email={email} recordId={form.id} slotName="permissionLetter"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.permissionLetter}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-eventReport`}
                title={fieldLabel('eventReport')}
                value={form.eventReport}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, eventReport: [...c.eventReport, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, eventReport: c.eventReport.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/conferences-organized/file"
                email={email} recordId={form.id} slotName="eventReport"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.eventReport}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-committeeProof`}
                title={fieldLabel('committeeProof')}
                value={form.committeeProof}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, committeeProof: [...c.committeeProof, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, committeeProof: c.committeeProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/conferences-organized/file"
                email={email} recordId={form.id} slotName="committeeProof"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.committeeProof}
                onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-photographs`}
                title={fieldLabel('photographs')}
                value={form.photographs}
                onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, photographs: [...c.photographs, meta] }) }); }}
                onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, photographs: c.photographs.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
                uploadEndpoint="/api/me/conferences-organized/file"
                email={email} recordId={form.id} slotName="photographs"
                showRequiredError={false}
                onStatusChange={setPhotoUploadStatus} disabled={controlsDisabled} viewOnly={isViewMode}
              />

              <Field label={fieldLabel('numberOfDelegates')} fieldKey="numberOfDelegates">
                <TextInput
                  type="number"
                  min="0"
                  value={form.numberOfDelegates === null ? "" : String(form.numberOfDelegates)}
                  onChange={(e) => setForm((c) => ({ ...c, numberOfDelegates: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  placeholder={t('placeholder.numberOfParticipants')}
                />
              </Field>

              <Field label={fieldLabel('papersPresented')} fieldKey="papersPresented">
                <TextInput
                  type="number"
                  min="0"
                  value={form.papersPresented === null ? "" : String(form.papersPresented)}
                  onChange={(e) => setForm((c) => ({ ...c, papersPresented: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  placeholder={t('placeholder.papersPresented')}
                />
              </Field>
            </div>
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function ConferencesOrganizedPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<ConferenceOrganizedEntry>
      {...props}
      category="conferences-organized"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          conferenceTitle: safeString(e.conferenceTitle),
          level: safeString(e.level),
          role: safeString(e.role),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          collaboratingBodies: safeString(e.collaboratingBodies),
          organizingTeam: ensureFacultyArray(e.organizingTeam),
          numberOfDelegates: safeNumber(e.numberOfDelegates),
          papersPresented: safeNumber(e.papersPresented),
          permissionLetter: ensureFileMetaArray(e.permissionLetter),
          eventReport: ensureFileMetaArray(e.eventReport),
          committeeProof: ensureFileMetaArray(e.committeeProof),
          photographs: ensureFileMetaArray(e.photographs),
          streak: ensureStreak(e.streak),
        } as ConferenceOrganizedEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <ConferenceOrganizedFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.conferenceTitle || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.role ? `${entry.role}${entry.level ? ` — ${entry.level}` : ""}` : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        if (days) parts.push(`${days} ${t('timer.days')}`);
        if (typeof entry.numberOfDelegates === "number") parts.push(`${entry.numberOfDelegates} ${t('entry.participants')}`);
        if (entry.organizingTeam.length > 0) {
          parts.push(`${t('fields.organizingTeam')}: ${entry.organizingTeam.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Event Report", files: entry.eventReport },
              { label: "Committee Proof", files: entry.committeeProof },
              { label: "Photographs", files: entry.photographs },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.conferencesOrganizedPageTitle')}
      subtitle={t('entry.conferencesOrganizedPageSubtitle')}
      formTitle={t('entry.conferencesOrganizedFormTitle')}
      formSubtitle={t('entry.conferencesOrganizedFormSubtitle')}
      deleteDescription={t('entry.conferencesOrganizedDeleteDesc')}
    />
  );
}

export default ConferencesOrganizedPage;
