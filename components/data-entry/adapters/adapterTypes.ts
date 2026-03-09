import type { FacultyRowValue } from "@/components/entry/FacultyPickerRows";
import type { EntryStatus, FileMeta } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";
import type { StreakState } from "@/lib/gamification";
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
  sharedRole?: "coCoordinator";
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  startDate: string;
  endDate: string;
  eventName: string;
  speakerName: string;
  organisationName: string;
  coordinator: FacultyRowValue;
  coCoordinators: FacultyRowValue[];
  participants: number | null;
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
  uploads: Record<"permissionLetter" | "brochure" | "attendance" | "organiserProfile", FileMeta | null> & { geotaggedPhotos: FileMeta[] };
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// FdpAttended
// ---------------------------------------------------------------------------

export type FdpAttended = {
  id: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  startDate: string;
  endDate: string;
  programName: string;
  organisingBody: string;
  supportAmount: number | null;
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
  permissionLetter: FileMeta | null;
  completionCertificate: FileMeta | null;
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// FdpConducted
// ---------------------------------------------------------------------------

export type FdpConducted = {
  id: string;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  startDate: string;
  endDate: string;
  eventName: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultyRowValue[];
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  permissionLetter: FileMeta | null;
  geotaggedPhotos: FileMeta[];
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
  sharedRole?: "staffAccompanying";
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  startDate: string;
  endDate: string;
  coordinator: FacultyRowValue;
  placeOfVisit: string;
  purposeOfVisit: string;
  staffAccompanying: StaffSelection[];
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  participants: number | null;
  amountSupport: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfSourceHash?: string;
  pdfStale?: boolean;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  permanentlyLocked?: boolean;
  permissionLetter: FileMeta | null;
  travelPlan: FileMeta | null;
  geotaggedPhotos: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// UploadStatus (used by guest-lectures)
// ---------------------------------------------------------------------------

export type UploadStatus = { hasPending: boolean; busy: boolean };

// ---------------------------------------------------------------------------
// GuestLectureEntry
// ---------------------------------------------------------------------------

export type GuestLectureEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "coCoordinator";
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  startDate: string;
  endDate: string;
  eventName: string;
  speakerName: string;
  organizationName: string;
  coordinator: FacultyRowValue;
  coCoordinators: FacultyRowValue[];
  yearOfStudy: YearOfStudy | "";
  currentSemester: number | null;
  participants: number | null;
  pdfMeta?: {
    storedPath: string;
    url: string;
    fileName: string;
    generatedAtISO: string;
  } | null;
  pdfSourceHash?: string;
  pdfStale?: boolean;
  uploads: Record<"permissionLetter" | "brochure" | "attendance" | "speakerProfile", FileMeta | null> & { geotaggedPhotos: FileMeta[] };
  streak?: {
    activatedAtISO?: string | null;
    dueAtISO?: string | null;
    completedAtISO?: string | null;
    windowDays?: number;
  };
  createdAt: string;
  updatedAt: string;
};
