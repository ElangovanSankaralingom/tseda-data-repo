"use client";

import { useState } from "react";
import { Flag, Globe, Monitor, Building2, CloudSun, Sun, Banknote, BanknoteX, Calendar, BookOpen, Clock, Users, Unlock } from "lucide-react";
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
import FormFieldGroup from "@/components/data-entry/FormFieldGroup";
import StageTwoDivider from "@/components/data-entry/StageTwoDivider";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/lib/utils/academicYear";
import { getInclusiveDays, formatDisplayDate } from "@/lib/utils/dateHelpers";
import { MetadataPills, AttachmentBadges } from "@/components/data-entry/EntryMetadataDisplay";
import { uuid, formatFacultyDisplay } from "@/lib/utils/idHelpers";
import { formatCurrency } from "@/lib/i18n/locale";
import type { FdpConducted } from "@/components/data-entry/adapters/adapterTypes";
import { safeString, safeNumber, safeBoolString, ensureFileMetaArray, ensureFacultyArray, ensureStreak } from "@/lib/entries/hydrateEntry";
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

function emptyForm(): FdpConducted {
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
    programName: "",
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
    numberOfParticipants: null,
    outsideParticipants: null,
    officialPoster: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as FdpConducted;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateFields(form: FdpConducted): Record<string, string> {
  const errors = validateEntryFields("fdp-conducted", form as unknown as Record<string, unknown>);

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

  return errors;
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function FdpConductedFormFields({ ctx }: { ctx: FormFieldsContext<FdpConducted> }) {
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

  // Per-group completion counts
  const g1Filled = [form.academicYear, form.semesterType].filter(Boolean).length;
  const g2Filled = [form.programName, form.level, form.mode].filter(Boolean).length;
  const g3Filled = [form.startDate, form.endDate].filter(Boolean).length;
  const g4Filled = (form.coordinatorName || form.coordinatorEmail) ? 1 : 0;
  const g5Filled = [form.sponsored].filter(Boolean).length
    + (form.sponsored === "Yes" ? [form.fundingAgency].filter(Boolean).length + (form.fundingAmount !== null && form.fundingAmount !== undefined ? 1 : 0) : 0);
  const g5Total = form.sponsored === "Yes" ? 3 : 1;
  const g6Filled = (form.permissionLetter?.length > 0 ? 1 : 0) + (form.geotaggedPhotos?.length > 0 ? 1 : 0) + (form.attendanceSheet?.length > 0 ? 1 : 0);

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

  return (
    <div className="space-y-4">
      {/* ── Group 1: Academic Period ── */}
      <FormFieldGroup
        step={1}
        title={t('entry.groupAcademicPeriod')}
        subtitle={t('entry.groupAcademicPeriodHint')}
        icon={Calendar}
        accent="#60a5fa"
        filled={g1Filled}
        total={2}
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

      {/* ── Group 2: Program Details ── */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupProgramDetails')}
        subtitle={t('entry.groupProgramDetailsHint')}
        icon={BookOpen}
        accent="var(--color-primary)"
        filled={g2Filled}
        total={3}
        animationDelay={60}
      >
        <div className="space-y-4">
          {/* Program name gets full width — it's the hero field */}
          <Field label={fieldLabel('programName')} error={submitted ? errors.programName : undefined} fieldKey="programName">
            <TextInput
              value={form.programName || ""}
              onChange={(e) => setForm((c) => ({ ...c, programName: e.target.value }))}
              disabled={coreFieldDisabled("programName")}
              error={submitted && !!errors.programName}
              placeholder={t('placeholder.programName')}
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

      {/* ── Group 3: Schedule ── */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupSchedule')}
        subtitle={t('entry.groupScheduleHint')}
        icon={Clock}
        accent="#f59e0b"
        filled={g3Filled}
        total={2}
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
        <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{t('entry.streakEligibility')}</p>
      </FormFieldGroup>

      {/* ── Group 4: Coordination ── */}
      <FormFieldGroup
        step={4}
        title={t('entry.groupCoordination')}
        subtitle={t('entry.groupCoordinationHint')}
        icon={Users}
        accent="#06b6d4"
        filled={g4Filled}
        total={1}
        animationDelay={180}
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

      {/* ── Group 5: Funding ── */}
      <FormFieldGroup
        step={5}
        title={t('entry.groupFunding')}
        subtitle={t('entry.groupFundingHint')}
        icon={Banknote}
        accent="#a78bfa"
        filled={g5Filled}
        total={g5Total}
        animationDelay={240}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('sponsored')} error={submitted ? errors.sponsored : undefined} fieldKey="sponsored">
            <PillSelect
              value={form.sponsored || ""}
              onChange={(value) => setForm((c) => ({ ...c, sponsored: value, ...(value === "No" ? { fundingAgency: "", fundingAmount: null } : {}) }))}
              options={SPONSORED_OPTIONS}
              accent="#a78bfa"
              disabled={coreFieldDisabled("sponsored")}
              error={submitted && !!errors.sponsored}
            />
          </Field>
          {form.sponsored === "Yes" && (
            <div className="grid gap-4 sm:grid-cols-2 animate-fade-in-up">
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
        </div>
      </FormFieldGroup>

      {/* ── Group 6: Documents (Stage 2) ── */}
      {uploadsVisible ? (
        <>
          <StageTwoDivider />
          <FormFieldGroup
            step={6}
            title={t('entry.groupDocuments')}
            subtitle={t('entry.groupDocumentsHint')}
            icon={Unlock}
            accent="#10b981"
            filled={g6Filled}
            total={3}
            animationDelay={0}
          >
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
                uploadEndpoint="/api/me/fdp-conducted/file"
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
                uploadEndpoint="/api/me/fdp-conducted/file"
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
                uploadEndpoint="/api/me/fdp-conducted/file"
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

              <Field label={fieldLabel('outsideParticipants')} hint={t('entry.outsideParticipantsHint')} fieldKey="outsideParticipants">
                <TextInput
                  type="number"
                  min="0"
                  value={form.outsideParticipants === null ? "" : String(form.outsideParticipants)}
                  onChange={(e) => setForm((c) => ({ ...c, outsideParticipants: e.target.value === "" ? null : Number(e.target.value) }))}
                  disabled={controlsDisabled}
                  placeholder={t('placeholder.outsideParticipants')}
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
                uploadEndpoint="/api/me/fdp-conducted/file"
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
          </FormFieldGroup>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function FdpConductedPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<FdpConducted>
      {...props}
      category="fdp-conducted"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          level: safeString(e.level),
          mode: safeString(e.mode),
          startDate: safeString(e.startDate),
          endDate: safeString(e.endDate),
          programName: safeString(e.programName) || safeString(e.eventName),
          coordinatorName: safeString(e.coordinatorName),
          coordinatorEmail: safeString(e.coordinatorEmail),
          coCoordinators: ensureFacultyArray(e.coCoordinators),
          sponsored: safeBoolString(e.sponsored),
          fundingAgency: safeString(e.fundingAgency),
          fundingAmount: safeNumber(e.fundingAmount),
          numberOfParticipants: safeNumber(e.numberOfParticipants),
          outsideParticipants: safeNumber(e.outsideParticipants),
          permissionLetter: ensureFileMetaArray(e.permissionLetter),
          geotaggedPhotos: ensureFileMetaArray(e.geotaggedPhotos),
          attendanceSheet: ensureFileMetaArray(e.attendanceSheet),
          officialPoster: ensureFileMetaArray(e.officialPoster),
          streak: ensureStreak(e.streak),
        } as FdpConducted;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <FdpConductedFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) => (entry.programName || "").trim() || t('entry.untitledEntry')}
      buildListEntrySubtitle={(entry) => {
        const parts = [`${t('entry.coordinator')} ${entry.coordinatorName || entry.coordinatorEmail || "-"}`];
        if (entry.coCoordinators.length > 0) {
          parts.push(`${t('entry.coCoordinatorTitle')}: ${entry.coCoordinators.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return parts.join(" • ");
      }}
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
      title={t('entry.fdpConductedPageTitle')}
      subtitle={t('entry.fdpConductedPageSubtitle')}
      formTitle={t('entry.fdpConductedFormTitle')}
      formSubtitle={t('entry.fdpConductedFormSubtitle')}
      deleteDescription={t('entry.fdpConductedDeleteDesc')}
    />
  );
}

export default FdpConductedPage;
