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
import { normalizeError } from "@/lib/errors";
import { mergeWithNulls } from "@/lib/mergeWithNulls";
import { safeEmailDir } from "@/lib/userStore";
import { isEntryEditable } from "@/lib/entries/lock";
import { normalizeStreakState, type StreakState } from "@/lib/streakState";
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
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";
import type { EntryStatus } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type FdpAttended = {
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
  programName: string;
  organisingBody: string;
  supportAmount: number | null;
  pdfMeta?: PdfMeta | null;
  pdfStale?: boolean;
  pdfSourceHash?: string;
  pdfGenerated?: boolean;
  pdfGeneratedAt?: string | null;
  editWindowExpiresAt?: string | null;
  streakEligible?: boolean;
  streakPermanentlyRemoved?: boolean;
  permanentlyLocked?: boolean;
  permissionLetter: FileMeta | null;
  completionCertificate: FileMeta | null;
  streak: StreakState;
  createdAt: string;
  updatedAt: string;
};

const ACADEMIC_YEAR_OPTIONS = new Set([
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
]);

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

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

function normalizeRequestEditStatus(
  value: unknown,
  fallback: RequestEditStatus = "none"
) {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : fallback;
}

function getPrePdfFieldsHash(entry: Record<string, unknown>) {
  return hashPrePdfFields(entry, "fdp-attended");
}

function normalizeEntry(value: unknown): FdpAttended | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  let semesterNumber: number | null = null;
  if (typeof record.semesterNumber === "number" && Number.isFinite(record.semesterNumber)) {
    semesterNumber = record.semesterNumber;
  } else if (typeof record.semesterNumber === "string" && record.semesterNumber.trim()) {
    const parsed = Number(record.semesterNumber);
    semesterNumber = Number.isFinite(parsed) ? parsed : null;
  }

  const normalized: FdpAttended = {
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
    programName: String(record.programName ?? "").trim(),
    organisingBody: String(record.organisingBody ?? "").trim(),
    supportAmount:
      typeof record.supportAmount === "number" && Number.isFinite(record.supportAmount)
        ? record.supportAmount
        : null,
    pdfMeta: isValidPdfMeta((record.pdfMeta as PdfMeta | null) ?? null)
      ? ((record.pdfMeta as PdfMeta | null) ?? null)
      : null,
    pdfStale: record.pdfStale === true,
    pdfSourceHash: typeof record.pdfSourceHash === "string" ? record.pdfSourceHash : "",
    pdfGenerated: record.pdfGenerated === true,
    pdfGeneratedAt:
      typeof record.pdfGeneratedAt === "string" && record.pdfGeneratedAt.trim()
        ? record.pdfGeneratedAt.trim()
        : null,
    editWindowExpiresAt:
      typeof record.editWindowExpiresAt === "string" && record.editWindowExpiresAt.trim()
        ? record.editWindowExpiresAt.trim()
        : null,
    streakEligible: record.streakEligible === true,
    streakPermanentlyRemoved: record.streakPermanentlyRemoved === true,
    permanentlyLocked: record.permanentlyLocked === true,
    permissionLetter: isValidFileMeta((record.permissionLetter as FileMeta | null) ?? null)
      ? ((record.permissionLetter as FileMeta | null) ?? null)
      : null,
    completionCertificate: isValidFileMeta((record.completionCertificate as FileMeta | null) ?? null)
      ? ((record.completionCertificate as FileMeta | null) ?? null)
      : null,
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

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
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

async function readList(email: string): Promise<FdpAttended[]> {
  return listEntriesForCategory(email, "fdp-attended", normalizeEntry);
}

function resolveOwnedStoredPath(email: string, storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }

  const safeEmail = safeEmailDir(email);
  const ownerPrefix = `${safeEmail}/fdp-attended/`;

  if (!normalized.startsWith(ownerPrefix)) {
    throw new Error("Forbidden");
  }

  const absolutePath = path.join(UPLOADS_ROOT, normalized);
  const relativeToRoot = path.relative(UPLOADS_ROOT, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid storedPath");
  }

  return absolutePath;
}

async function deleteStoredFile(email: string, meta: FileMeta | null) {
  if (!meta?.storedPath) return;

  try {
    const filePath = resolveOwnedStoredPath(email, meta.storedPath);
    await fs.unlink(filePath).catch(() => null);
  } catch {
    return;
  }
}

function canEditEntry(entry: FdpAttended) {
  return isEntryEditable(entry);
}

function hasCompletedUploads(entry: Pick<FdpAttended, "permissionLetter" | "completionCertificate">) {
  return isValidFileMeta(entry.permissionLetter) && isValidFileMeta(entry.completionCertificate);
}

function validateCoreFields(entry: FdpAttended) {
  const programName = entry.programName.trim();
  const organisingBody = entry.organisingBody.trim();
  const academicYear = entry.academicYear.trim();
  const studentYear = normalizeStudentYear(String(entry.studentYear ?? "").trim()) ?? "";
  const semesterNumber =
    typeof entry.semesterNumber === "number" && Number.isFinite(entry.semesterNumber)
      ? entry.semesterNumber
      : null;
  const startDate = entry.startDate.trim();
  const endDate = entry.endDate.trim();
  const supportAmount =
    typeof entry.supportAmount === "number" && Number.isFinite(entry.supportAmount) && entry.supportAmount >= 0
      ? entry.supportAmount
      : null;

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

  if (!programName) {
    return { error: "programName required" };
  }

  if (!organisingBody) {
    return { error: "organisingBody required" };
  }

  return {
    academicYear,
    studentYear,
    semesterNumber,
    startDate,
    endDate,
    programName,
    organisingBody,
    supportAmount,
  };
}

export async function GET() {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await readList(email), { status: 200 });
}

export async function POST(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "entry.create.fdp-attended",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
    const body = (await request.json()) as { entry?: unknown };
    const entryRecord =
      body?.entry && typeof body.entry === "object" ? (body.entry as Record<string, unknown>) : null;
    const entry = normalizeEntry(body?.entry);

    if (!entry?.id) {
      return NextResponse.json({ error: "entry.id required" }, { status: 400 });
    }

    const validated = validateCoreFields(entry);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    if (entry.permissionLetter?.storedPath) {
      resolveOwnedStoredPath(email, entry.permissionLetter.storedPath);
    }
    if (entry.completionCertificate?.storedPath) {
      resolveOwnedStoredPath(email, entry.completionCertificate.storedPath);
    }

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    if (existing && !canEditEntry(existing)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    const now = new Date().toISOString();
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
      startDateISO: validated.startDate,
      endDateISO: validated.endDate,
      hasPdf: !!entry.pdfMeta,
      isCommitted: nextCommitted,
      completionSatisfied: hasCompletedUploads(entry),
      nowISO: now,
    });

    const savedEntry: FdpAttended = {
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
      programName: validated.programName,
      organisingBody: validated.organisingBody,
      supportAmount: validated.supportAmount,
      pdfMeta: entry.pdfMeta ?? existing?.pdfMeta ?? null,
      pdfSourceHash: entry.pdfSourceHash || existing?.pdfSourceHash || "",
      pdfStale: entry.pdfStale === true,
      permissionLetter: entry.permissionLetter,
      completionCertificate: entry.completionCertificate,
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
      if (existing.completionCertificate?.storedPath !== savedEntry.completionCertificate?.storedPath) {
        await deleteStoredFile(email, existing.completionCertificate);
      }
    }

    const persisted = existing
      ? await updateEntry<FdpAttended>(email, "fdp-attended", savedEntry.id, savedEntry)
      : await createEntry<FdpAttended>(email, "fdp-attended", savedEntry);
    return NextResponse.json(normalizeEntry(persisted) ?? persisted, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Save failed");
  }
}

export async function PATCH(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { entry?: unknown };
    const entryRecord =
      body?.entry && typeof body.entry === "object" ? (body.entry as Record<string, unknown>) : null;
    const entry = normalizeEntry(body?.entry);

    if (!entry?.id) {
      return NextResponse.json({ error: "entry.id required" }, { status: 400 });
    }

    const hasRequestEditStatus =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "requestEditStatus");

    if (entry.permissionLetter?.storedPath) {
      resolveOwnedStoredPath(email, entry.permissionLetter.storedPath);
    }

    if (entry.completionCertificate?.storedPath) {
      resolveOwnedStoredPath(email, entry.completionCertificate.storedPath);
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

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    if (existing && !canEditEntry(existing) && !hasRequestEditStatus) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const hasPermissionLetter =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "permissionLetter");
    const hasCompletionCertificate =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "completionCertificate");
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
    const savedEntryBase: FdpAttended = {
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
        programName: "",
        organisingBody: "",
        supportAmount: null,
        pdfMeta: null,
        permissionLetter: null,
        completionCertificate: null,
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
      programName: entry.programName || existing?.programName || "",
      organisingBody: entry.organisingBody || existing?.organisingBody || "",
      supportAmount: entry.supportAmount ?? existing?.supportAmount ?? null,
      pdfMeta: existing?.pdfMeta ?? null,
      pdfSourceHash: existing?.pdfSourceHash ?? "",
      pdfStale: existing?.pdfStale === true,
      permissionLetter: existing?.permissionLetter ?? null,
      completionCertificate: existing?.completionCertificate ?? null,
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
        ...(hasCompletionCertificate ? { completionCertificate: entry.completionCertificate } : {}),
      },
      ["pdfMeta", "pdfSourceHash", "pdfStale", "permissionLetter", "completionCertificate"] as const
    );

    savedEntry.pdfStale =
      !!savedEntry.pdfMeta &&
      !!savedEntry.pdfSourceHash &&
      getPrePdfFieldsHash(savedEntry) !== savedEntry.pdfSourceHash;

    savedEntry.streak = buildCanonicalStreakMetadata({
      streak: savedEntry.streak,
      startDateISO: savedEntry.startDate,
      endDateISO: savedEntry.endDate,
      hasPdf: !!savedEntry.pdfMeta,
      isCommitted: isEntryCommitted(savedEntry as EntryStateLike),
      completionSatisfied: hasCompletedUploads(savedEntry),
      nowISO: now,
    });

    const persisted = existing
      ? await updateEntry<FdpAttended>(email, "fdp-attended", savedEntry.id, savedEntry)
      : await createEntry<FdpAttended>(email, "fdp-attended", savedEntry);

    return NextResponse.json(normalizeEntry(persisted) ?? persisted, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Save failed");
  }
}

export async function DELETE(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string };
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const currentList = await readList(email);
    const target = currentList.find((item) => item.id === id) ?? null;
    if (target && !canEditEntry(target)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    await deleteEngineEntry(email, "fdp-attended", id);

    if (target) {
      await deleteStoredFile(email, target.permissionLetter);
      await deleteStoredFile(email, target.completionCertificate);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Delete failed");
  }
}
