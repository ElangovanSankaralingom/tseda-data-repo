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
  academicYear: string;
  semesterType: string;
  startDate: string;
  endDate: string;
  eventName: string;
  speakerName: string;
  organisationName: string;
  coordinator: FacultySelection;
  coCoordinators: FacultySelection[];
  uploads: Uploads;
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

function safeEmailDir(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

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

  return {
    id: String(record.id ?? "").trim(),
    sharedEntryId: String(record.sharedEntryId ?? "").trim() || undefined,
    sourceEmail: String(record.sourceEmail ?? "").trim() || undefined,
    sharedRole: record.sharedRole === "coCoordinator" ? "coCoordinator" : undefined,
    academicYear: String(record.academicYear ?? "").trim(),
    semesterType: String(record.semesterType ?? "").trim(),
    startDate: String(record.startDate ?? "").trim(),
    endDate: String(record.endDate ?? "").trim(),
    eventName: String(record.eventName ?? "").trim(),
    speakerName: String(record.speakerName ?? "").trim(),
    organisationName: String(record.organisationName ?? "").trim(),
    coordinator,
    coCoordinators,
    uploads: normalizeUploads(record.uploads),
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
  return path.join(process.cwd(), ".data", "users", safeEmailDir(email), "workshops.json");
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

    for (const slot of REQUIRED_SINGLE_SLOTS) {
      if (!isValidFileMeta(entry.uploads[slot])) {
        return NextResponse.json({ error: `${slot} required` }, { status: 400 });
      }
    }

    if (!Array.isArray(entry.uploads.geotaggedPhotos) || entry.uploads.geotaggedPhotos.length === 0) {
      return NextResponse.json({ error: "geotaggedPhotos required" }, { status: 400 });
    }

    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "workshops") + "/";
    for (const slot of REQUIRED_SINGLE_SLOTS) {
      const meta = entry.uploads[slot];
      if (!meta || !normalizeStoredPath(meta.storedPath).startsWith(ownerPrefix)) {
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
    const now = new Date().toISOString();
    const sharedEntryId = existing?.sharedEntryId ?? entry.sharedEntryId ?? entry.id;

    const savedEntry: WorkshopEntry = {
      id: entry.id,
      sharedEntryId,
      sourceEmail: email,
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
        email: item.email,
        name: getCanonicalName(item.email) ?? item.name,
      })),
      uploads: entry.uploads,
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

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
          permissionLetter: await cloneFileMetaToTarget(
            savedEntry.uploads.permissionLetter!,
            target.email,
            "workshops",
            sharedEntryId,
            "permissionLetter"
          ),
          brochure: await cloneFileMetaToTarget(
            savedEntry.uploads.brochure!,
            target.email,
            "workshops",
            sharedEntryId,
            "brochure"
          ),
          attendance: await cloneFileMetaToTarget(
            savedEntry.uploads.attendance!,
            target.email,
            "workshops",
            sharedEntryId,
            "attendance"
          ),
          organiserProfile: await cloneFileMetaToTarget(
            savedEntry.uploads.organiserProfile!,
            target.email,
            "workshops",
            sharedEntryId,
            "organiserProfile"
          ),
          geotaggedPhotos: await cloneFileMetaArrayToTarget(
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
