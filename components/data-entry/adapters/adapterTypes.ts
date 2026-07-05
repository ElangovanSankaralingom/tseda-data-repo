import type { FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import type { EntryStatus, FileMeta } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";
import type { StreakState } from "@/lib/streakState";
import type { YearOfStudy } from "@/lib/student-academic";

// ---------------------------------------------------------------------------
// EntryRecord — shared base constraint for all adapter entry types
// ---------------------------------------------------------------------------

export type EntryRecord = Record<string, unknown> & {
  id: string;
  confirmationStatus?: EntryStatus;
  status?: string | null;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  pdfMeta?: { storedPath?: string; url?: string; fileName?: string; generatedAtISO?: string } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  permanentlyLocked?: boolean;
  streak?: unknown;
  createdAt?: string;
  updatedAt?: string;
  // CategorizableEntry fields
  completionState?: string | null;
  streakState?: string | null;
  committedAtISO?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

// ---------------------------------------------------------------------------
// WorkshopEntry
// ---------------------------------------------------------------------------

export type WorkshopEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  level: string;
  mode: string;
  startDate: string;
  endDate: string;
  workshopName: string;
  resourcePersonName: string;
  resourcePersonDesignation: string;
  resourcePersonOrganisation: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultyRowValue[];
  sponsored: string;
  fundingAgency: string;
  fundingAmount: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  permissionLetter: FileMeta[];
  geotaggedPhotos: FileMeta[];
  attendanceSheet: FileMeta[];
  officialPoster: FileMeta[];
  numberOfParticipants: number | null;
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// JournalPublicationEntry (record flow — no permission PDF, no timer)
// ---------------------------------------------------------------------------

export type JournalPublicationEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  entryFlow?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  paperTitle: string;
  journalName: string;
  issn: string;
  volumeIssue: string;
  pageNumbers: string;
  publicationDate: string;
  doi: string;
  indexing: string;
  coAuthors: FacultyRowValue[];
  externalAuthors: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  firstPage: FileMeta[];
  indexProof: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// ConferencePublicationEntry (record flow — no permission PDF, no timer)
// ---------------------------------------------------------------------------

export type ConferencePublicationEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  entryFlow?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  paperTitle: string;
  conferenceName: string;
  level: string;
  organizedBy: string;
  publicationDate: string;
  issnIsbn: string;
  pageNumbers: string;
  doi: string;
  indexing: string;
  coAuthors: FacultyRowValue[];
  externalAuthors: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  firstPage: FileMeta[];
  indexProof: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// BookChapterEntry (record flow — no permission PDF, no timer)
// ---------------------------------------------------------------------------

export type BookChapterEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  entryFlow?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  kind: string;
  bookTitle: string;
  chapterTitle: string;
  publisher: string;
  isbn: string;
  editionOrVolume: string;
  pageNumbers: string;
  publicationDate: string;
  coAuthors: FacultyRowValue[];
  externalAuthors: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  coverIsbnProof: FileMeta[];
  publicationProof: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// FdpAttended
// ---------------------------------------------------------------------------

export type FdpAttended = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  level: string;
  mode: string;
  startDate: string;
  endDate: string;
  programName: string;
  organisingBody: string;
  sponsored: string;
  fundingAgency: string;
  fundingAmount: number | null;
  coParticipants: FacultyRowValue[];
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  permanentlyLocked?: boolean;
  permissionLetter: FileMeta[];
  completionCertificate: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// FdpConducted
// ---------------------------------------------------------------------------

export type FdpConducted = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  level: string;
  mode: string;
  startDate: string;
  endDate: string;
  programName: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultyRowValue[];
  sponsored: string;
  fundingAgency: string;
  fundingAmount: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  permanentlyLocked?: boolean;
  permissionLetter: FileMeta[];
  geotaggedPhotos: FileMeta[];
  attendanceSheet: FileMeta[];
  numberOfParticipants: number | null;
  officialPoster: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// StaffSelection & CaseStudyEntry
// ---------------------------------------------------------------------------

export type StaffSelection = FacultyRowValue;

export type CaseStudyEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  startDate: string;
  endDate: string;
  placeOfVisit: string;
  purposeOfVisit: string;
  coordinatorName: string;
  coordinatorEmail: string;
  staffAccompanying: StaffSelection[];
  sponsored: string;
  fundingAgency: string;
  fundingAmount: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  permanentlyLocked?: boolean;
  permissionLetter: FileMeta[];
  travelPlan: FileMeta[];
  geotaggedPhotos: FileMeta[];
  report: FileMeta[];
  feedback: FileMeta[];
  advanceClosure: FileMeta[];
  numberOfParticipants: number | null;
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// GuestLectureEntry
// ---------------------------------------------------------------------------

export type GuestLectureEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  level: string;
  mode: string;
  startDate: string;
  endDate: string;
  topicOfLecture: string;
  guestSpeakerName: string;
  guestSpeakerDesignation: string;
  guestSpeakerOrganisation: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultyRowValue[];
  sponsored: string;
  fundingAgency: string;
  fundingAmount: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  permanentlyLocked?: boolean;
  permissionLetter: FileMeta[];
  geotaggedPhotos: FileMeta[];
  attendanceSheet: FileMeta[];
  officialPoster: FileMeta[];
  numberOfParticipants: number | null;
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};
