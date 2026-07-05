"use client";

import { useState } from "react";
import { Flag, Globe, Monitor, Building2, CloudSun, Sun, Banknote, BanknoteX, Calendar, BookOpen, Clock, UserCircle, Users, Unlock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { t as staticT } from "@/lib/i18n";
import TextInput from "@/components/controls/TextInput";
import CurrencyField from "@/components/controls/CurrencyField";
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
import { formatCurrency } from "@/lib/i18n/locale";
import { safeString, safeNumber, safeBoolString, ensureFileMetaArray, ensureFacultyArray, ensureStreak } from "@/lib/entries/hydrateEntry";
import type { GuestLectureEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const LEVEL_OPTIONS = [
  { label: "National", value: "National", icon: Flag },
  { label: "International", value: "International", icon: Globe },
];

const MODE_OPTIONS = [
  { label: "Online", value: "Online", icon: Monitor },
  { label: "Offline", value: "Offline", icon: Building2 },
];

const SPONSORED_OPTIONS = [
  { label: "Yes", value: "Yes", icon: Banknote },
  { label: "No", value: "No", icon: BanknoteX },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AFFILIATION_OPTIONS = [
  { label: "Industry", value: "Industry" },
  { label: "Academic", value: "Academic" },
];

function emptyForm(): GuestLectureEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    level: "",
    mode: "",
    startDate: "",
    endDate: "",
    topicOfLecture: "",
    guestSpeakerName: "",
    speakerAffiliationType: "",
    guestSpeakerDesignation: "",
    guestSpeakerOrganisation: "",
    coordinatorName: "",
    coordinatorEmail: "",
    coCoordinators: [],
    sponsored: "",
    fundingAgency: "",
    fundingAmount: null,
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    permissionLetter: [],
    geotaggedPhotos: [],
    attendanceSheet: [],
    officialPoster: [],
    numberOfParticipants: null,
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as GuestLectureEntry;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: GuestLectureEntry): Record<string, string> {
  const errors = validateEntryFields("guest-lectures", form as unknown as Record<string, unknown>);

  // Category-specific: duplicate co-coordinator emails
  const emailCounts = new Map<string, number>();
  const selectedEmails = [form.coordinatorEmail, ...form.coCoordinators.map((v) => v.email)]
    .map((v) => (v || "").trim().toLowerCase())
    .filter(Boolean);
  for (const selectedEmail of selectedEmails) {
    emailCounts.set(selectedEmail, (emailCounts.get(selectedEmail) ?? 0) + 1);
  }
  form.coCoordinators.forEach((value, index) => {
    if (value.email && (emailCounts.get(value.email.toLowerCase()) ?? 0) > 1) {
      errors[`coCoordinators.${index}`] = staticT('entry.facultyAlreadySelected', 'en');
    }
  });

  if (form.sponsored === "Yes") {
    if (!form.fundingAgency?.trim()) errors.fundingAgency = staticT('entry.fundingAgencyRequired', 'en');
    if (form.fundingAmount === null || form.fundingAmount === undefined) errors.fundingAmount = staticT('entry.fundingAmountRequired', 'en');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function GuestLectureFormFields({ ctx }: { ctx: FormFieldsContext<GuestLectureEntry> }) {
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
    userDisplayName,
  } = ctx;

  const { t, fieldLabel } = useTranslation();
  const inclusiveDays = getInclusiveDays(form.startDate, form.endDate);
  const [, setPhotoUploadStatus] = useState({ hasPending: false, busy: false });

  const requiredUploadsComplete = form.permissionLetter.length > 0 && form.geotaggedPhotos.length > 0 && form.attendanceSheet.length > 0;

  async function persistCoCoordinatorRows(nextRows: FacultyRowValue[]) {
    return persistCurrentMutation({
      buildNextEntry: (current) => ({
        ...current,
        coordinatorName: userDisplayName || current.coordinatorName,
        coordinatorEmail: email || current.coordinatorEmail,
        coCoordinators: nextRows,
      }),
      selectResult: (persisted) => persisted.coCoordinators,
    });
  }

  // Count completion per group (filled/total)
  const group1Filled = [form.academicYear, form.semesterType].filter(Boolean).length;
  const group1Total = 2;

  const group2Filled = [form.topicOfLecture, form.level, form.mode].filter(Boolean).length;
  const group2Total = 3;

  const group3Filled = [form.startDate, form.endDate].filter(Boolean).length;
  const group3Total = 3; // includes numberOfDays display field

  const group4Filled = [form.guestSpeakerName, form.guestSpeakerDesignation, form.guestSpeakerOrganisation].filter(Boolean).length;
  const group4Total = 3;

  const group5Filled = [form.coordinatorEmail, ...form.coCoordinators.filter((c) => c.email)].length;
  const group5Total = 1 + form.coCoordinators.length; // at least coordinator, plus co-coordinators

  const group6Filled = [form.sponsored, ...(form.sponsored === "Yes" ? [form.fundingAgency, form.fundingAmount !== null ? "1" : ""] : [])].filter(Boolean).length;
  const group6Total = form.sponsored === "Yes" ? 3 : 1;

  const group7Filled = [
    form.permissionLetter.length > 0 ? "1" : "",
    form.geotaggedPhotos.length > 0 ? "1" : "",
    form.attendanceSheet.length > 0 ? "1" : "",
    form.numberOfParticipants !== null ? "1" : "",
    form.officialPoster.length > 0 ? "1" : "",
  ].filter(Boolean).length;
  const group7Total = 5;

  return (
    <div className="space-y-4">
      {/* Group 1: Academic Period */}
      <FormFieldGroup
        step={1}
        title={t('entry.groupAcademicPeriod')}
        icon={Calendar}
        accent="#60a5fa"
        filled={group1Filled}
        total={group1Total}
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

      {/* Group 2: Lecture Details */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupProgramDetails')}
        icon={BookOpen}
        accent="var(--color-primary)"
        filled={group2Filled}
        total={group2Total}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('topicOfLecture')} error={submitted ? errors.topicOfLecture : undefined} fieldKey="topicOfLecture">
            <TextInput
              value={form.topicOfLecture || ""}
              onChange={(e) => setForm((c) => ({ ...c, topicOfLecture: e.target.value }))}
              disabled={coreFieldDisabled("topicOfLecture")}
              error={submitted && !!errors.topicOfLecture}
              placeholder={t('placeholder.topicOfLecture')}
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

            <Field label={fieldLabel('mode')} error={submitted ? errors.mode : undefined} fieldKey="mode">
              <PillSelect
                value={form.mode || ""}
                onChange={(value) => setForm((c) => ({ ...c, mode: value }))}
                options={MODE_OPTIONS}
                disabled={coreFieldDisabled("mode")}
                error={submitted && !!errors.mode}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 3: Schedule */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupSchedule')}
        subtitle={t('entry.groupScheduleHint')}
        icon={Clock}
        accent="#f59e0b"
        filled={group3Filled}
        total={group3Total}
        animationDelay={120}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={fieldLabel('startDate')} error={submitted ? errors.startDate : undefined} fieldKey="startDate">
            <DateField
              value={form.startDate}
              onChange={(v) => setForm((c) => ({ ...c, startDate: v }))}
              disabled={coreFieldDisabled("startDate")}
              error={submitted && !!errors.startDate}
            />
          </Field>

          <Field label={fieldLabel('endDate')} error={submitted ? errors.endDate : undefined} hint={inclusiveDays ? `Days: ${inclusiveDays}` : undefined} fieldKey="endDate">
            <DateField
              value={form.endDate}
              onChange={(v) => setForm((c) => ({ ...c, endDate: v }))}
              disabled={coreFieldDisabled("endDate")}
              error={submitted && !!errors.endDate}
            />
          </Field>

          <Field label={t('entry.numberOfDays')} hint={t('entry.inclusiveDayCount')}>
            <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">{inclusiveDays ?? "-"}</div>
          </Field>
        </div>
      </FormFieldGroup>

      {/* Group 4: Speaker Details */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupSpeakerDetails')}
        icon={UserCircle}
        accent="#f472b6"
        filled={group4Filled}
        total={group4Total}
        animationDelay={180}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('guestSpeakerName')} error={submitted ? errors.guestSpeakerName : undefined} fieldKey="guestSpeakerName">
            <TextInput
              value={form.guestSpeakerName || ""}
              onChange={(e) => setForm((c) => ({ ...c, guestSpeakerName: e.target.value }))}
              disabled={coreFieldDisabled("guestSpeakerName")}
              error={submitted && !!errors.guestSpeakerName}
              placeholder={t('placeholder.guestSpeakerName')}
            />
          </Field>

          <Field label={fieldLabel('speakerAffiliationType')} hint={t('entry.speakerAffiliationHint')} fieldKey="speakerAffiliationType">
            <PillSelect
              value={form.speakerAffiliationType || ""}
              onChange={(value) => setForm((c) => ({ ...c, speakerAffiliationType: value }))}
              options={AFFILIATION_OPTIONS}
              disabled={coreFieldDisabled("speakerAffiliationType")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('guestSpeakerDesignation')} error={submitted ? errors.guestSpeakerDesignation : undefined} fieldKey="guestSpeakerDesignation">
              <TextInput
                value={form.guestSpeakerDesignation || ""}
                onChange={(e) => setForm((c) => ({ ...c, guestSpeakerDesignation: e.target.value }))}
                disabled={coreFieldDisabled("guestSpeakerDesignation")}
                error={submitted && !!errors.guestSpeakerDesignation}
                placeholder={t('placeholder.guestSpeakerDesignation')}
              />
            </Field>

            <Field label={fieldLabel('guestSpeakerOrganisation')} error={submitted ? errors.guestSpeakerOrganisation : undefined} fieldKey="guestSpeakerOrganisation">
              <TextInput
                value={form.guestSpeakerOrganisation || ""}
                onChange={(e) => setForm((c) => ({ ...c, guestSpeakerOrganisation: e.target.value }))}
                disabled={coreFieldDisabled("guestSpeakerOrganisation")}
                error={submitted && !!errors.guestSpeakerOrganisation}
                placeholder={t('placeholder.guestSpeakerOrganisation')}
              />
            </Field>
          </div>
        </div>
      </FormFieldGroup>

      {/* Group 5: Coordination */}
      <FormFieldGroup
        step={5}
        title={t('entry.groupCoordination')}
        icon={Users}
        accent="#06b6d4"
        filled={group5Filled}
        total={group5Total}
        animationDelay={240}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-body-bg)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            {t('entry.coordinator')} <span className="font-medium text-[var(--color-text-primary)]">{userDisplayName || "-"}</span>
          </div>

          <FacultyPickerRows
            title={t('entry.coCoordinatorTitle')}
            helperText={t('entry.coCoordinatorHint')}
            addLabel={t('entry.addCoCoordinator')}
            rowLabelPrefix={t('entry.coCoordinatorLabel')}
            rows={form.coCoordinators}
            onRowsChange={(rows) => setForm((c) => ({ ...c, coCoordinators: rows }))}
            onPersistRow={async (rows) => persistCoCoordinatorRows(rows)}
            facultyEndpoint="/api/faculty"
            parentLocked={coreFieldDisabled("coCoordinators")}
            viewOnly={isViewMode}
            disableEmails={[form.coordinatorEmail || email]}
            sectionError={errors.coCoordinators}
            showSectionError={submitted}
            emptyStateText={t('entry.noCoCoordinators')}
            validateRow={(rows, row, index) => {
              if (!row.email) return t('entry.selectFaculty');
              const coordEmail = form.coordinatorEmail || email;
              if (row.email.trim().toLowerCase() === coordEmail.trim().toLowerCase()) {
                return t('entry.facultyAlreadySelected');
              }
              const duplicates = rows.filter(
                (item, itemIndex) =>
                  itemIndex !== index && item.email.trim().toLowerCase() === row.email.trim().toLowerCase()
              ).length;
              return duplicates > 0 ? t('entry.facultyAlreadySelected') : null;
            }}
          />
        </div>
      </FormFieldGroup>

      {/* Group 6: Funding */}
      <FormFieldGroup
        step={6}
        title={t('entry.groupFunding')}
        icon={Banknote}
        accent="#a78bfa"
        filled={group6Filled}
        total={group6Total}
        animationDelay={300}
      >
        <Field label={fieldLabel('sponsored')} error={submitted ? errors.sponsored : undefined} fieldKey="sponsored">
          <PillSelect
            value={form.sponsored || ""}
            onChange={(value) => setForm((c) => ({ ...c, sponsored: value, ...(value !== "Yes" ? { fundingAgency: "", fundingAmount: null } : {}) }))}
            options={SPONSORED_OPTIONS}
            accent="#a78bfa"
            disabled={coreFieldDisabled("sponsored")}
            error={submitted && !!errors.sponsored}
          />
        </Field>

        {form.sponsored === "Yes" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('fundingAgency')} error={submitted ? errors.fundingAgency : undefined} fieldKey="fundingAgency">
              <TextInput
                value={form.fundingAgency || ""}
                onChange={(e) => setForm((c) => ({ ...c, fundingAgency: e.target.value }))}
                disabled={coreFieldDisabled("fundingAgency")}
                error={submitted && !!errors.fundingAgency}
                placeholder={t('placeholder.fundingAgency')}
              />
            </Field>

            <Field label={fieldLabel('fundingAmount')} error={submitted ? errors.fundingAmount : undefined} hint={t('entry.numbersOnly')} fieldKey="fundingAmount">
              <CurrencyField
                value={form.fundingAmount === null ? "" : String(form.fundingAmount)}
                onChange={(value) => setForm((c) => ({ ...c, fundingAmount: value === "" ? null : Number(value) }))}
                disabled={coreFieldDisabled("fundingAmount")}
                error={submitted && !!errors.fundingAmount}
                placeholder="50000"
              />
            </Field>
          </div>
        )}
      </FormFieldGroup>

      {/* Group 7: Stage 2 — Documents */}
      {uploadsVisible ? (
        <FormFieldGroup
          step={7}
          title={t('entry.groupDocuments')}
          subtitle={t('entry.groupDocumentsHint')}
          icon={Unlock}
          accent="#10b981"
          filled={group7Filled}
          total={group7Total}
          animationDelay={0}
        >
          <div className="space-y-4">
            <StageTwoDivider />

            <div className="grid gap-4 sm:grid-cols-2">
              <UploadFieldMulti
                key={`${form.id}-permissionLetter`}
                title={fieldLabel('permissionLetter')}
                value={form.permissionLetter}
                onUploaded={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      permissionLetter: [...current.permissionLetter, meta],
                    }),
                  });
                }}
                onDeleted={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      permissionLetter: current.permissionLetter.filter(
                        (item) => item.storedPath !== meta.storedPath
                      ),
                    }),
                  });
                }}
                uploadEndpoint="/api/me/guest-lectures/file"
                email={email}
                recordId={form.id}
                slotName="permissionLetter"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.permissionLetter}
                onStatusChange={() => {}}
                disabled={controlsDisabled}
                viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-geotaggedPhotos`}
                title={fieldLabel('geotaggedPhotos')}
                value={form.geotaggedPhotos}
                onUploaded={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      geotaggedPhotos: [...current.geotaggedPhotos, meta],
                    }),
                  });
                }}
                onDeleted={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      geotaggedPhotos: current.geotaggedPhotos.filter(
                        (item) => item.storedPath !== meta.storedPath
                      ),
                    }),
                  });
                }}
                uploadEndpoint="/api/me/guest-lectures/file"
                email={email}
                recordId={form.id}
                slotName="geotaggedPhotos"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.geotaggedPhotos}
                onStatusChange={setPhotoUploadStatus}
                disabled={controlsDisabled}
                viewOnly={isViewMode}
              />

              <UploadFieldMulti
                key={`${form.id}-attendanceSheet`}
                title={fieldLabel('attendanceSheet')}
                value={form.attendanceSheet}
                onUploaded={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      attendanceSheet: [...current.attendanceSheet, meta],
                    }),
                  });
                }}
                onDeleted={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      attendanceSheet: current.attendanceSheet.filter(
                        (item) => item.storedPath !== meta.storedPath
                      ),
                    }),
                  });
                }}
                uploadEndpoint="/api/me/guest-lectures/file"
                email={email}
                recordId={form.id}
                slotName="attendanceSheet"
                showRequiredError={submitAttemptedFinal && !requiredUploadsComplete}
                requiredErrorText={errors.attendanceSheet}
                onStatusChange={() => {}}
                disabled={controlsDisabled}
                viewOnly={isViewMode}
              />

              <Field label={fieldLabel('numberOfParticipants')} fieldKey="numberOfParticipants">
                <TextInput
                  type="number"
                  min="0"
                  value={form.numberOfParticipants === null ? "" : String(form.numberOfParticipants)}
                  onChange={(e) => setForm((c) => ({ ...c, numberOfParticipants: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  placeholder={t('placeholder.numberOfParticipants')}
                />
              </Field>

              <UploadFieldMulti
                key={`${form.id}-officialPoster`}
                title={fieldLabel('officialPoster')}
                value={form.officialPoster}
                onUploaded={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      officialPoster: [...current.officialPoster, meta],
                    }),
                  });
                }}
                onDeleted={async (meta) => {
                  await persistCurrentMutation({
                    buildNextEntry: (current) => ({
                      ...current,
                      officialPoster: current.officialPoster.filter(
                        (item) => item.storedPath !== meta.storedPath
                      ),
                    }),
                  });
                }}
                uploadEndpoint="/api/me/guest-lectures/file"
                email={email}
                recordId={form.id}
                slotName="officialPoster"
                showRequiredError={false}
                requiredErrorText={errors.officialPoster}
                onStatusChange={() => {}}
                disabled={controlsDisabled}
                viewOnly={isViewMode}
              />
            </div>
          </div>
        </FormFieldGroup>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function GuestLecturesPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<GuestLectureEntry>
      {...props}
      category="guest-lectures"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        const uploads = e.uploads as Record<string, unknown> | undefined;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          level: safeString(e.level),
          mode: safeString(e.mode),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          topicOfLecture: safeString(e.topicOfLecture) || safeString(e.eventName),
          guestSpeakerName: safeString(e.guestSpeakerName) || safeString(e.speakerName),
          speakerAffiliationType: safeString(e.speakerAffiliationType),
          guestSpeakerDesignation: safeString(e.guestSpeakerDesignation),
          guestSpeakerOrganisation: safeString(e.guestSpeakerOrganisation) || safeString(e.organizationName),
          coordinatorName: safeString(e.coordinatorName),
          coordinatorEmail: safeString(e.coordinatorEmail),
          coCoordinators: ensureFacultyArray(e.coCoordinators),
          sponsored: safeBoolString(e.sponsored),
          fundingAgency: safeString(e.fundingAgency),
          fundingAmount: safeNumber(e.fundingAmount),
          numberOfParticipants: safeNumber(e.numberOfParticipants) ?? safeNumber(e.participants),
          permissionLetter: ensureFileMetaArray(e.permissionLetter).length > 0 ? ensureFileMetaArray(e.permissionLetter) : ensureFileMetaArray(uploads?.permissionLetter),
          geotaggedPhotos: ensureFileMetaArray(e.geotaggedPhotos).length > 0 ? ensureFileMetaArray(e.geotaggedPhotos) : ensureFileMetaArray(uploads?.geotaggedPhotos),
          attendanceSheet: ensureFileMetaArray(e.attendanceSheet).length > 0 ? ensureFileMetaArray(e.attendanceSheet) : ensureFileMetaArray(uploads?.attendance),
          officialPoster: ensureFileMetaArray(e.officialPoster),
          streak: ensureStreak(e.streak),
        } as GuestLectureEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <GuestLectureFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.topicOfLecture || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) =>
        entry.guestSpeakerName
          ? `${t('entry.speaker')} ${entry.guestSpeakerName}${entry.guestSpeakerOrganisation ? ` — ${entry.guestSpeakerOrganisation}` : ""}`
          : ""
      }
      renderListEntryBody={({ entry, group }) => {
        const days = getInclusiveDays(entry.startDate, entry.endDate);
        const startStr = formatDisplayDate(entry.startDate);
        const endStr = formatDisplayDate(entry.endDate);
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.level) parts.push(entry.level);
        if (entry.mode) parts.push(entry.mode);
        if (startStr !== "-" && endStr !== "-") parts.push(`${startStr} – ${endStr}`);
        else if (startStr !== "-") parts.push(startStr);
        if (days) parts.push(`${days} ${t('timer.days')}`);
        if (entry.sponsored === "Yes" && entry.fundingAgency) {
          const fundingStr = entry.fundingAmount ? `${entry.fundingAgency} (${formatCurrency(entry.fundingAmount, "en")})` : entry.fundingAgency;
          parts.push(`${t('entry.fundedBy')} ${fundingStr}`);
        }
        if (typeof entry.numberOfParticipants === "number") parts.push(`${entry.numberOfParticipants} ${t('entry.participants')}`);
        if (entry.coCoordinators.length > 0) {
          parts.push(`${t('fields.coCoordinators')}: ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Permission Letter", files: entry.permissionLetter },
              { label: "Geotagged Photo", files: entry.geotaggedPhotos },
              { label: "Attendance Sheet", files: entry.attendanceSheet },
              { label: "Official Poster", files: entry.officialPoster },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.guestLecturesPageTitle')}
      subtitle={t('entry.guestLecturesPageSubtitle')}
      formTitle={t('entry.guestLecturesFormTitle')}
      formSubtitle={t('entry.guestLecturesFormSubtitle')}
      deleteDescription={t('entry.guestLecturesDeleteDesc')}
    />
  );
}

export default GuestLecturesPage;
