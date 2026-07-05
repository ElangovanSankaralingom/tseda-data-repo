"use client";

import { Book, BookMarked, Calendar, FileCheck2, Users, Link2, CloudSun, Sun } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { t as staticT } from "@/lib/i18n";
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
import type { BookChapterEntry } from "@/components/data-entry/adapters/adapterTypes";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

/**
 * Books & Chapters — record flow, collaborative. `kind` (Book | Chapter)
 * decides the award metric (10 / 5); chapterTitle is required only for
 * chapters (conditional validation, same pattern as workshops' funding).
 */

const SEMESTER_TYPE_OPTIONS = [
  { label: "ODD Semester", value: "ODD", icon: CloudSun },
  { label: "EVEN Semester", value: "EVEN", icon: Sun },
];

const KIND_OPTIONS = [
  { label: "Book", value: "Book", icon: Book },
  { label: "Chapter", value: "Chapter", icon: BookMarked },
];

function emptyForm(): BookChapterEntry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    kind: "",
    bookTitle: "",
    chapterTitle: "",
    publisher: "",
    isbn: "",
    editionOrVolume: "",
    pageNumbers: "",
    publicationDate: "",
    coAuthors: [],
    externalAuthors: "",
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    coverIsbnProof: [],
    publicationProof: [],
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as BookChapterEntry;
}

function validateFields(form: BookChapterEntry): Record<string, string> {
  const errors = validateEntryFields("books-and-chapters", form as unknown as Record<string, unknown>);
  // Conditional: a chapter must name its chapter title.
  if (form.kind === "Chapter" && !form.chapterTitle?.trim()) {
    errors.chapterTitle = staticT('entry.chapterTitleRequired', 'en');
  }
  return errors;
}

function BookChapterFormFields({ ctx }: { ctx: FormFieldsContext<BookChapterEntry> }) {
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

  const isChapter = form.kind === "Chapter";
  const group1Complete = (form.academicYear ? 1 : 0) + (form.semesterType ? 1 : 0);
  const group2Complete = (form.kind ? 1 : 0) + (form.bookTitle ? 1 : 0) + (isChapter && form.chapterTitle ? 1 : 0);
  const group2Total = isChapter ? 3 : 2;
  const group3Complete = (form.publisher ? 1 : 0) + (form.isbn ? 1 : 0) + (form.publicationDate ? 1 : 0);
  const group4Complete = (form.coAuthors.length > 0 ? 1 : 0) + (form.externalAuthors ? 1 : 0);
  const group5Complete = (form.coverIsbnProof.length > 0 ? 1 : 0) + (form.publicationProof.length > 0 ? 1 : 0);

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

      {/* Group 2: Publication */}
      <FormFieldGroup
        step={2}
        title={t('entry.groupPublication')}
        icon={Book}
        accent="var(--color-primary)"
        filled={group2Complete}
        total={group2Total}
        disabled={coreFieldDisabled("kind") && coreFieldDisabled("bookTitle")}
        animationDelay={60}
      >
        <div className="space-y-4">
          <Field label={fieldLabel('kind')} error={submitted ? errors.kind : undefined} fieldKey="kind">
            <PillSelect
              value={form.kind || ""}
              onChange={(value) => setForm((c) => ({ ...c, kind: value, ...(value !== "Chapter" ? { chapterTitle: "" } : {}) }))}
              options={KIND_OPTIONS}
              disabled={coreFieldDisabled("kind")}
              error={submitted && !!errors.kind}
            />
          </Field>

          <Field label={fieldLabel('bookTitle')} error={submitted ? errors.bookTitle : undefined} fieldKey="bookTitle">
            <TextInput
              value={form.bookTitle || ""}
              onChange={(e) => setForm((c) => ({ ...c, bookTitle: e.target.value }))}
              disabled={coreFieldDisabled("bookTitle")}
              error={submitted && !!errors.bookTitle}
              placeholder={t('placeholder.bookTitle')}
            />
          </Field>

          {isChapter && (
            <Field label={fieldLabel('chapterTitle')} error={submitted ? errors.chapterTitle : undefined} fieldKey="chapterTitle">
              <TextInput
                value={form.chapterTitle || ""}
                onChange={(e) => setForm((c) => ({ ...c, chapterTitle: e.target.value }))}
                disabled={coreFieldDisabled("chapterTitle")}
                error={submitted && !!errors.chapterTitle}
                placeholder={t('placeholder.chapterTitle')}
              />
            </Field>
          )}
        </div>
      </FormFieldGroup>

      {/* Group 3: Publisher & Identifiers */}
      <FormFieldGroup
        step={3}
        title={t('entry.groupIdentifiers')}
        icon={Link2}
        accent="#f59e0b"
        filled={group3Complete}
        total={3}
        disabled={coreFieldDisabled("publisher") && coreFieldDisabled("isbn")}
        animationDelay={120}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fieldLabel('publisher')} error={submitted ? errors.publisher : undefined} fieldKey="publisher">
              <TextInput
                value={form.publisher || ""}
                onChange={(e) => setForm((c) => ({ ...c, publisher: e.target.value }))}
                disabled={coreFieldDisabled("publisher")}
                error={submitted && !!errors.publisher}
                placeholder={t('placeholder.publisher')}
              />
            </Field>

            <Field label={fieldLabel('isbn')} error={submitted ? errors.isbn : undefined} fieldKey="isbn">
              <TextInput
                value={form.isbn || ""}
                onChange={(e) => setForm((c) => ({ ...c, isbn: e.target.value }))}
                disabled={coreFieldDisabled("isbn")}
                error={submitted && !!errors.isbn}
                placeholder={t('placeholder.isbn')}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={fieldLabel('publicationDate')} error={submitted ? errors.publicationDate : undefined} fieldKey="publicationDate">
              <DateField
                value={form.publicationDate}
                onChange={(v) => setForm((c) => ({ ...c, publicationDate: v }))}
                disabled={coreFieldDisabled("publicationDate")}
                error={submitted && !!errors.publicationDate}
              />
            </Field>

            <Field label={fieldLabel('editionOrVolume')} fieldKey="editionOrVolume">
              <TextInput
                value={form.editionOrVolume || ""}
                onChange={(e) => setForm((c) => ({ ...c, editionOrVolume: e.target.value }))}
                disabled={coreFieldDisabled("editionOrVolume")}
                placeholder={t('placeholder.editionOrVolume')}
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

      {/* Group 4: Authors */}
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
              key={`${form.id}-coverIsbnProof`}
              title={fieldLabel('coverIsbnProof')}
              value={form.coverIsbnProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, coverIsbnProof: [...c.coverIsbnProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, coverIsbnProof: c.coverIsbnProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/books-and-chapters/file"
              email={email} recordId={form.id} slotName="coverIsbnProof"
              showRequiredError={submitAttemptedFinal && form.coverIsbnProof.length === 0}
              requiredErrorText={errors.coverIsbnProof}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />

            <UploadFieldMulti
              key={`${form.id}-publicationProof`}
              title={fieldLabel('publicationProof')}
              value={form.publicationProof}
              onUploaded={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, publicationProof: [...c.publicationProof, meta] }) }); }}
              onDeleted={async (meta) => { await persistCurrentMutation({ buildNextEntry: (c) => ({ ...c, publicationProof: c.publicationProof.filter((item) => item.storedPath !== meta.storedPath) }) }); }}
              uploadEndpoint="/api/me/books-and-chapters/file"
              email={email} recordId={form.id} slotName="publicationProof"
              showRequiredError={false}
              onStatusChange={() => {}} disabled={controlsDisabled} viewOnly={isViewMode}
            />
          </div>
        </FormFieldGroup>
      )}
    </div>
  );
}

export function BooksAndChaptersPage(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<BookChapterEntry>
      {...props}
      category="books-and-chapters"
      emptyForm={emptyForm}
      hydrateEntry={(entry) => {
        const e = entry as unknown as Record<string, unknown>;
        return {
          ...emptyForm(),
          ...e,
          academicYear: safeString(e.academicYear),
          semesterType: safeString(e.semesterType),
          kind: safeString(e.kind),
          bookTitle: safeString(e.bookTitle),
          chapterTitle: safeString(e.chapterTitle),
          publisher: safeString(e.publisher),
          isbn: safeString(e.isbn),
          editionOrVolume: safeString(e.editionOrVolume),
          pageNumbers: safeString(e.pageNumbers),
          publicationDate: safeString(e.publicationDate),
          coAuthors: ensureFacultyArray(e.coAuthors),
          externalAuthors: safeString(e.externalAuthors),
          coverIsbnProof: ensureFileMetaArray(e.coverIsbnProof),
          publicationProof: ensureFileMetaArray(e.publicationProof),
          streak: ensureStreak(e.streak),
        } as BookChapterEntry;
      }}
      validateFields={validateFields}
      renderFormFields={(ctx) => <BookChapterFormFields ctx={ctx} />}
      buildListEntryTitle={(entry) =>
        (entry.kind === "Chapter" && entry.chapterTitle ? entry.chapterTitle : entry.bookTitle || "").trim() || t('entry.untitledEntry')
      }
      buildListEntrySubtitle={(entry) =>
        entry.kind === "Chapter" && entry.bookTitle
          ? `${t('fields.kind')}: ${entry.kind} — ${entry.bookTitle}`
          : entry.publisher || ""
      }
      renderListEntryBody={({ entry, group }) => {
        const parts: string[] = [];
        if (entry.academicYear) parts.push(entry.academicYear);
        if (entry.semesterType) parts.push(`${entry.semesterType} ${t('entry.semester')}`);
        if (entry.kind) parts.push(entry.kind);
        if (entry.publisher) parts.push(entry.publisher);
        if (entry.isbn) parts.push(`ISBN ${entry.isbn}`);
        if (entry.publicationDate) parts.push(formatDisplayDate(entry.publicationDate));
        if (entry.coAuthors.length > 0) {
          parts.push(`${t('fields.coAuthors')}: ${entry.coAuthors.map(formatFacultyDisplay).join(", ")}`);
        }
        if (entry.sourceEmail) parts.push(`${t('entry.sharedBy')} ${entry.sourceEmail}`);
        return (
          <>
            <MetadataPills parts={parts} group={group} />
            <AttachmentBadges attachments={[
              { label: "Cover / ISBN", files: entry.coverIsbnProof },
              { label: "Publication Proof", files: entry.publicationProof },
            ]} group={group} />
          </>
        );
      }}
      title={t('entry.booksAndChaptersPageTitle')}
      subtitle={t('entry.booksAndChaptersPageSubtitle')}
      formTitle={t('entry.booksAndChaptersFormTitle')}
      formSubtitle={t('entry.booksAndChaptersFormSubtitle')}
      deleteDescription={t('entry.booksAndChaptersDeleteDesc')}
    />
  );
}

export default BooksAndChaptersPage;
