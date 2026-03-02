import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  cloneFileMetaArrayToTarget,
  cloneFileMetaToTarget,
} from "@/lib/crosspost.server";
import {
  findFacultyByEmail,
  findFacultyByName,
  getCanonicalName,
  normalizeEmail,
  type Faculty,
} from "@/lib/facultyDirectory";
import {
  isSemesterAllowed,
  normalizeStudentYear,
  type StudentYear,
} from "@/lib/student-academic";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type StaffSelection = {
  name: string;
  email: string;
};

type CaseStudyEntry = {
  id: string;
  sharedEntryId?: string;
  sourceEmail?: string;
  sharedRole?: "staffAccompanying";
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
  amountSupport: number | null;
  permissionLetter: FileMeta | null;
  travelPlan: FileMeta | null;
  geotaggedPhotos: FileMeta[];
  createdAt: string;
  updatedAt: string;
};

const ACADEMIC_YEAR_OPTIONS = new Set([
  "Academic Year 2025-2026",
  "Academic Year 2026-2027",
  "Academic Year 2027-2028",
]);
const SEMESTER_TYPE_OPTIONS = new Set(["Odd", "Even"]);

function safeEmailDir(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

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

function isValidFileMeta(meta: FileMeta | null) {
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
    return { name: value.trim(), email: "" };
  }

  if (value && typeof value === "object") {
    const record = value as { name?: unknown; email?: unknown };
    return {
      name: String(record.name ?? "").trim(),
      email: normalizeEmail(String(record.email ?? "")),
    };
  }

  return { name: "", email: "" };
}

function canonicalizeStaffSelection(value: StaffSelection) {
  const normalizedEmail = value.email ? normalizeEmail(value.email) : "";
  const byEmail = normalizedEmail ? findFacultyByEmail(normalizedEmail) : null;
  if (byEmail) {
    return { name: byEmail.name, email: byEmail.email };
  }

  const byName = value.name ? findFacultyByName(value.name) : null;
  if (byName) {
    return { name: byName.name, email: byName.email };
  }

  return {
    name: value.name.trim(),
    email: normalizedEmail,
  };
}

function buildStaffKey(selection: StaffSelection) {
  if (selection.email) return `email:${selection.email.toLowerCase()}`;
  return `name:${selection.name.trim().toLowerCase()}`;
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

  return {
    id: String(record.id ?? "").trim(),
    sharedEntryId: String(record.sharedEntryId ?? "").trim() || undefined,
    sourceEmail: String(record.sourceEmail ?? "").trim() || undefined,
    sharedRole: record.sharedRole === "staffAccompanying" ? "staffAccompanying" : undefined,
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
    amountSupport,
    permissionLetter: (record.permissionLetter as FileMeta | null) ?? null,
    travelPlan: (record.travelPlan as FileMeta | null) ?? null,
    geotaggedPhotos: normalizeFileMetaArray(record.geotaggedPhotos, record.geotaggedPhoto),
    createdAt: String(record.createdAt ?? "").trim(),
    updatedAt: String(record.updatedAt ?? "").trim(),
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
  return path.join(process.cwd(), ".data", "users", safeEmailDir(email), "case-studies.json");
}

async function readList(email: string): Promise<CaseStudyEntry[]> {
  const filePath = getStoreFile(email);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(normalizeEntry).filter((entry): entry is CaseStudyEntry => !!entry)
      : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: CaseStudyEntry[]) {
  const filePath = getStoreFile(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
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

    if (!isValidFileMeta(entry.permissionLetter)) {
      return NextResponse.json({ error: "permissionLetter required" }, { status: 400 });
    }

    if (!isValidFileMeta(entry.travelPlan)) {
      return NextResponse.json({ error: "travelPlan required" }, { status: 400 });
    }

    if (!Array.isArray(entry.geotaggedPhotos) || entry.geotaggedPhotos.length === 0) {
      return NextResponse.json({ error: "geotaggedPhotos required" }, { status: 400 });
    }

    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "case-studies") + "/";
    if (!normalizeStoredPath(entry.permissionLetter.storedPath).startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "permissionLetter invalid" }, { status: 400 });
    }
    if (!normalizeStoredPath(entry.travelPlan.storedPath).startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "travelPlan invalid" }, { status: 400 });
    }
    if (
      entry.geotaggedPhotos.some(
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
    const now = new Date().toISOString();
    const sharedEntryId = existing?.sharedEntryId ?? entry.sharedEntryId ?? entry.id;

    const savedEntry: CaseStudyEntry = {
      id: entry.id,
      sharedEntryId,
      sourceEmail: email,
      academicYear: entry.academicYear,
      semesterType: entry.semesterType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      coordinator,
      placeOfVisit: entry.placeOfVisit,
      purposeOfVisit: entry.purposeOfVisit,
      staffAccompanying: staffAccompanying.map((staff) => ({
        name: staff.email ? (getCanonicalName(staff.email) ?? staff.name) : staff.name,
        email: staff.email,
      })),
      studentYear: entry.studentYear,
      semesterNumber: entry.semesterNumber,
      amountSupport,
      permissionLetter: entry.permissionLetter,
      travelPlan: entry.travelPlan,
      geotaggedPhotos: entry.geotaggedPhotos,
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

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

    const next = existing
      ? currentList.map((item) => (item.id === savedEntry.id ? savedEntry : item))
      : [savedEntry, ...currentList];

    await writeList(email, next);

    const targets = buildTargetEmails(savedEntry.staffAccompanying, email);
    for (const target of targets) {
      const targetList = await readList(target.email);
      if (targetList.some((item) => item.sharedEntryId === sharedEntryId || item.id === sharedEntryId)) {
        continue;
      }

      const clonedEntry: CaseStudyEntry = {
        ...savedEntry,
        id: sharedEntryId,
        sharedEntryId,
        sourceEmail: email,
        sharedRole: "staffAccompanying",
        permissionLetter: await cloneFileMetaToTarget(
          savedEntry.permissionLetter!,
          target.email,
          "case-studies",
          sharedEntryId,
          "permissionLetter"
        ),
        travelPlan: await cloneFileMetaToTarget(
          savedEntry.travelPlan!,
          target.email,
          "case-studies",
          sharedEntryId,
          "travelPlan"
        ),
        geotaggedPhotos: await cloneFileMetaArrayToTarget(
          savedEntry.geotaggedPhotos,
          target.email,
          "case-studies",
          sharedEntryId,
          "geotaggedPhotos"
        ),
        createdAt: now,
        updatedAt: now,
      };

      await writeList(target.email, [clonedEntry, ...targetList]);
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

    await writeList(
      email,
      currentList.filter((item) => item.id !== id)
    );

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
