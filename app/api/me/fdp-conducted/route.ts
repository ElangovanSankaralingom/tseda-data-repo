import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  createEntry,
  deleteEntry as deleteEngineEntry,
  listEntriesForCategory,
  updateEntry,
} from "@/lib/entries/lifecycle";
import { isValidPdfMeta, type PdfMeta } from "@/lib/entry-pdf";
import {
  findFacultyByEmail,
  findFacultyByName,
  getCanonicalName,
  normalizeEmail,
} from "@/lib/facultyDirectory";
import { normalizeError } from "@/lib/errors";
import { mergeWithNulls } from "@/lib/mergeWithNulls";
import { isEntryEditable } from "@/lib/entries/lock";
import {
  isFutureDatedEntry,
  normalizeStreakState,
  type StreakState,
} from "@/lib/gamification";
import { buildCanonicalStreakMetadata } from "@/lib/streakProgress";
import {
  isEntryCommitted,
  normalizeEntryStatus,
  type EntryStateLike,
} from "@/lib/entries/stateMachine";
import {
  isSemesterAllowed,
  normalizeStudentYear,
  type StudentYear,
} from "@/lib/student-academic";
import type { EntryStatus } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";
import { safeEmailDir } from "@/lib/userStore";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type FacultySelection = {
  id?: string;
  name: string;
  email: string;
  isLocked?: boolean;
  savedAtISO?: string | null;
};

type FdpConducted = {
  id: string;
  confirmationStatus?: EntryStatus;
  committedAtISO?: string | null;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  studentYear: StudentYear | "";
  semesterNumber: number | null;
  startDate: string;
  endDate: string;
  eventName: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultySelection[];
  pdfMeta?: PdfMeta | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  permissionLetter: FileMeta | null;
  geotaggedPhotos: FileMeta[];
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

const ACADEMIC_YEAR_OPTIONS = new Set([
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
]);

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function getAcademicYearRange(academicYear: string) {
  const match = academicYear.match(/^Academic Year (\d{4})-(\d{4})$/);
  if (!match) return null;

  const startYear = match[1];
  const endYear = match[2];

  return {
    start: `${startYear}-07-01`,
    end: `${endYear}-06-30`,
    label: `Jul 1, ${startYear} to Jun 30, ${endYear}`,
  };
}

function isValidFileMeta(meta: FileMeta | null): meta is FileMeta {
  return !!(
    meta &&
    meta.fileName &&
    meta.mimeType &&
    typeof meta.size === "number" &&
    meta.uploadedAt &&
    meta.url &&
    meta.storedPath
  );
}

function normalizeFileMetaArray(value: unknown, legacyValue?: unknown) {
  const raw = Array.isArray(value)
    ? value
    : legacyValue
      ? [legacyValue]
      : [];

  return raw.filter((item): item is FileMeta => isValidFileMeta((item as FileMeta | null) ?? null));
}

function parseNameEmail(text: string): FacultySelection {
  const trimmed = text.trim();
  const match = trimmed.match(/^(.*)\s<([^<>@\s]+@[^<>@\s]+)>$/);

  if (!match) {
    return { name: trimmed, email: "" };
  }

  return {
    name: match[1].trim(),
    email: normalizeEmail(match[2].trim()),
  };
}

function normalizeFacultySelection(value: unknown): FacultySelection {
  if (typeof value === "string") {
    return { ...parseNameEmail(value), id: undefined, isLocked: false, savedAtISO: null };
  }

  if (value && typeof value === "object") {
    const record = value as {
      id?: unknown;
      name?: unknown;
      email?: unknown;
      isLocked?: unknown;
      savedAtISO?: unknown;
    };
    return {
      id: String(record.id ?? "").trim() || undefined,
      name: String(record.name ?? "").trim(),
      email: normalizeEmail(String(record.email ?? "")),
      isLocked: record.isLocked === true,
      savedAtISO: typeof record.savedAtISO === "string" && record.savedAtISO.trim() ? record.savedAtISO : null,
    };
  }

  return { id: undefined, name: "", email: "", isLocked: false, savedAtISO: null };
}

function canonicalizeFacultySelection(value: FacultySelection) {
  const normalizedEmail = value.email ? normalizeEmail(value.email) : "";
  const byEmail = normalizedEmail ? findFacultyByEmail(normalizedEmail) : null;
  if (byEmail) {
    return {
      id: value.id,
      name: byEmail.name,
      email: byEmail.email,
      isLocked: value.isLocked === true,
      savedAtISO: value.savedAtISO ?? null,
    };
  }

  const byName = value.name ? findFacultyByName(value.name) : null;
  if (byName) {
    return {
      id: value.id,
      name: byName.name,
      email: byName.email,
      isLocked: value.isLocked === true,
      savedAtISO: value.savedAtISO ?? null,
    };
  }

  return {
    id: value.id,
    name: value.name.trim(),
    email: normalizedEmail,
    isLocked: value.isLocked === true,
    savedAtISO: value.savedAtISO ?? null,
  };
}

function sanitizeCoCoordinators(value: unknown): FacultySelection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeFacultySelection)
    .map(canonicalizeFacultySelection)
    .filter((item) => !!item.email);
}

function normalizeRequestEditStatus(
  value: unknown,
  fallback: RequestEditStatus = "none"
) {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : fallback;
}

function getPrePdfFieldsHash(
  entry: Pick<FdpConducted, "academicYear" | "studentYear" | "semesterNumber" | "startDate" | "endDate" | "eventName" | "coCoordinators">
) {
  return JSON.stringify({
    academicYear: String(entry.academicYear ?? "").trim(),
    studentYear: String(entry.studentYear ?? "").trim(),
    semesterNumber:
      typeof entry.semesterNumber === "number" && Number.isFinite(entry.semesterNumber)
        ? entry.semesterNumber
        : null,
    startDate: String(entry.startDate ?? "").trim(),
    endDate: String(entry.endDate ?? "").trim(),
    eventName: String(entry.eventName ?? "").trim(),
    coCoordinators: entry.coCoordinators.map((value) => ({
      id: String(value.id ?? ""),
      email: String(value.email ?? "").trim().toLowerCase(),
    })),
  });
}

function normalizeEntry(value: unknown): FdpConducted | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  let semesterNumber: number | null = null;
  if (typeof record.semesterNumber === "number" && Number.isFinite(record.semesterNumber)) {
    semesterNumber = record.semesterNumber;
  } else if (typeof record.semesterNumber === "string" && record.semesterNumber.trim()) {
    const parsed = Number(record.semesterNumber);
    semesterNumber = Number.isFinite(parsed) ? parsed : null;
  }

  const legacyCoordinator = normalizeFacultySelection(record.coordinator);
  const coordinator = {
    name: String(record.coordinatorName ?? legacyCoordinator.name ?? "").trim(),
    email: normalizeEmail(String(record.coordinatorEmail ?? legacyCoordinator.email ?? "")),
  };
  const coCoordinatorsRaw = Array.isArray(record.coCoordinators) ? record.coCoordinators : [];
  const coCoordinators = coCoordinatorsRaw
    .map(normalizeFacultySelection)
    .filter((item) => item.name || item.email);

  const normalized: FdpConducted = {
    id: String(record.id ?? "").trim(),
    confirmationStatus: normalizeEntryStatus(record as Record<string, unknown>),
    committedAtISO:
      typeof record.committedAtISO === "string" && record.committedAtISO.trim()
        ? record.committedAtISO.trim()
        : null,
    requestEditStatus: normalizeRequestEditStatus(record.requestEditStatus),
    requestEditRequestedAtISO:
      typeof record.requestEditRequestedAtISO === "string" && record.requestEditRequestedAtISO.trim()
        ? record.requestEditRequestedAtISO.trim()
        : null,
    requestEditMessage:
      typeof record.requestEditMessage === "string" && record.requestEditMessage.trim()
        ? record.requestEditMessage.trim()
        : "",
    academicYear: String(record.academicYear ?? "").trim(),
    studentYear: normalizeStudentYear(String(record.studentYear ?? "").trim()) ?? "",
    semesterNumber,
    startDate: String(record.startDate ?? "").trim(),
    endDate: String(record.endDate ?? "").trim(),
    eventName: String(record.eventName ?? "").trim(),
    coordinatorName: coordinator.name,
    coordinatorEmail: coordinator.email,
    coCoordinators,
    pdfMeta: isValidPdfMeta((record.pdfMeta as PdfMeta | null) ?? null)
      ? ((record.pdfMeta as PdfMeta | null) ?? null)
      : null,
    pdfStale: record.pdfStale === true,
    pdfSourceHash: typeof record.pdfSourceHash === "string" ? record.pdfSourceHash : "",
    permissionLetter: (record.permissionLetter as FileMeta | null) ?? null,
    geotaggedPhotos: normalizeFileMetaArray(record.geotaggedPhotos, record.geotaggedPhoto),
    streak: normalizeStreakState(record.streak),
    createdAt: String(record.createdAt ?? "").trim(),
    updatedAt: String(record.updatedAt ?? "").trim(),
  };

  if (normalized.pdfMeta && !normalized.pdfSourceHash) {
    normalized.pdfSourceHash = getPrePdfFieldsHash(normalized);
  }

  normalized.pdfStale =
    !!normalized.pdfMeta &&
    !!normalized.pdfSourceHash &&
    getPrePdfFieldsHash(normalized) !== normalized.pdfSourceHash;

  return normalized;
}

function normalizeStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }

  return normalized;
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail.endsWith("@tce.edu")) {
    return null;
  }

  return normalizedEmail;
}

function mutationErrorResponse(error: unknown, fallbackMessage: string) {
  const appError = normalizeError(error);
  if (appError.code === "RATE_LIMITED") {
    return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
  }
  if (appError.code === "PAYLOAD_TOO_LARGE") {
    return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
  }
  if (appError.code === "VALIDATION_ERROR") {
    return NextResponse.json({ error: appError.message, code: appError.code }, { status: 400 });
  }
  if (appError.code === "FORBIDDEN") {
    return NextResponse.json({ error: appError.message || "Forbidden" }, { status: 403 });
  }
  if (appError.code === "NOT_FOUND") {
    return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ error: appError.message || fallbackMessage }, { status: 500 });
}

async function readList(email: string): Promise<FdpConducted[]> {
  return listEntriesForCategory(email, "fdp-conducted", normalizeEntry);
}

async function deleteStoredFile(email: string, meta: FileMeta | null) {
  if (!meta?.storedPath) return;

  try {
    const normalized = normalizeStoredPath(meta.storedPath);
    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "fdp-conducted") + "/";

    if (!normalized.startsWith(ownerPrefix)) {
      return;
    }

    await fs.unlink(path.join(process.cwd(), "public", normalized)).catch(() => null);
  } catch {
    return;
  }
}

function canEditEntry(entry: FdpConducted) {
  return isEntryEditable(entry);
}

function hasCompletedUploads(entry: Pick<FdpConducted, "permissionLetter" | "geotaggedPhotos">) {
  return isValidFileMeta(entry.permissionLetter) && entry.geotaggedPhotos.length > 0;
}

function validateCoreFields(entry: FdpConducted) {
  const startDate = String(entry.startDate ?? "").trim();
  const endDate = String(entry.endDate ?? "").trim();
  const academicYear = String(entry.academicYear ?? "").trim();
  const studentYear = normalizeStudentYear(String(entry.studentYear ?? "").trim()) ?? "";
  const semesterNumber =
    typeof entry.semesterNumber === "number" && Number.isFinite(entry.semesterNumber)
      ? entry.semesterNumber
      : null;
  const eventName = String(entry.eventName ?? "").trim();

  if (!ACADEMIC_YEAR_OPTIONS.has(academicYear)) {
    return { error: "academicYear required" };
  }

  if (!studentYear) {
    return { error: "studentYear required" };
  }

  if (!isSemesterAllowed(studentYear, semesterNumber ?? undefined)) {
    return { error: "semesterNumber required" };
  }

  if (!isISODate(startDate)) {
    return { error: "startDate required" };
  }

  const academicYearRange = getAcademicYearRange(academicYear);
  if (academicYearRange && (startDate < academicYearRange.start || startDate > academicYearRange.end)) {
    return { error: `startDate must fall within ${academicYear} (${academicYearRange.label})` };
  }

  if (!isISODate(endDate)) {
    return { error: "endDate required" };
  }

  if (endDate < startDate) {
    return { error: "endDate must be on or after startDate" };
  }

  if (!eventName) {
    return { error: "eventName required" };
  }

  return { academicYear, studentYear, semesterNumber, startDate, endDate, eventName };
}

export async function GET(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  if (safeEmailDir(email) !== safeEmailDir(authorizedEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await readList(email), { status: 200 });
}

export async function POST(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { email?: string; entry?: unknown };
    const entryRecord =
      body?.entry && typeof body.entry === "object" ? (body.entry as Record<string, unknown>) : null;
    const email = normalizeEmail(String(body?.email ?? ""));
    const entry = normalizeEntry(body?.entry);

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    if (safeEmailDir(email) !== safeEmailDir(authorizedEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!entry?.id) {
      return NextResponse.json({ error: "entry.id required" }, { status: 400 });
    }

    const validated = validateCoreFields(entry);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const coordinator = canonicalizeFacultySelection({
      name: getCanonicalName(authorizedEmail) ?? String(entry.coordinatorName ?? "").trim(),
      email: authorizedEmail,
    });
    const coCoordinators = sanitizeCoCoordinators(entry.coCoordinators);

    if (!coordinator.name || !coordinator.email) {
      return NextResponse.json({ error: "coordinator required" }, { status: 400 });
    }

    if (!findFacultyByEmail(coordinator.email)) {
      return NextResponse.json({ error: "coordinator invalid" }, { status: 400 });
    }

    if (coCoordinators.some((value) => value.email && !findFacultyByEmail(value.email))) {
      return NextResponse.json({ error: "coCoordinators invalid" }, { status: 400 });
    }

    const selectedEmails = [coordinator.email, ...coCoordinators.map((item) => item.email)]
      .filter(Boolean)
      .map((value) => value.toLowerCase());
    const uniqueEmails = new Set(selectedEmails);

    if (uniqueEmails.size !== selectedEmails.length) {
      return NextResponse.json({ error: "duplicate faculty selection" }, { status: 400 });
    }

    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "fdp-conducted") + "/";
    if (
      entry.permissionLetter?.storedPath &&
      !normalizeStoredPath(entry.permissionLetter.storedPath).startsWith(ownerPrefix)
    ) {
      return NextResponse.json({ error: "permissionLetter invalid" }, { status: 400 });
    }
    if (
      entry.geotaggedPhotos.some(
        (meta) => !isValidFileMeta(meta) || !normalizeStoredPath(meta.storedPath).startsWith(ownerPrefix)
      )
    ) {
      return NextResponse.json({ error: "geotaggedPhotos invalid" }, { status: 400 });
    }

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    if (existing && !canEditEntry(existing)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const eligible = isFutureDatedEntry(validated.startDate, validated.endDate);
    const existingCommittedAtISO =
      typeof existing?.committedAtISO === "string" && existing.committedAtISO.trim()
        ? existing.committedAtISO
        : null;
    const requestedCommitted = isEntryCommitted({
      ...(entry as EntryStateLike),
      status: entryRecord?.status,
    });
    const nextCommitted = !!existingCommittedAtISO || requestedCommitted;
    const nextCommittedAtISO =
      existingCommittedAtISO ??
      (nextCommitted
        ? (typeof entry.committedAtISO === "string" && entry.committedAtISO.trim()
            ? entry.committedAtISO
            : now)
        : null);
    const streak = buildCanonicalStreakMetadata({
      streak: existing?.streak ?? entry.streak,
      endDateISO: validated.endDate,
      hasPdf: !!entry.pdfMeta,
      isEligible: eligible,
      isCommitted: nextCommitted,
      completionSatisfied: hasCompletedUploads(entry),
      nowISO: now,
    });

    const savedEntry: FdpConducted = {
      id: entry.id,
      committedAtISO: nextCommittedAtISO,
      requestEditStatus: normalizeRequestEditStatus(entry.requestEditStatus, existing?.requestEditStatus ?? "none"),
      requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? existing?.requestEditRequestedAtISO ?? null,
      requestEditMessage: entry.requestEditMessage ?? existing?.requestEditMessage ?? "",
      academicYear: validated.academicYear,
      studentYear: validated.studentYear,
      semesterNumber: validated.semesterNumber,
      startDate: validated.startDate,
      endDate: validated.endDate,
      eventName: validated.eventName,
      coordinatorName: coordinator.email ? (getCanonicalName(coordinator.email) ?? coordinator.name) : coordinator.name,
      coordinatorEmail: coordinator.email,
      coCoordinators: coCoordinators.map((value) => ({
        id: value.id,
        name: value.email ? (getCanonicalName(value.email) ?? value.name) : value.name,
        email: value.email,
        isLocked: value.isLocked === true,
        savedAtISO: value.savedAtISO ?? null,
      })),
      pdfMeta: entry.pdfMeta ?? existing?.pdfMeta ?? null,
      pdfSourceHash: entry.pdfSourceHash || existing?.pdfSourceHash || "",
      pdfStale: entry.pdfStale === true,
      permissionLetter: entry.permissionLetter,
      geotaggedPhotos: entry.geotaggedPhotos,
      streak,
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

    savedEntry.pdfStale =
      !!savedEntry.pdfMeta &&
      !!savedEntry.pdfSourceHash &&
      getPrePdfFieldsHash(savedEntry) !== savedEntry.pdfSourceHash;

    if (existing) {
      if (existing.permissionLetter?.storedPath !== savedEntry.permissionLetter?.storedPath) {
        await deleteStoredFile(email, existing.permissionLetter);
      }
      const nextPhotoPaths = new Set(savedEntry.geotaggedPhotos.map((meta) => meta.storedPath));
      for (const meta of existing.geotaggedPhotos) {
        if (!nextPhotoPaths.has(meta.storedPath)) {
          await deleteStoredFile(email, meta);
        }
      }
    }

    const persisted = existing
      ? await updateEntry<FdpConducted>(email, "fdp-conducted", savedEntry.id, savedEntry)
      : await createEntry<FdpConducted>(email, "fdp-conducted", savedEntry);
    return NextResponse.json(normalizeEntry(persisted) ?? persisted, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Save failed");
  }
}

export async function PATCH(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { email?: string; entry?: unknown };
    const email = normalizeEmail(String(body?.email ?? ""));
    const entryRecord =
      body?.entry && typeof body.entry === "object" ? (body.entry as Record<string, unknown>) : null;
    const entry = normalizeEntry(body?.entry);

    const hasRequestEditStatus =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "requestEditStatus");

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    if (safeEmailDir(email) !== safeEmailDir(authorizedEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!entry?.id) {
      return NextResponse.json({ error: "entry.id required" }, { status: 400 });
    }

    if (entry.academicYear && !ACADEMIC_YEAR_OPTIONS.has(entry.academicYear)) {
      return NextResponse.json({ error: "academicYear invalid" }, { status: 400 });
    }

    if (entry.studentYear && !normalizeStudentYear(entry.studentYear)) {
      return NextResponse.json({ error: "studentYear invalid" }, { status: 400 });
    }

    if (
      entry.studentYear &&
      entry.semesterNumber !== null &&
      entry.semesterNumber !== undefined &&
      !isSemesterAllowed(entry.studentYear, entry.semesterNumber)
    ) {
      return NextResponse.json({ error: "semesterNumber invalid" }, { status: 400 });
    }

    if (entry.startDate && !isISODate(entry.startDate)) {
      return NextResponse.json({ error: "startDate invalid" }, { status: 400 });
    }

    if (entry.endDate && !isISODate(entry.endDate)) {
      return NextResponse.json({ error: "endDate invalid" }, { status: 400 });
    }

    if (entry.startDate && entry.endDate && entry.endDate < entry.startDate) {
      return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
    }

    const academicYearRange = entry.academicYear ? getAcademicYearRange(entry.academicYear) : null;
    if (
      academicYearRange &&
      entry.startDate &&
      (entry.startDate < academicYearRange.start || entry.startDate > academicYearRange.end)
    ) {
      return NextResponse.json(
        { error: `startDate must fall within ${entry.academicYear} (${academicYearRange.label})` },
        { status: 400 }
      );
    }

    if (entry.permissionLetter?.storedPath) {
      const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "fdp-conducted") + "/";
      if (!normalizeStoredPath(entry.permissionLetter.storedPath).startsWith(ownerPrefix)) {
        return NextResponse.json({ error: "permissionLetter invalid" }, { status: 400 });
      }
    }

    if (
      Array.isArray(entry.geotaggedPhotos) &&
      entry.geotaggedPhotos.some(
        (meta) =>
          !isValidFileMeta(meta) ||
          !normalizeStoredPath(meta.storedPath).startsWith(
            path.posix.join("uploads", safeEmailDir(email), "fdp-conducted") + "/"
          )
      )
    ) {
      return NextResponse.json({ error: "geotaggedPhotos invalid" }, { status: 400 });
    }

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    if (existing && !canEditEntry(existing) && !hasRequestEditStatus) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const hasPermissionLetter = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "permissionLetter");
    const hasGeotaggedPhotos = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "geotaggedPhotos");
    const hasCoCoordinators = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "coCoordinators");
    const existingCommittedAtISO =
      typeof existing?.committedAtISO === "string" && existing.committedAtISO.trim()
        ? existing.committedAtISO
        : null;
    const requestedCommitted = isEntryCommitted({
      ...(entry as EntryStateLike),
      status: entryRecord?.status,
    });
    const nextCommitted = !!existingCommittedAtISO || requestedCommitted;
    const nextCommittedAtISO =
      existingCommittedAtISO ??
      (nextCommitted
        ? (typeof entry.committedAtISO === "string" && entry.committedAtISO.trim()
            ? entry.committedAtISO
            : now)
        : null);
    const coordinatorName =
      getCanonicalName(email) ?? existing?.coordinatorName ?? entry.coordinatorName ?? email.split("@")[0];

    const savedEntryBase: FdpConducted = {
      ...(existing ?? {
        id: entry.id,
        committedAtISO: null,
        requestEditStatus: "none",
        requestEditRequestedAtISO: null,
        requestEditMessage: "",
        academicYear: "",
        studentYear: "",
        semesterNumber: null,
        startDate: "",
        endDate: "",
        eventName: "",
        coordinatorName,
        coordinatorEmail: email,
        coCoordinators: [],
        pdfMeta: null,
        permissionLetter: null,
        geotaggedPhotos: [],
        streak: normalizeStreakState(null),
        createdAt: now,
        updatedAt: now,
      }),
      id: entry.id,
      committedAtISO: nextCommittedAtISO,
      requestEditStatus: hasRequestEditStatus
        ? normalizeRequestEditStatus(entry.requestEditStatus, existing?.requestEditStatus ?? "none")
        : existing?.requestEditStatus ?? "none",
      requestEditRequestedAtISO:
        !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "requestEditRequestedAtISO")
          ? entry.requestEditRequestedAtISO ?? null
          : existing?.requestEditRequestedAtISO ?? null,
      requestEditMessage:
        !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "requestEditMessage")
          ? entry.requestEditMessage ?? ""
          : existing?.requestEditMessage ?? "",
      academicYear: entry.academicYear || existing?.academicYear || "",
      studentYear: entry.studentYear || existing?.studentYear || "",
      semesterNumber: entry.semesterNumber ?? existing?.semesterNumber ?? null,
      startDate: entry.startDate || existing?.startDate || "",
      endDate: entry.endDate || existing?.endDate || "",
      eventName: entry.eventName || existing?.eventName || "",
      coordinatorName,
      coordinatorEmail: email,
      coCoordinators: hasCoCoordinators
        ? sanitizeCoCoordinators(entry.coCoordinators)
        : existing?.coCoordinators || [],
      pdfMeta: existing?.pdfMeta ?? null,
      pdfSourceHash: existing?.pdfSourceHash ?? "",
      pdfStale: existing?.pdfStale === true,
      permissionLetter: existing?.permissionLetter ?? null,
      geotaggedPhotos: existing?.geotaggedPhotos ?? [],
      streak: normalizeStreakState(existing?.streak ?? entry.streak),
      createdAt: existing?.createdAt || entry.createdAt || now,
      updatedAt: now,
    };
    const savedEntry = mergeWithNulls(
      savedEntryBase,
      {
        ...(entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfMeta")
          ? { pdfMeta: entry.pdfMeta }
          : {}),
        ...(entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfSourceHash")
          ? { pdfSourceHash: entry.pdfSourceHash }
          : {}),
        ...(entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfStale")
          ? { pdfStale: entry.pdfStale === true }
          : {}),
        ...(hasPermissionLetter ? { permissionLetter: entry.permissionLetter } : {}),
        ...(hasGeotaggedPhotos ? { geotaggedPhotos: entry.geotaggedPhotos } : {}),
      },
      ["pdfMeta", "pdfSourceHash", "pdfStale", "permissionLetter", "geotaggedPhotos"] as const
    );

    savedEntry.pdfStale =
      !!savedEntry.pdfMeta &&
      !!savedEntry.pdfSourceHash &&
      getPrePdfFieldsHash(savedEntry) !== savedEntry.pdfSourceHash;

    const eligible = isFutureDatedEntry(savedEntry.startDate, savedEntry.endDate);
    savedEntry.streak = buildCanonicalStreakMetadata({
      streak: savedEntry.streak,
      endDateISO: savedEntry.endDate,
      hasPdf: !!savedEntry.pdfMeta,
      isEligible: eligible,
      isCommitted: isEntryCommitted(savedEntry as EntryStateLike),
      completionSatisfied: hasCompletedUploads(savedEntry),
      nowISO: now,
    });

    const persisted = existing
      ? await updateEntry<FdpConducted>(email, "fdp-conducted", savedEntry.id, savedEntry)
      : await createEntry<FdpConducted>(email, "fdp-conducted", savedEntry);

    return NextResponse.json(normalizeEntry(persisted) ?? persisted, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Save failed");
  }
}

export async function DELETE(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { email?: string; id?: string };
    const email = normalizeEmail(String(body?.email ?? ""));
    const id = String(body?.id ?? "").trim();

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    if (safeEmailDir(email) !== safeEmailDir(authorizedEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const currentList = await readList(email);
    const target = currentList.find((item) => item.id === id) ?? null;
    if (target && !canEditEntry(target)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    await deleteEngineEntry(email, "fdp-conducted", id);

    if (target) {
      await deleteStoredFile(email, target.permissionLetter);
      await Promise.all(target.geotaggedPhotos.map((meta) => deleteStoredFile(email, meta)));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Delete failed");
  }
}
