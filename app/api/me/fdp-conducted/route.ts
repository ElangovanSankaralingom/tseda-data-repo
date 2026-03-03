import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  findFacultyByEmail,
  findFacultyByName,
  getCanonicalName,
  normalizeEmail,
} from "@/lib/facultyDirectory";
import {
  computeDueAtISO,
  ensureActivated,
  isEntryEditable,
  isFutureDatedEntry,
  markCompleted,
  normalizeStreakState,
  type StreakState,
} from "@/lib/gamification";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type FacultySelection = {
  name: string;
  email: string;
};

type FdpConducted = {
  id: string;
  status: "draft" | "final";
  requestEditStatus?: "none" | "pending" | "approved" | "rejected";
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
  academicYear: string;
  semesterType: string;
  startDate: string;
  endDate: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultySelection[];
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
const SEMESTER_TYPE_OPTIONS = new Set(["Odd Semester", "Even Semester"]);

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
    return parseNameEmail(value);
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

function canonicalizeFacultySelection(value: FacultySelection) {
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

function normalizeStatus(value: unknown, fallback: "draft" | "final" = "draft") {
  return value === "final" ? "final" : value === "draft" ? "draft" : fallback;
}

function normalizeRequestEditStatus(
  value: unknown,
  fallback: "none" | "pending" | "approved" | "rejected" = "none"
) {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : fallback;
}

function normalizeEntry(value: unknown): FdpConducted | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const legacyCoordinator = normalizeFacultySelection(record.coordinator);
  const coordinator = {
    name: String(record.coordinatorName ?? legacyCoordinator.name ?? "").trim(),
    email: normalizeEmail(String(record.coordinatorEmail ?? legacyCoordinator.email ?? "")),
  };
  const coCoordinatorsRaw = Array.isArray(record.coCoordinators) ? record.coCoordinators : [];
  const coCoordinators = coCoordinatorsRaw
    .map(normalizeFacultySelection)
    .filter((item) => item.name || item.email);

  return {
    id: String(record.id ?? "").trim(),
    status: normalizeStatus(record.status),
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
    semesterType: String(record.semesterType ?? "").trim(),
    startDate: String(record.startDate ?? "").trim(),
    endDate: String(record.endDate ?? "").trim(),
    coordinatorName: coordinator.name,
    coordinatorEmail: coordinator.email,
    coCoordinators,
    permissionLetter: (record.permissionLetter as FileMeta | null) ?? null,
    geotaggedPhotos: normalizeFileMetaArray(record.geotaggedPhotos, record.geotaggedPhoto),
    streak: normalizeStreakState(record.streak),
    createdAt: String(record.createdAt ?? "").trim(),
    updatedAt: String(record.updatedAt ?? "").trim(),
  };
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

function getStoreFile(email: string) {
  return path.join(process.cwd(), ".data", "users", safeEmailDir(email), "fdp-conducted.json");
}

async function readList(email: string): Promise<FdpConducted[]> {
  const filePath = getStoreFile(email);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter((item): item is FdpConducted => !!item) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: FdpConducted[]) {
  const filePath = getStoreFile(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
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

function validateCoreFields(entry: FdpConducted) {
  const startDate = String(entry.startDate ?? "").trim();
  const endDate = String(entry.endDate ?? "").trim();
  const academicYear = String(entry.academicYear ?? "").trim();
  const semesterType = String(entry.semesterType ?? "").trim();

  if (!ACADEMIC_YEAR_OPTIONS.has(academicYear)) {
    return { error: "academicYear required" };
  }

  if (!SEMESTER_TYPE_OPTIONS.has(semesterType)) {
    return { error: "semesterType required" };
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

  return { academicYear, semesterType, startDate, endDate };
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
    const coCoordinators = Array.isArray(entry.coCoordinators)
      ? entry.coCoordinators
          .map(normalizeFacultySelection)
          .map(canonicalizeFacultySelection)
          .filter((value) => value.name || value.email)
      : [];

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

    if (!isValidFileMeta(entry.permissionLetter)) {
      return NextResponse.json({ error: "permissionLetter required" }, { status: 400 });
    }

    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "fdp-conducted") + "/";
    if (!normalizeStoredPath(entry.permissionLetter.storedPath).startsWith(ownerPrefix)) {
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
    const requestedStatus = normalizeStatus(entry.status, "draft");
    const nextStatus: "draft" | "final" = requestedStatus === "final" ? "final" : "draft";
    const existingStreak = normalizeStreakState(existing?.streak ?? entry.streak);
    let streak = normalizeStreakState(existingStreak);

    if (nextStatus === "final") {
      streak = eligible
        ? ensureActivated(existingStreak, validated.endDate)
        : {
            ...existingStreak,
            activatedAtISO: null,
            dueAtISO: null,
            completedAtISO: null,
          };

      if (eligible) {
        streak.dueAtISO = streak.dueAtISO || computeDueAtISO(validated.endDate);
        if (
          entry.geotaggedPhotos.length > 0 &&
          streak.dueAtISO &&
          !streak.completedAtISO &&
          Date.now() <= new Date(streak.dueAtISO).getTime()
        ) {
          streak = markCompleted(streak);
        }
      }
    } else {
      streak = {
        ...existingStreak,
        activatedAtISO: null,
        dueAtISO: null,
        completedAtISO: null,
      };
    }

    const savedEntry: FdpConducted = {
      id: entry.id,
      status: nextStatus,
      requestEditStatus: normalizeRequestEditStatus(entry.requestEditStatus, existing?.requestEditStatus ?? "none"),
      requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? existing?.requestEditRequestedAtISO ?? null,
      requestEditMessage: entry.requestEditMessage ?? existing?.requestEditMessage ?? "",
      academicYear: validated.academicYear,
      semesterType: validated.semesterType,
      startDate: validated.startDate,
      endDate: validated.endDate,
      coordinatorName: coordinator.email ? (getCanonicalName(coordinator.email) ?? coordinator.name) : coordinator.name,
      coordinatorEmail: coordinator.email,
      coCoordinators: coCoordinators.map((value) => ({
        name: value.email ? (getCanonicalName(value.email) ?? value.name) : value.name,
        email: value.email,
      })),
      permissionLetter: entry.permissionLetter,
      geotaggedPhotos: entry.geotaggedPhotos,
      streak,
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

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

    const next = existing
      ? currentList.map((item) => (item.id === savedEntry.id ? savedEntry : item))
      : [savedEntry, ...currentList];

    await writeList(email, next);
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

    if (entry.semesterType && !SEMESTER_TYPE_OPTIONS.has(entry.semesterType)) {
      return NextResponse.json({ error: "semesterType invalid" }, { status: 400 });
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
    const requestedStatus = normalizeStatus(entry.status, existing?.status ?? "draft");
    const coordinatorName =
      getCanonicalName(email) ?? existing?.coordinatorName ?? entry.coordinatorName ?? email.split("@")[0];

    const savedEntry: FdpConducted = {
      ...(existing ?? {
        id: entry.id,
        status: "draft",
        requestEditStatus: "none",
        requestEditRequestedAtISO: null,
        requestEditMessage: "",
        academicYear: "",
        semesterType: "",
        startDate: "",
        endDate: "",
        coordinatorName,
        coordinatorEmail: email,
        coCoordinators: [],
        permissionLetter: null,
        geotaggedPhotos: [],
        streak: normalizeStreakState(null),
        createdAt: now,
        updatedAt: now,
      }),
      id: entry.id,
      status: existing?.status === "final" ? "final" : requestedStatus,
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
      semesterType: entry.semesterType || existing?.semesterType || "",
      startDate: entry.startDate || existing?.startDate || "",
      endDate: entry.endDate || existing?.endDate || "",
      coordinatorName,
      coordinatorEmail: email,
      coCoordinators: hasCoCoordinators
        ? entry.coCoordinators.map(canonicalizeFacultySelection)
        : existing?.coCoordinators || [],
      permissionLetter: hasPermissionLetter ? entry.permissionLetter : existing?.permissionLetter || null,
      geotaggedPhotos: hasGeotaggedPhotos ? entry.geotaggedPhotos : existing?.geotaggedPhotos || [],
      streak:
        existing?.status === "final"
          ? normalizeStreakState(existing.streak)
          : {
              ...normalizeStreakState(entry.streak),
              activatedAtISO: null,
              dueAtISO: null,
              completedAtISO: null,
            },
      createdAt: existing?.createdAt || entry.createdAt || now,
      updatedAt: now,
    };

    await writeList(
      email,
      existing
        ? currentList.map((item) => (item.id === savedEntry.id ? savedEntry : item))
        : [savedEntry, ...currentList]
    );

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
    if (target && !canEditEntry(target)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    await writeList(
      email,
      currentList.filter((item) => item.id !== id)
    );

    if (target) {
      await deleteStoredFile(email, target.permissionLetter);
      await Promise.all(target.geotaggedPhotos.map((meta) => deleteStoredFile(email, meta)));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
