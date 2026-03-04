import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  cloneOptionalFileArrayToTarget,
  cloneOptionalFileToTarget,
  shouldShareEntry,
} from "@/lib/entrySharing.server";
import { isValidPdfMeta, type PdfMeta } from "@/lib/entry-pdf";
import {
  findFacultyByEmail,
  findFacultyByName,
  getCanonicalName,
  normalizeEmail,
  type Faculty,
} from "@/lib/facultyDirectory";
import {
  computeDueAtISO,
  isEntryEditable,
  isFutureDatedEntry,
  isWithinDueWindow,
  normalizeStreakState,
  type StreakState,
} from "@/lib/gamification";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";
import { getUserCategoryStoreFile, safeEmailDir } from "@/lib/userStore";

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

type RequestEditStatus = "none" | "pending" | "approved" | "rejected";

type Uploads = {
  permissionLetter: FileMeta | null;
  brochure: FileMeta | null;
  attendance: FileMeta | null;
  organiserProfile: FileMeta | null;
  geotaggedPhotos: FileMeta[];
};

type WorkshopEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "coCoordinator";
  status?: "draft" | "final";
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  semesterType: string;
  startDate: string;
  endDate: string;
  eventName: string;
  speakerName: string;
  organisationName: string;
  coordinator: FacultySelection;
  coCoordinators: FacultySelection[];
  participants?: number | null;
  pdfMeta?: PdfMeta | null;
  pdfSourceHash?: string | null;
  pdfStale?: boolean;
  uploads: Uploads;
  streak?: StreakState;
  createdAt: string;
  updatedAt: string;
};

const ACADEMIC_YEAR_OPTIONS = new Set([
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
]);
const SEMESTER_TYPE_OPTIONS = new Set(["Odd", "Even"]);
const REQUIRED_SINGLE_SLOTS: Array<keyof Omit<Uploads, "geotaggedPhotos">> = [
  "permissionLetter",
  "brochure",
  "attendance",
  "organiserProfile",
];

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function getAcademicYearRange(academicYear: string) {
  const match = academicYear.match(/^Academic Year (\d{4})-(\d{4})$/);
  if (!match) return null;

  return {
    start: `${match[1]}-07-01`,
    end: `${match[2]}-06-30`,
    label: `Jul 1, ${match[1]} to Jun 30, ${match[2]}`,
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

function normalizeStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }

  return normalized;
}

function normalizeFileMetaArray(value: unknown, legacyValue?: unknown) {
  const raw = Array.isArray(value)
    ? value
    : legacyValue
      ? [legacyValue]
      : [];

  return raw.filter((item): item is FileMeta => isValidFileMeta((item as FileMeta | null) ?? null));
}

function normalizeFacultySelection(value: unknown): FacultySelection {
  if (typeof value === "string") {
    return { id: undefined, name: value.trim(), email: "", isLocked: false, savedAtISO: null };
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

function normalizeUploads(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    permissionLetter: (record.permissionLetter as FileMeta | null) ?? null,
    brochure: (record.brochure as FileMeta | null) ?? null,
    attendance: (record.attendance as FileMeta | null) ?? null,
    organiserProfile: (record.organiserProfile as FileMeta | null) ?? null,
    geotaggedPhotos: normalizeFileMetaArray(record.geotaggedPhotos, record.geotaggedPhoto),
  };
}

function normalizeRequestEditStatus(
  value: unknown,
  fallback: RequestEditStatus = "none"
): RequestEditStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : fallback;
}

function normalizeEntry(value: unknown): WorkshopEntry | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const coordinator =
    record.coordinator && typeof record.coordinator === "object"
      ? normalizeFacultySelection(record.coordinator)
      : canonicalizeFacultySelection({
          name: String(record.coordinatorName ?? "").trim(),
          email: normalizeEmail(String(record.coordinatorEmail ?? "")),
        });
  const coCoordinators = Array.isArray(record.coCoordinators)
    ? record.coCoordinators.map(normalizeFacultySelection).filter((item) => item.name || item.email)
    : [];

  const normalized: WorkshopEntry = {
    id: String(record.id ?? "").trim(),
    sharedEntryId: String(record.sharedEntryId ?? "").trim() || undefined,
    sourceEmail: String(record.sourceEmail ?? "").trim() || undefined,
    sharedRole: record.sharedRole === "coCoordinator" ? "coCoordinator" : undefined,
    status: record.status === "final" ? "final" : "draft",
    requestEditStatus: normalizeRequestEditStatus(record.requestEditStatus),
    requestEditRequestedAtISO:
      typeof record.requestEditRequestedAtISO === "string" && record.requestEditRequestedAtISO.trim()
        ? record.requestEditRequestedAtISO.trim()
        : null,
    academicYear: String(record.academicYear ?? "").trim(),
    semesterType: String(record.semesterType ?? "").trim(),
    startDate: String(record.startDate ?? "").trim(),
    endDate: String(record.endDate ?? "").trim(),
    eventName: String(record.eventName ?? "").trim(),
    speakerName: String(record.speakerName ?? "").trim(),
    organisationName: String(record.organisationName ?? "").trim(),
    coordinator,
    coCoordinators,
    participants:
      typeof record.participants === "number" && Number.isFinite(record.participants)
        ? record.participants
        : typeof record.participants === "string" && record.participants.trim()
          ? Number(record.participants)
          : null,
    pdfMeta: isValidPdfMeta((record.pdfMeta as PdfMeta | null) ?? null)
      ? ((record.pdfMeta as PdfMeta | null) ?? null)
      : null,
    pdfSourceHash: typeof record.pdfSourceHash === "string" ? record.pdfSourceHash : "",
    pdfStale: record.pdfStale === true,
    uploads: normalizeUploads(record.uploads),
    streak: normalizeStreakState(record.streak),
    createdAt: String(record.createdAt ?? "").trim(),
    updatedAt: String(record.updatedAt ?? "").trim(),
  };

  if (normalized.pdfMeta && !normalized.pdfSourceHash) {
    normalized.pdfSourceHash = hashPrePdfFields(normalized, "workshops");
  }

  normalized.pdfStale =
    !!normalized.pdfMeta &&
    !!normalized.pdfSourceHash &&
    hashPrePdfFields(normalized, "workshops") !== normalized.pdfSourceHash;

  return normalized;
}

function buildSavedStreak(
  entry: Pick<WorkshopEntry, "status" | "pdfMeta" | "startDate" | "endDate" | "streak" | "uploads">
) {
  const normalized = normalizeStreakState(entry.streak);
  const eligible = isFutureDatedEntry(entry.startDate, entry.endDate);
  const uploadsComplete =
    isValidFileMeta(entry.uploads.permissionLetter) &&
    isValidFileMeta(entry.uploads.brochure) &&
    isValidFileMeta(entry.uploads.attendance) &&
    isValidFileMeta(entry.uploads.organiserProfile) &&
    entry.uploads.geotaggedPhotos.length > 0;

  if (!entry.pdfMeta || !eligible) {
    return normalizeStreakState(null);
  }

  const dueAtISO = normalized.dueAtISO ?? computeDueAtISO(entry.endDate);
  return {
    ...normalized,
    activatedAtISO: normalized.activatedAtISO ?? null,
    dueAtISO,
    completedAtISO:
      entry.status === "final" &&
      normalized.activatedAtISO &&
      uploadsComplete &&
      dueAtISO &&
      isWithinDueWindow(dueAtISO)
        ? normalized.completedAtISO ?? new Date().toISOString()
        : normalized.completedAtISO ?? null,
  };
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
}

function getStoreFile(email: string) {
  return getUserCategoryStoreFile(email, "workshops.json");
}

async function readList(email: string): Promise<WorkshopEntry[]> {
  const filePath = getStoreFile(email);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(normalizeEntry).filter((entry): entry is WorkshopEntry => !!entry)
      : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: WorkshopEntry[]) {
  const filePath = getStoreFile(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
}

async function deleteStoredFile(email: string, meta: FileMeta | null) {
  if (!meta?.storedPath) return;

  try {
    const normalized = normalizeStoredPath(meta.storedPath);
    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "workshops") + "/";

    if (!normalized.startsWith(ownerPrefix)) {
      return;
    }

    await fs.unlink(path.join(process.cwd(), "public", normalized)).catch(() => null);
  } catch {
    return;
  }
}

function buildTargetEmails(selections: FacultySelection[], creatorEmail: string) {
  const seen = new Set<string>();
  const targets: Faculty[] = [];

  for (const selection of selections) {
    const normalized = normalizeEmail(selection.email);
    if (!normalized || normalized === creatorEmail || seen.has(normalized)) continue;

    const faculty = findFacultyByEmail(normalized);
    if (!faculty) continue;

    seen.add(normalized);
    targets.push(faculty);
  }

  return targets;
}

export async function GET(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = normalizeEmail(String(searchParams.get("email") ?? ""));

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

    if (!ACADEMIC_YEAR_OPTIONS.has(entry.academicYear)) {
      return NextResponse.json({ error: "academicYear required" }, { status: 400 });
    }

    if (!SEMESTER_TYPE_OPTIONS.has(entry.semesterType)) {
      return NextResponse.json({ error: "semesterType required" }, { status: 400 });
    }

    if (!isISODate(entry.startDate)) {
      return NextResponse.json({ error: "startDate required" }, { status: 400 });
    }

    const academicYearRange = getAcademicYearRange(entry.academicYear);
    if (academicYearRange && (entry.startDate < academicYearRange.start || entry.startDate > academicYearRange.end)) {
      return NextResponse.json(
        { error: `startDate must fall within ${entry.academicYear} (${academicYearRange.label})` },
        { status: 400 }
      );
    }

    if (!isISODate(entry.endDate)) {
      return NextResponse.json({ error: "endDate required" }, { status: 400 });
    }

    if (entry.endDate < entry.startDate) {
      return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
    }

    if (!entry.eventName) {
      return NextResponse.json({ error: "eventName required" }, { status: 400 });
    }

    if (!entry.speakerName) {
      return NextResponse.json({ error: "speakerName required" }, { status: 400 });
    }

    if (!entry.organisationName) {
      return NextResponse.json({ error: "organisationName required" }, { status: 400 });
    }

    const coordinator = {
      email,
      name: getCanonicalName(email) ?? entry.coordinator.name ?? email.split("@")[0],
    };

    const coCoordinators = entry.coCoordinators
      .map(canonicalizeFacultySelection)
      .filter((item) => item.name || item.email);

    if (coCoordinators.some((item) => !item.email || !findFacultyByEmail(item.email))) {
      return NextResponse.json({ error: "coCoordinators invalid" }, { status: 400 });
    }

    const selectedEmails = [coordinator.email, ...coCoordinators.map((item) => item.email)];
    if (new Set(selectedEmails).size !== selectedEmails.length) {
      return NextResponse.json({ error: "duplicate faculty selection" }, { status: 400 });
    }

    const participants =
      entry.participants === null || entry.participants === undefined
        ? null
        : typeof entry.participants === "number" &&
            Number.isFinite(entry.participants) &&
            entry.participants > 0
          ? entry.participants
          : NaN;

    if (Number.isNaN(participants)) {
      return NextResponse.json({ error: "participants invalid" }, { status: 400 });
    }

    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "workshops") + "/";
    for (const slot of REQUIRED_SINGLE_SLOTS) {
      const meta = entry.uploads[slot];
      if (meta && !normalizeStoredPath(meta.storedPath).startsWith(ownerPrefix)) {
        return NextResponse.json({ error: `${slot} invalid` }, { status: 400 });
      }
    }

    if (
      entry.uploads.geotaggedPhotos.some(
        (meta) => !isValidFileMeta(meta) || !normalizeStoredPath(meta.storedPath).startsWith(ownerPrefix)
      )
    ) {
      return NextResponse.json({ error: "geotaggedPhotos invalid" }, { status: 400 });
    }

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    if (existing && !isEntryEditable(existing)) {
      return NextResponse.json({ error: "Entry locked; request edit." }, { status: 403 });
    }
    const now = new Date().toISOString();
    const sharedEntryId = existing?.sharedEntryId ?? entry.sharedEntryId ?? entry.id;

    const savedEntry: WorkshopEntry = {
      id: entry.id,
      sharedEntryId,
      sourceEmail: email,
      status: entry.status === "final" ? "final" : "draft",
      academicYear: entry.academicYear,
      semesterType: entry.semesterType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      eventName: entry.eventName,
      speakerName: entry.speakerName,
      organisationName: entry.organisationName,
      coordinator: {
        email: coordinator.email,
        name: getCanonicalName(coordinator.email) ?? coordinator.name,
      },
      coCoordinators: coCoordinators.map((item) => ({
        id: item.id,
        email: item.email,
        name: getCanonicalName(item.email) ?? item.name,
        isLocked: item.isLocked === true,
        savedAtISO: item.savedAtISO ?? null,
      })),
      participants,
      pdfMeta: entry.status === "final" ? entry.pdfMeta ?? null : null,
      pdfSourceHash:
        entry.status === "final"
          ? entry.pdfSourceHash || existing?.pdfSourceHash || ""
          : "",
      pdfStale: entry.status === "final" ? entry.pdfStale === true : false,
      uploads: entry.uploads,
      streak: buildSavedStreak({
        status: entry.status === "final" ? "final" : "draft",
        pdfMeta: entry.status === "final" ? entry.pdfMeta ?? null : null,
        startDate: entry.startDate,
        endDate: entry.endDate,
        streak: entry.streak,
        uploads: entry.uploads,
      }),
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

    savedEntry.pdfStale =
      !!savedEntry.pdfMeta &&
      !!savedEntry.pdfSourceHash &&
      hashPrePdfFields(savedEntry, "workshops") !== savedEntry.pdfSourceHash;

    if (existing) {
      for (const slot of REQUIRED_SINGLE_SLOTS) {
        if (existing.uploads[slot]?.storedPath !== savedEntry.uploads[slot]?.storedPath) {
          await deleteStoredFile(email, existing.uploads[slot]);
        }
      }

      const nextPhotoPaths = new Set(savedEntry.uploads.geotaggedPhotos.map((meta) => meta.storedPath));
      for (const meta of existing.uploads.geotaggedPhotos) {
        if (!nextPhotoPaths.has(meta.storedPath)) {
          await deleteStoredFile(email, meta);
        }
      }
    }

    const next = existing
      ? currentList.map((item) => (item.id === savedEntry.id ? savedEntry : item))
      : [savedEntry, ...currentList];

    await writeList(email, next);

    if (shouldShareEntry(savedEntry)) {
      try {
        const targets = buildTargetEmails(savedEntry.coCoordinators, email);
        for (const target of targets) {
          const targetList = await readList(target.email);
          if (targetList.some((item) => item.sharedEntryId === sharedEntryId || item.id === sharedEntryId)) {
            continue;
          }

          const clonedEntry: WorkshopEntry = {
            ...savedEntry,
            id: sharedEntryId,
            sharedEntryId,
            sourceEmail: email,
            sharedRole: "coCoordinator",
            uploads: {
              permissionLetter: await cloneOptionalFileToTarget(
                savedEntry.uploads.permissionLetter,
                target.email,
                "workshops",
                sharedEntryId,
                "permissionLetter"
              ),
              brochure: await cloneOptionalFileToTarget(
                savedEntry.uploads.brochure,
                target.email,
                "workshops",
                sharedEntryId,
                "brochure"
              ),
              attendance: await cloneOptionalFileToTarget(
                savedEntry.uploads.attendance,
                target.email,
                "workshops",
                sharedEntryId,
                "attendance"
              ),
              organiserProfile: await cloneOptionalFileToTarget(
                savedEntry.uploads.organiserProfile,
                target.email,
                "workshops",
                sharedEntryId,
                "organiserProfile"
              ),
              geotaggedPhotos: await cloneOptionalFileArrayToTarget(
                savedEntry.uploads.geotaggedPhotos,
                target.email,
                "workshops",
                sharedEntryId,
                "geotaggedPhotos"
              ),
            },
            createdAt: now,
            updatedAt: now,
          };

          await writeList(target.email, [clonedEntry, ...targetList]);
        }
      } catch (error) {
        console.error("Workshops share failed", error);
      }
    }

    return NextResponse.json(savedEntry, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
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

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    if (safeEmailDir(email) !== safeEmailDir(authorizedEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!entry?.id) {
      return NextResponse.json({ error: "entry.id required" }, { status: 400 });
    }

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    if (existing && !isEntryEditable(existing)) {
      return NextResponse.json({ error: "Entry locked; request edit." }, { status: 403 });
    }
    const now = new Date().toISOString();
    const sharedEntryId = existing?.sharedEntryId ?? entry.sharedEntryId ?? entry.id;

    const hasAcademicYear = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "academicYear");
    const hasSemesterType = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "semesterType");
    const hasStartDate = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "startDate");
    const hasEndDate = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "endDate");
    const hasEventName = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "eventName");
    const hasSpeakerName = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "speakerName");
    const hasOrganisationName =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "organisationName");
    const hasCoCoordinators = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "coCoordinators");
    const hasParticipants = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "participants");
    const hasUploads = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "uploads");

    if (hasAcademicYear && entry.academicYear && !ACADEMIC_YEAR_OPTIONS.has(entry.academicYear)) {
      return NextResponse.json({ error: "academicYear invalid" }, { status: 400 });
    }

    if (hasSemesterType && entry.semesterType && !SEMESTER_TYPE_OPTIONS.has(entry.semesterType)) {
      return NextResponse.json({ error: "semesterType invalid" }, { status: 400 });
    }

    if (hasStartDate && entry.startDate && !isISODate(entry.startDate)) {
      return NextResponse.json({ error: "startDate invalid" }, { status: 400 });
    }

    if (hasEndDate && entry.endDate && !isISODate(entry.endDate)) {
      return NextResponse.json({ error: "endDate invalid" }, { status: 400 });
    }

    const nextAcademicYear = (hasAcademicYear ? entry.academicYear : existing?.academicYear) ?? "";
    const nextStartDate = (hasStartDate ? entry.startDate : existing?.startDate) ?? "";
    const nextEndDate = (hasEndDate ? entry.endDate : existing?.endDate) ?? "";
    const academicYearRange = nextAcademicYear ? getAcademicYearRange(nextAcademicYear) : null;

    if (academicYearRange && nextStartDate && (nextStartDate < academicYearRange.start || nextStartDate > academicYearRange.end)) {
      return NextResponse.json(
        { error: `startDate must fall within ${nextAcademicYear} (${academicYearRange.label})` },
        { status: 400 }
      );
    }

    if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
      return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
    }

    const coordinator = {
      email,
      name: getCanonicalName(email) ?? entry.coordinator.name ?? existing?.coordinator.name ?? email.split("@")[0],
    };

    const nextCoCoordinators = hasCoCoordinators
      ? entry.coCoordinators.map(canonicalizeFacultySelection).filter((item) => item.name || item.email)
      : existing?.coCoordinators || [];

    if (nextCoCoordinators.some((item) => !item.email || !findFacultyByEmail(item.email))) {
      return NextResponse.json({ error: "coCoordinators invalid" }, { status: 400 });
    }

    const selectedEmails = [coordinator.email, ...nextCoCoordinators.map((item) => item.email)];
    if (new Set(selectedEmails).size !== selectedEmails.length) {
      return NextResponse.json({ error: "duplicate faculty selection" }, { status: 400 });
    }

    if (
      hasParticipants &&
      entry.participants !== null &&
      entry.participants !== undefined &&
      (!Number.isFinite(entry.participants) || entry.participants <= 0)
    ) {
      return NextResponse.json({ error: "participants invalid" }, { status: 400 });
    }

    const nextUploads = hasUploads ? normalizeUploads(entryRecord?.uploads) : existing?.uploads ?? normalizeUploads(null);
    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "workshops") + "/";
    for (const meta of [
      nextUploads.permissionLetter,
      nextUploads.brochure,
      nextUploads.attendance,
      nextUploads.organiserProfile,
    ]) {
      if (meta?.storedPath && !normalizeStoredPath(meta.storedPath).startsWith(ownerPrefix)) {
        return NextResponse.json({ error: "uploads invalid" }, { status: 400 });
      }
    }
    if (
      nextUploads.geotaggedPhotos.some(
        (meta) => !isValidFileMeta(meta) || !normalizeStoredPath(meta.storedPath).startsWith(ownerPrefix)
      )
    ) {
      return NextResponse.json({ error: "geotaggedPhotos invalid" }, { status: 400 });
    }

    const savedEntry: WorkshopEntry = {
      ...(existing ?? {
        id: entry.id,
        status: "draft",
        requestEditStatus: "none",
        requestEditRequestedAtISO: null,
        coordinator,
        coCoordinators: [],
        participants: null,
        pdfMeta: null,
        pdfSourceHash: "",
        pdfStale: false,
        uploads: normalizeUploads(null),
        streak: normalizeStreakState(null),
        academicYear: "",
        semesterType: "",
        startDate: "",
        endDate: "",
        eventName: "",
        speakerName: "",
        organisationName: "",
        createdAt: now,
        updatedAt: now,
      }),
      id: entry.id,
      status: entry.status === "final" ? "final" : existing?.status ?? "draft",
      requestEditStatus: normalizeRequestEditStatus(entry.requestEditStatus, existing?.requestEditStatus ?? "none"),
      requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? existing?.requestEditRequestedAtISO ?? null,
      academicYear: hasAcademicYear ? entry.academicYear : existing?.academicYear ?? "",
      semesterType: hasSemesterType ? entry.semesterType : existing?.semesterType ?? "",
      startDate: hasStartDate ? entry.startDate : existing?.startDate ?? "",
      endDate: hasEndDate ? entry.endDate : existing?.endDate ?? "",
      eventName: hasEventName ? entry.eventName : existing?.eventName ?? "",
      speakerName: hasSpeakerName ? entry.speakerName : existing?.speakerName ?? "",
      organisationName: hasOrganisationName ? entry.organisationName : existing?.organisationName ?? "",
      coordinator: {
        email: coordinator.email,
        name: getCanonicalName(coordinator.email) ?? coordinator.name,
      },
      coCoordinators: nextCoCoordinators.map((item) => ({
        id: item.id,
        email: item.email,
        name: getCanonicalName(item.email) ?? item.name,
        isLocked: item.isLocked === true,
        savedAtISO: item.savedAtISO ?? null,
      })),
      participants:
        Object.prototype.hasOwnProperty.call(entryRecord ?? {}, "participants")
          ? entry.participants
          : existing?.participants ?? null,
      pdfMeta:
        entry.status === "final"
          ? (entry.pdfMeta ?? existing?.pdfMeta ?? null)
          : null,
      pdfSourceHash:
        entry.status === "final"
          ? (entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfSourceHash")
              ? (entry.pdfSourceHash ?? "")
              : (existing?.pdfSourceHash ?? ""))
          : "",
      pdfStale:
        entry.status === "final"
          ? (entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfStale")
              ? entry.pdfStale === true
              : existing?.pdfStale === true)
          : false,
      uploads: nextUploads,
      streak: buildSavedStreak({
        status: entry.status === "final" ? "final" : existing?.status ?? "draft",
        pdfMeta:
          entry.status === "final"
            ? (entry.pdfMeta ?? existing?.pdfMeta ?? null)
            : null,
        startDate: hasStartDate ? entry.startDate : existing?.startDate ?? "",
        endDate: hasEndDate ? entry.endDate : existing?.endDate ?? "",
        streak: entry.streak ?? existing?.streak,
        uploads: nextUploads,
      }),
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

    savedEntry.pdfStale =
      !!savedEntry.pdfMeta &&
      !!savedEntry.pdfSourceHash &&
      hashPrePdfFields(savedEntry, "workshops") !== savedEntry.pdfSourceHash;

    await writeList(
      email,
      existing
        ? currentList.map((item) => (item.id === savedEntry.id ? savedEntry : item))
        : [savedEntry, ...currentList]
    );

    if (shouldShareEntry(savedEntry)) {
      try {
        const targets = buildTargetEmails(savedEntry.coCoordinators, email);
        for (const target of targets) {
          const targetList = await readList(target.email);
          if (targetList.some((item) => item.sharedEntryId === sharedEntryId || item.id === sharedEntryId)) {
            continue;
          }

          const clonedEntry: WorkshopEntry = {
            ...savedEntry,
            id: sharedEntryId,
            sharedEntryId,
            sourceEmail: email,
            sharedRole: "coCoordinator",
            uploads: {
              permissionLetter: await cloneOptionalFileToTarget(
                savedEntry.uploads.permissionLetter,
                target.email,
                "workshops",
                sharedEntryId,
                "permissionLetter"
              ),
              brochure: await cloneOptionalFileToTarget(
                savedEntry.uploads.brochure,
                target.email,
                "workshops",
                sharedEntryId,
                "brochure"
              ),
              attendance: await cloneOptionalFileToTarget(
                savedEntry.uploads.attendance,
                target.email,
                "workshops",
                sharedEntryId,
                "attendance"
              ),
              organiserProfile: await cloneOptionalFileToTarget(
                savedEntry.uploads.organiserProfile,
                target.email,
                "workshops",
                sharedEntryId,
                "organiserProfile"
              ),
              geotaggedPhotos: await cloneOptionalFileArrayToTarget(
                savedEntry.uploads.geotaggedPhotos,
                target.email,
                "workshops",
                sharedEntryId,
                "geotaggedPhotos"
              ),
            },
            createdAt: now,
            updatedAt: now,
          };

          await writeList(target.email, [clonedEntry, ...targetList]);
        }
      } catch (error) {
        console.error("Workshops share failed", error);
      }
    }

    return NextResponse.json(savedEntry, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
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
    if (target && !isEntryEditable(target)) {
      return NextResponse.json({ error: "Entry locked; request edit." }, { status: 403 });
    }
    await writeList(
      email,
      currentList.filter((item) => item.id !== id)
    );

    if (target) {
      for (const slot of REQUIRED_SINGLE_SLOTS) {
        await deleteStoredFile(email, target.uploads[slot]);
      }
      await Promise.all(target.uploads.geotaggedPhotos.map((meta) => deleteStoredFile(email, meta)));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
