import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  createEntry,
  deleteEntry as deleteEngineEntry,
  listEntriesForCategory,
  replaceEntriesForCategory,
  updateEntry,
} from "@/lib/entryEngine";
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
import {
  isSemesterAllowed,
  normalizeStudentYear,
  type StudentYear,
} from "@/lib/student-academic";
import { safeEmailDir } from "@/lib/userStore";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type StaffSelection = {
  id?: string;
  name: string;
  email: string;
  isLocked?: boolean;
  savedAtISO?: string | null;
};

type RequestEditStatus = "none" | "pending" | "approved" | "rejected";

type CaseStudyEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "staffAccompanying";
  status?: "draft" | "final";
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  academicYear: string;
  semesterType: string;
  startDate: string;
  endDate: string;
  coordinator: StaffSelection;
  placeOfVisit: string;
  purposeOfVisit: string;
  staffAccompanying: StaffSelection[];
  studentYear: StudentYear | "";
  semesterNumber: number | null;
  participants: number | null;
  amountSupport: number | null;
  pdfMeta?: PdfMeta | null;
  pdfSourceHash?: string | null;
  pdfStale?: boolean;
  permissionLetter: FileMeta | null;
  travelPlan: FileMeta | null;
  geotaggedPhotos: FileMeta[];
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

function normalizeStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }

  return normalized;
}

function normalizeStaffSelection(value: unknown): StaffSelection {
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

function canonicalizeStaffSelection(value: StaffSelection) {
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

function buildStaffKey(selection: StaffSelection) {
  if (selection.email) return `email:${selection.email.toLowerCase()}`;
  return `name:${selection.name.trim().toLowerCase()}`;
}

function normalizeRequestEditStatus(
  value: unknown,
  fallback: RequestEditStatus = "none"
): RequestEditStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : fallback;
}

function normalizeEntry(value: unknown): CaseStudyEntry | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const rawStaff = Array.isArray(record.staffAccompanying) ? record.staffAccompanying : [];
  const staffAccompanying = rawStaff
    .map(normalizeStaffSelection)
    .filter((staff) => staff.name || staff.email);
  const coordinator =
    record.coordinator && typeof record.coordinator === "object"
      ? normalizeStaffSelection(record.coordinator)
      : { name: "", email: "" };

  let semesterNumber: number | null = null;
  if (typeof record.semesterNumber === "number" && Number.isFinite(record.semesterNumber)) {
    semesterNumber = record.semesterNumber;
  } else if (typeof record.semesterNumber === "string" && record.semesterNumber.trim()) {
    const parsed = Number(record.semesterNumber);
    semesterNumber = Number.isFinite(parsed) ? parsed : null;
  }

  let amountSupport: number | null = null;
  if (typeof record.amountSupport === "number" && Number.isFinite(record.amountSupport)) {
    amountSupport = record.amountSupport;
  } else if (typeof record.amountSupport === "string" && record.amountSupport.trim()) {
    const parsed = Number(record.amountSupport);
    amountSupport = Number.isFinite(parsed) ? parsed : null;
  }

  let participants: number | null = null;
  if (typeof record.participants === "number" && Number.isFinite(record.participants)) {
    participants = record.participants;
  } else if (typeof record.participants === "string" && record.participants.trim()) {
    const parsed = Number(record.participants);
    participants = Number.isFinite(parsed) ? parsed : null;
  }

  const normalized: CaseStudyEntry = {
    id: String(record.id ?? "").trim(),
    sharedEntryId: String(record.sharedEntryId ?? "").trim() || undefined,
    sourceEmail: String(record.sourceEmail ?? "").trim() || undefined,
    sharedRole: record.sharedRole === "staffAccompanying" ? "staffAccompanying" : undefined,
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
    coordinator,
    placeOfVisit: String(record.placeOfVisit ?? "").trim(),
    purposeOfVisit: String(record.purposeOfVisit ?? "").trim(),
    staffAccompanying,
    studentYear: normalizeStudentYear(String(record.studentYear ?? "").trim()) ?? "",
    semesterNumber,
    participants,
    amountSupport,
    pdfMeta: isValidPdfMeta((record.pdfMeta as PdfMeta | null) ?? null)
      ? ((record.pdfMeta as PdfMeta | null) ?? null)
      : null,
    pdfSourceHash: typeof record.pdfSourceHash === "string" ? record.pdfSourceHash : "",
    pdfStale: record.pdfStale === true,
    permissionLetter: (record.permissionLetter as FileMeta | null) ?? null,
    travelPlan: (record.travelPlan as FileMeta | null) ?? null,
    geotaggedPhotos: normalizeFileMetaArray(record.geotaggedPhotos, record.geotaggedPhoto),
    streak: normalizeStreakState(record.streak),
    createdAt: String(record.createdAt ?? "").trim(),
    updatedAt: String(record.updatedAt ?? "").trim(),
  };

  if (normalized.pdfMeta && !normalized.pdfSourceHash) {
    normalized.pdfSourceHash = hashPrePdfFields(normalized, "case-studies");
  }

  normalized.pdfStale =
    !!normalized.pdfMeta &&
    !!normalized.pdfSourceHash &&
    hashPrePdfFields(normalized, "case-studies") !== normalized.pdfSourceHash;

  return normalized;
}

function buildSavedStreak(
  entry: Pick<
    CaseStudyEntry,
    "status" | "pdfMeta" | "startDate" | "endDate" | "streak" | "permissionLetter" | "travelPlan" | "geotaggedPhotos"
  >
) {
  const normalized = normalizeStreakState(entry.streak);
  const eligible = isFutureDatedEntry(entry.startDate, entry.endDate);
  const uploadsComplete =
    isValidFileMeta(entry.permissionLetter) &&
    isValidFileMeta(entry.travelPlan) &&
    entry.geotaggedPhotos.length > 0;

  if (!entry.pdfMeta || !eligible) {
    return normalizeStreakState(null);
  }

  const activatedAtISO = normalized.activatedAtISO ?? null;
  const dueAtISO = normalized.dueAtISO ?? computeDueAtISO(entry.endDate);
  const completedAtISO =
    entry.status === "final" &&
    activatedAtISO &&
    uploadsComplete &&
    dueAtISO &&
    isWithinDueWindow(dueAtISO)
      ? normalized.completedAtISO ?? new Date().toISOString()
      : normalized.completedAtISO ?? null;

  return {
    ...normalized,
    activatedAtISO,
    dueAtISO,
    completedAtISO,
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

async function readList(email: string): Promise<CaseStudyEntry[]> {
  return listEntriesForCategory(email, "case-studies", normalizeEntry);
}

async function writeList(email: string, list: CaseStudyEntry[]) {
  await replaceEntriesForCategory(email, "case-studies", list);
}

async function deleteStoredFile(email: string, meta: FileMeta | null) {
  if (!meta?.storedPath) return;

  try {
    const normalized = normalizeStoredPath(meta.storedPath);
    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "case-studies") + "/";

    if (!normalized.startsWith(ownerPrefix)) {
      return;
    }

    await fs.unlink(path.join(process.cwd(), "public", normalized)).catch(() => null);
  } catch {
    return;
  }
}

function buildTargetEmails(staffAccompanying: StaffSelection[], creatorEmail: string) {
  const seen = new Set<string>();
  const targets: Faculty[] = [];

  for (const selection of staffAccompanying) {
    const normalized = normalizeEmail(selection.email);
    if (!normalized || normalized === creatorEmail || seen.has(normalized)) continue;

    const faculty = findFacultyByEmail(normalized);
    if (!faculty) continue;

    seen.add(normalized);
    targets.push(faculty);
  }

  return targets;
}

async function upsertSharedTargets(savedEntry: CaseStudyEntry, creatorEmail: string, now: string) {
  const sharedEntryId = savedEntry.sharedEntryId ?? savedEntry.id;
  const targets = buildTargetEmails(savedEntry.staffAccompanying, creatorEmail);

  for (const target of targets) {
    const targetList = await readList(target.email);
    const existingTarget =
      targetList.find((item) => item.sharedEntryId === sharedEntryId || item.id === sharedEntryId) ?? null;

    const permissionLetter =
      await cloneOptionalFileToTarget(
        savedEntry.permissionLetter,
        target.email,
        "case-studies",
        sharedEntryId,
        "permissionLetter"
      );

    const travelPlan =
      await cloneOptionalFileToTarget(
        savedEntry.travelPlan,
        target.email,
        "case-studies",
        sharedEntryId,
        "travelPlan"
      );

    const geotaggedPhotos =
      await cloneOptionalFileArrayToTarget(
        savedEntry.geotaggedPhotos,
        target.email,
        "case-studies",
        sharedEntryId,
        "geotaggedPhotos"
      );

    const clonedEntry: CaseStudyEntry = {
      ...(existingTarget ?? savedEntry),
      ...savedEntry,
      id: sharedEntryId,
      sharedEntryId,
      sourceEmail: creatorEmail,
      sharedRole: "staffAccompanying",
      permissionLetter,
      travelPlan,
      geotaggedPhotos,
      createdAt: existingTarget?.createdAt ?? now,
      updatedAt: now,
    };

    await writeList(
      target.email,
      existingTarget
        ? targetList.map((item) => (item.id === existingTarget.id ? clonedEntry : item))
        : [clonedEntry, ...targetList]
    );
  }
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

    if (!entry.placeOfVisit) {
      return NextResponse.json({ error: "placeOfVisit required" }, { status: 400 });
    }

    if (!entry.purposeOfVisit) {
      return NextResponse.json({ error: "purposeOfVisit required" }, { status: 400 });
    }

    if (!Array.isArray(entry.staffAccompanying) || entry.staffAccompanying.length === 0) {
      return NextResponse.json({ error: "staffAccompanying required" }, { status: 400 });
    }

    const staffAccompanying = entry.staffAccompanying
      .map(canonicalizeStaffSelection)
      .filter((staff) => staff.name || staff.email);

    if (staffAccompanying.length === 0 || staffAccompanying.some((staff) => !staff.name)) {
      return NextResponse.json({ error: "staffAccompanying invalid" }, { status: 400 });
    }

    const dedupeKeys = staffAccompanying.map(buildStaffKey);
    if (new Set(dedupeKeys).size !== dedupeKeys.length) {
      return NextResponse.json({ error: "duplicate staff selection" }, { status: 400 });
    }

    if (!entry.studentYear) {
      return NextResponse.json({ error: "studentYear required" }, { status: 400 });
    }

    if (!isSemesterAllowed(entry.studentYear, entry.semesterNumber ?? undefined)) {
      return NextResponse.json({ error: "semesterNumber invalid" }, { status: 400 });
    }

    const amountSupport =
      entry.amountSupport === null
        ? null
        : typeof entry.amountSupport === "number" &&
            Number.isFinite(entry.amountSupport) &&
            entry.amountSupport >= 0
          ? entry.amountSupport
          : NaN;

    if (Number.isNaN(amountSupport)) {
      return NextResponse.json({ error: "amountSupport invalid" }, { status: 400 });
    }

    const permissionLetter = isValidFileMeta(entry.permissionLetter) ? entry.permissionLetter : null;
    const travelPlan = isValidFileMeta(entry.travelPlan) ? entry.travelPlan : null;
    const geotaggedPhotos = Array.isArray(entry.geotaggedPhotos) ? entry.geotaggedPhotos : [];
    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "case-studies") + "/";
    if (permissionLetter && !normalizeStoredPath(permissionLetter.storedPath).startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "permissionLetter invalid" }, { status: 400 });
    }
    if (travelPlan && !normalizeStoredPath(travelPlan.storedPath).startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "travelPlan invalid" }, { status: 400 });
    }
    if (
      geotaggedPhotos.some(
        (meta) => !isValidFileMeta(meta) || !normalizeStoredPath(meta.storedPath).startsWith(ownerPrefix)
      )
    ) {
      return NextResponse.json({ error: "geotaggedPhotos invalid" }, { status: 400 });
    }

    const coordinator: StaffSelection = {
      email,
      name: getCanonicalName(email) ?? email.split("@")[0],
    };

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    if (existing && !isEntryEditable(existing)) {
      return NextResponse.json({ error: "Entry locked; request edit." }, { status: 403 });
    }
    const now = new Date().toISOString();
    const sharedEntryId = existing?.sharedEntryId ?? entry.sharedEntryId ?? entry.id;

    const savedEntry: CaseStudyEntry = {
      id: entry.id,
      sharedEntryId,
      sourceEmail: email,
      status: entry.status === "final" ? "final" : "draft",
      academicYear: entry.academicYear,
      semesterType: entry.semesterType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      coordinator,
      placeOfVisit: entry.placeOfVisit,
      purposeOfVisit: entry.purposeOfVisit,
      staffAccompanying: staffAccompanying.map((staff) => ({
        id: staff.id,
        name: staff.email ? (getCanonicalName(staff.email) ?? staff.name) : staff.name,
        email: staff.email,
        isLocked: staff.isLocked === true,
        savedAtISO: staff.isLocked ? staff.savedAtISO ?? now : null,
      })),
      studentYear: entry.studentYear,
      semesterNumber: entry.semesterNumber,
      participants:
        typeof entry.participants === "number" && Number.isFinite(entry.participants) && entry.participants > 0
          ? entry.participants
          : null,
      amountSupport,
      pdfMeta: entry.pdfMeta ?? existing?.pdfMeta ?? null,
      pdfSourceHash: entry.pdfSourceHash || existing?.pdfSourceHash || "",
      pdfStale: entry.pdfStale === true,
      permissionLetter,
      travelPlan,
      geotaggedPhotos,
      streak: buildSavedStreak({
        status: entry.status === "final" ? "final" : "draft",
        pdfMeta: entry.pdfMeta ?? existing?.pdfMeta ?? null,
        startDate: entry.startDate,
        endDate: entry.endDate,
        streak: entry.streak,
        permissionLetter,
        travelPlan,
        geotaggedPhotos,
      }),
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

    savedEntry.pdfStale =
      !!savedEntry.pdfMeta &&
      !!savedEntry.pdfSourceHash &&
      hashPrePdfFields(savedEntry, "case-studies") !== savedEntry.pdfSourceHash;

    if (existing) {
      if (existing.permissionLetter?.storedPath !== savedEntry.permissionLetter?.storedPath) {
        await deleteStoredFile(email, existing.permissionLetter);
      }
      if (existing.travelPlan?.storedPath !== savedEntry.travelPlan?.storedPath) {
        await deleteStoredFile(email, existing.travelPlan);
      }
      const nextPhotoPaths = new Set(savedEntry.geotaggedPhotos.map((meta) => meta.storedPath));
      for (const meta of existing.geotaggedPhotos) {
        if (!nextPhotoPaths.has(meta.storedPath)) {
          await deleteStoredFile(email, meta);
        }
      }
    }

    const persisted = existing
      ? await updateEntry<CaseStudyEntry>(email, "case-studies", savedEntry.id, savedEntry)
      : await createEntry<CaseStudyEntry>(email, "case-studies", savedEntry);

    if (shouldShareEntry(persisted)) {
      try {
        await upsertSharedTargets(persisted, email, now);
      } catch (error) {
        console.error("Case studies share failed", error);
      }
    }

    return NextResponse.json(persisted, { status: 200 });
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

    if (!Array.isArray(entry.staffAccompanying) || entry.staffAccompanying.length === 0) {
      return NextResponse.json({ error: "staffAccompanying required" }, { status: 400 });
    }

    const staffAccompanying = entry.staffAccompanying
      .map(canonicalizeStaffSelection)
      .filter((staff) => staff.name || staff.email);

    if (
      staffAccompanying.length === 0 ||
      staffAccompanying.some((staff) => !staff.name || !staff.email || !findFacultyByEmail(staff.email))
    ) {
      return NextResponse.json({ error: "staffAccompanying invalid" }, { status: 400 });
    }

    const dedupeKeys = staffAccompanying.map(buildStaffKey);
    if (new Set(dedupeKeys).size !== dedupeKeys.length) {
      return NextResponse.json({ error: "duplicate staff selection" }, { status: 400 });
    }

    const currentList = await readList(email);
    const existing =
      currentList.find((item) => item.id === entry.id || item.sharedEntryId === entry.sharedEntryId) ?? null;
    if (existing && !isEntryEditable(existing)) {
      return NextResponse.json({ error: "Entry locked; request edit." }, { status: 403 });
    }
    const now = new Date().toISOString();
    const sharedEntryId = existing?.sharedEntryId ?? entry.sharedEntryId ?? entry.id;
    const hasPermissionLetter =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "permissionLetter");
    const hasTravelPlan =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "travelPlan");
    const hasGeotaggedPhotos =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "geotaggedPhotos");
    const hasPdfMeta = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfMeta");
    const hasPdfSourceHash =
      !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfSourceHash");
    const hasPdfStale = !!entryRecord && Object.prototype.hasOwnProperty.call(entryRecord, "pdfStale");
    const coordinator: StaffSelection = {
      email,
      name: getCanonicalName(email) ?? email.split("@")[0],
    };
    const nextPermissionLetter = hasPermissionLetter
      ? (isValidFileMeta(entry.permissionLetter) ? entry.permissionLetter : null)
      : existing?.permissionLetter ?? null;
    const nextTravelPlan = hasTravelPlan
      ? (isValidFileMeta(entry.travelPlan) ? entry.travelPlan : null)
      : existing?.travelPlan ?? null;
    const nextGeotaggedPhotos = hasGeotaggedPhotos
      ? (Array.isArray(entry.geotaggedPhotos) ? entry.geotaggedPhotos : [])
      : existing?.geotaggedPhotos ?? [];

    const savedEntry: CaseStudyEntry = {
      ...(existing ?? {
        id: entry.id,
        status: "draft",
        requestEditStatus: "none",
        requestEditRequestedAtISO: null,
        academicYear: "",
        semesterType: "",
        startDate: "",
        endDate: "",
        coordinator,
        placeOfVisit: "",
        purposeOfVisit: "",
        staffAccompanying: [],
        studentYear: "",
        semesterNumber: null,
        participants: null,
        amountSupport: null,
        pdfMeta: null,
        pdfSourceHash: "",
        pdfStale: false,
        permissionLetter: null,
        travelPlan: null,
        geotaggedPhotos: [],
        streak: normalizeStreakState(null),
        createdAt: now,
        updatedAt: now,
      }),
      id: entry.id,
      sharedEntryId,
      sourceEmail: email,
      status: entry.status === "final" ? "final" : existing?.status ?? "draft",
      requestEditStatus: normalizeRequestEditStatus(entry.requestEditStatus, existing?.requestEditStatus ?? "none"),
      requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? existing?.requestEditRequestedAtISO ?? null,
      academicYear: entry.academicYear,
      semesterType: entry.semesterType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      coordinator,
      placeOfVisit: entry.placeOfVisit || existing?.placeOfVisit || "",
      purposeOfVisit: entry.purposeOfVisit || existing?.purposeOfVisit || "",
      staffAccompanying: staffAccompanying.map((staff) => ({
        id: staff.id,
        name: getCanonicalName(staff.email) ?? staff.name,
        email: staff.email,
        isLocked: staff.isLocked === true,
        savedAtISO: staff.isLocked ? staff.savedAtISO ?? now : null,
      })),
      studentYear: entry.studentYear || existing?.studentYear || "",
      semesterNumber: entry.semesterNumber ?? existing?.semesterNumber ?? null,
      participants:
        typeof entry.participants === "number" && Number.isFinite(entry.participants) && entry.participants > 0
          ? entry.participants
          : existing?.participants ?? null,
      amountSupport: entry.amountSupport ?? existing?.amountSupport ?? null,
      pdfMeta: hasPdfMeta ? (entry.pdfMeta ?? null) : existing?.pdfMeta ?? null,
      pdfSourceHash: hasPdfSourceHash ? (entry.pdfSourceHash ?? "") : existing?.pdfSourceHash ?? "",
      pdfStale: hasPdfStale ? entry.pdfStale === true : existing?.pdfStale === true,
      permissionLetter: nextPermissionLetter,
      travelPlan: nextTravelPlan,
      geotaggedPhotos: nextGeotaggedPhotos,
      streak: buildSavedStreak({
        status: entry.status === "final" ? "final" : existing?.status ?? "draft",
        pdfMeta: hasPdfMeta ? (entry.pdfMeta ?? null) : existing?.pdfMeta ?? null,
        startDate: entry.startDate || existing?.startDate || "",
        endDate: entry.endDate || existing?.endDate || "",
        streak: entry.streak ?? existing?.streak,
        permissionLetter: nextPermissionLetter,
        travelPlan: nextTravelPlan,
        geotaggedPhotos: nextGeotaggedPhotos,
      }),
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

    savedEntry.pdfStale =
      !!savedEntry.pdfMeta &&
      !!savedEntry.pdfSourceHash &&
      hashPrePdfFields(savedEntry, "case-studies") !== savedEntry.pdfSourceHash;

    const persisted = existing
      ? await updateEntry<CaseStudyEntry>(email, "case-studies", savedEntry.id, savedEntry)
      : await createEntry<CaseStudyEntry>(email, "case-studies", savedEntry);

    if (shouldShareEntry(persisted)) {
      try {
        await upsertSharedTargets(persisted, email, now);
      } catch (error) {
        console.error("Case studies share failed", error);
      }
    }

    return NextResponse.json(persisted, { status: 200 });
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

    await deleteEngineEntry(email, "case-studies", id);

    if (target) {
      await deleteStoredFile(email, target.permissionLetter);
      await deleteStoredFile(email, target.travelPlan);
      await Promise.all(target.geotaggedPhotos.map((meta) => deleteStoredFile(email, meta)));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
