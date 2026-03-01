import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
  startDate: string;
  endDate: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coCoordinators: FacultySelection[];
  permissionLetter: FileMeta | null;
  geotaggedPhoto: FileMeta | null;
  createdAt: string;
  updatedAt: string;
};

function safeEmailDir(email: string) {
  return email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
}

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
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

function parseNameEmail(text: string): FacultySelection {
  const trimmed = text.trim();
  const match = trimmed.match(/^(.*)\s<([^<>@\s]+@[^<>@\s]+)>$/);

  if (!match) {
    return { name: trimmed, email: "" };
  }

  return {
    name: match[1].trim(),
    email: match[2].trim().toLowerCase(),
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
      email: String(record.email ?? "").trim().toLowerCase(),
    };
  }

  return { name: "", email: "" };
}

function normalizeEntry(value: unknown): FdpConducted | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const legacyCoordinator = normalizeFacultySelection(record.coordinator);
  const coordinator = {
    name: String(record.coordinatorName ?? legacyCoordinator.name ?? "").trim(),
    email: String(record.coordinatorEmail ?? legacyCoordinator.email ?? "").trim().toLowerCase(),
  };
  const coCoordinatorsRaw = Array.isArray(record.coCoordinators) ? record.coCoordinators : [];
  const coCoordinators = coCoordinatorsRaw
    .map(normalizeFacultySelection)
    .filter((item) => item.name || item.email);

  return {
    id: String(record.id ?? "").trim(),
    startDate: String(record.startDate ?? "").trim(),
    endDate: String(record.endDate ?? "").trim(),
    coordinatorName: coordinator.name,
    coordinatorEmail: coordinator.email,
    coCoordinators,
    permissionLetter: (record.permissionLetter as FileMeta | null) ?? null,
    geotaggedPhoto: (record.geotaggedPhoto as FileMeta | null) ?? null,
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

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
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
    const email = String(body?.email ?? "").trim().toLowerCase();
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

    const startDate = String(entry.startDate ?? "").trim();
    const endDate = String(entry.endDate ?? "").trim();
    const coordinator = {
      name: String(entry.coordinatorName ?? "").trim(),
      email: String(entry.coordinatorEmail ?? "").trim().toLowerCase(),
    };
    const coCoordinators = Array.isArray(entry.coCoordinators)
      ? entry.coCoordinators
          .map(normalizeFacultySelection)
          .filter((value) => value.name || value.email)
      : [];

    if (!isISODate(startDate)) {
      return NextResponse.json({ error: "startDate required" }, { status: 400 });
    }

    if (!isISODate(endDate)) {
      return NextResponse.json({ error: "endDate required" }, { status: 400 });
    }

    if (endDate < startDate) {
      return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
    }

    if (!coordinator.name) {
      return NextResponse.json({ error: "coordinator required" }, { status: 400 });
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

    if (!isValidFileMeta(entry.geotaggedPhoto)) {
      return NextResponse.json({ error: "geotaggedPhoto required" }, { status: 400 });
    }

    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), "fdp-conducted") + "/";
    if (!normalizeStoredPath(entry.permissionLetter.storedPath).startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "permissionLetter invalid" }, { status: 400 });
    }
    if (!normalizeStoredPath(entry.geotaggedPhoto.storedPath).startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "geotaggedPhoto invalid" }, { status: 400 });
    }

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    const now = new Date().toISOString();

    const savedEntry: FdpConducted = {
      id: entry.id,
      startDate,
      endDate,
      coordinatorName: coordinator.name,
      coordinatorEmail: coordinator.email,
      coCoordinators,
      permissionLetter: entry.permissionLetter,
      geotaggedPhoto: entry.geotaggedPhoto,
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      if (existing.permissionLetter?.storedPath !== savedEntry.permissionLetter?.storedPath) {
        await deleteStoredFile(email, existing.permissionLetter);
      }
      if (existing.geotaggedPhoto?.storedPath !== savedEntry.geotaggedPhoto?.storedPath) {
        await deleteStoredFile(email, existing.geotaggedPhoto);
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

export async function DELETE(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { email?: string; id?: string };
    const email = String(body?.email ?? "").trim().toLowerCase();
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
      await deleteStoredFile(email, target.geotaggedPhoto);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
