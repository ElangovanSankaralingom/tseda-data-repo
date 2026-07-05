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
// PatentEntry (record flow — no permission PDF, no timer)
// ---------------------------------------------------------------------------

export type PatentEntry = {
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
  patentTitle: string;
  status: string;
  level: string;
  applicationNumber: string;
  applicationDate: string;
  statusDate: string;
  inventors: FacultyRowValue[];
  externalInventors: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  patentDocument: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// ResearchFundingEntry (record flow — no permission PDF, no timer)
// ---------------------------------------------------------------------------

export type ResearchFundingEntry = {
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
  projectTitle: string;
  agencyOrClient: string;
  amountInr: number | null;
  sanctionDate: string;
  durationText: string;
  investigators: FacultyRowValue[];
  externalInvestigators: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  sanctionOrder: FileMeta[];
  supportingProof: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// EditorialRoleEntry (record flow — no permission PDF, no timer, no fan-out)
// ---------------------------------------------------------------------------

export type EditorialRoleEntry = {
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
  journalName: string;
  role: string;
  issn: string;
  publisher: string;
  appointmentDate: string;
  detailsText: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  appointmentProof: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// ConferenceOrganizedEntry (PERMISSION flow — letter, timer, stage-2 proofs)
// ---------------------------------------------------------------------------

export type ConferenceOrganizedEntry = {
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
  conferenceTitle: string;
  level: string;
  role: string;
  startDate: string;
  endDate: string;
  collaboratingBodies: string;
  organizingTeam: FacultyRowValue[];
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  permissionLetter: FileMeta[];
  eventReport: FileMeta[];
  committeeProof: FileMeta[];
  photographs: FileMeta[];
  numberOfDelegates: number | null;
  papersPresented: number | null;
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

// ---------------------------------------------------------------------------
// StudioContributionEntry (record flow — S1 descriptive box + proof)
// ---------------------------------------------------------------------------

export type StudioContributionEntry = {
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
  contributionKind: string;
  activityTitle: string;
  descriptionText: string;
  eventDate: string;
  venue: string;
  externalParticipants: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  proofs: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// CreativePublicationEntry (record flow — individual, 5/unit)
// ---------------------------------------------------------------------------

export type CreativePublicationEntry = {
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
  workTitle: string;
  publicationName: string;
  publicationDate: string;
  issn: string;
  workUrl: string;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  publicationCopy: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};
