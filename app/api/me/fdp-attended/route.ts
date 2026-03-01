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

type FdpAttended = {
  id: string;
  programName: string;
  organisingBody: string;
  supportAmount: number | null;
  permissionLetter: FileMeta | null;
  completionCertificate: FileMeta | null;
  createdAt: string;
  updatedAt: string;
};

const STORE_ROOT = path.join(process.cwd(), "data", "fdp-attended");
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
}

async function readList(email: string): Promise<FdpAttended[]> {
  const filePath = path.join(STORE_ROOT, `${sanitizeSegment(email)}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FdpAttended[]) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: FdpAttended[]) {
  await fs.mkdir(STORE_ROOT, { recursive: true });
  const filePath = path.join(STORE_ROOT, `${sanitizeSegment(email)}.json`);
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
}

function resolveOwnedStoredPath(email: string, storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }

  const safeEmail = sanitizeSegment(email);
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

export async function GET() {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await readList(email);
  return NextResponse.json(list, { status: 200 });
}

export async function POST(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { entry?: FdpAttended };
    const entry = body?.entry;

    if (!entry?.id) {
      return NextResponse.json({ error: "entry.id required" }, { status: 400 });
    }

    const programName = String(entry.programName ?? "").trim();
    const organisingBody = String(entry.organisingBody ?? "").trim();
    const supportAmount =
      typeof entry.supportAmount === "number" && Number.isFinite(entry.supportAmount) && entry.supportAmount >= 0
        ? entry.supportAmount
        : null;

    if (!programName) {
      return NextResponse.json({ error: "programName required" }, { status: 400 });
    }

    if (!organisingBody) {
      return NextResponse.json({ error: "organisingBody required" }, { status: 400 });
    }

    if (!isValidFileMeta(entry.permissionLetter)) {
      return NextResponse.json({ error: "permissionLetter required" }, { status: 400 });
    }

    if (!isValidFileMeta(entry.completionCertificate)) {
      return NextResponse.json({ error: "completionCertificate required" }, { status: 400 });
    }

    resolveOwnedStoredPath(email, entry.permissionLetter.storedPath);
    resolveOwnedStoredPath(email, entry.completionCertificate.storedPath);

    const currentList = await readList(email);
    const existing = currentList.find((item) => item.id === entry.id) ?? null;
    const now = new Date().toISOString();

    const savedEntry: FdpAttended = {
      id: entry.id,
      programName,
      organisingBody,
      supportAmount,
      permissionLetter: entry.permissionLetter,
      completionCertificate: entry.completionCertificate,
      createdAt: existing?.createdAt ?? entry.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      if (existing.permissionLetter?.storedPath !== savedEntry.permissionLetter?.storedPath) {
        await deleteStoredFile(email, existing.permissionLetter);
      }
      if (existing.completionCertificate?.storedPath !== savedEntry.completionCertificate?.storedPath) {
        await deleteStoredFile(email, existing.completionCertificate);
      }
    }

    const nextList = existing
      ? currentList.map((item) => (item.id === savedEntry.id ? savedEntry : item))
      : [savedEntry, ...currentList];

    await writeList(email, nextList);
    return NextResponse.json(savedEntry, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
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

    await writeList(
      email,
      currentList.filter((item) => item.id !== id)
    );

    if (target) {
      await deleteStoredFile(email, target.permissionLetter);
      await deleteStoredFile(email, target.completionCertificate);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
