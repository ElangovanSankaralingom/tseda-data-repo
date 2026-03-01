import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const MAX_BYTES = 20 * 1024 * 1024;
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const LEGACY_UPLOADS_ROOT = path.join(process.cwd(), "storage");
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const DOC_TYPES = new Set(["appointmentLetter", "joiningLetter", "aadhar", "panCard"]);
const CERTIFICATE_CATEGORIES = new Set(["academicOutsideTCE", "industry"]);

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getMimeTypeForExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";

  return "application/octet-stream";
}

function resolveStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }

  const absolutePath = path.join(UPLOADS_ROOT, normalized);
  const relativeToRoot = path.relative(UPLOADS_ROOT, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid storedPath");
  }

  return {
    normalized,
    absolutePath,
  };
}

function getOwnedFileCandidates(email: string, storedPath: string) {
  const safeEmail = sanitizeSegment(email);
  const resolved = resolveStoredPath(storedPath);
  const ownerPrefix = `${safeEmail}/`;

  if (resolved.normalized.includes("/../") || resolved.normalized.startsWith("../")) {
    throw new Error("Invalid storedPath");
  }

  if (resolved.normalized.startsWith(ownerPrefix)) {
    return {
      normalized: resolved.normalized,
      candidates: [
        {
          filePath: path.join(UPLOADS_ROOT, resolved.normalized),
          cleanupRoot: path.join(UPLOADS_ROOT, safeEmail),
        },
      ],
    };
  }

  if (/^[^/]+\//.test(resolved.normalized)) {
    throw new Error("Forbidden");
  }

  return {
    normalized: resolved.normalized,
    candidates: [
      {
        filePath: path.join(UPLOADS_ROOT, safeEmail, resolved.normalized),
        cleanupRoot: path.join(UPLOADS_ROOT, safeEmail),
      },
      {
        filePath: path.join(LEGACY_UPLOADS_ROOT, safeEmail, resolved.normalized),
        cleanupRoot: path.join(LEGACY_UPLOADS_ROOT, safeEmail),
      },
    ],
  };
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
}

function buildPreviewUrl(storedPath: string) {
  return `/uploads/${storedPath}`;
}

async function removeEmptyParentDirs(startDir: string, stopDir: string) {
  let currentDir = startDir;

  while (currentDir.startsWith(stopDir) && currentDir !== stopDir) {
    try {
      await fs.rmdir(currentDir);
      currentDir = path.dirname(currentDir);
    } catch {
      break;
    }
  }
}

export async function GET(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const storedPath = searchParams.get("storedPath") ?? searchParams.get("path") ?? "";

  if (!storedPath) {
    return NextResponse.json({ error: "storedPath required" }, { status: 400 });
  }

  let resolved;
  try {
    resolved = getOwnedFileCandidates(email, storedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid storedPath";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 400 });
  }

  for (const candidate of resolved.candidates) {
    try {
      const fileBytes = await fs.readFile(candidate.filePath);

      return new NextResponse(fileBytes, {
        status: 200,
        headers: {
          "Content-Type": getMimeTypeForExtension(candidate.filePath),
          "Content-Disposition": `inline; filename="${path.basename(candidate.filePath)}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}

export async function POST(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Max 20MB allowed" }, { status: 400 });
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Only PDF/JPG/PNG allowed" }, { status: 400 });
  }

  const safeEmail = sanitizeSegment(email);
  const safeOriginalFileName = sanitizeFileName(path.basename(file.name));
  const uniqueFileName = `${Date.now()}_${randomUUID()}_${safeOriginalFileName}`;

  let storedPath: string;

  if (kind === "certificate") {
    const category = String(form.get("category") ?? "");
    const entryId = String(form.get("entryId") ?? "");

    if (!CERTIFICATE_CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }

    storedPath = path.posix.join(
      safeEmail,
      "certificate",
      sanitizeSegment(category),
      sanitizeSegment(entryId),
      uniqueFileName
    );
  } else if (kind === "doc") {
    const docType = String(form.get("docType") ?? "");

    if (!DOC_TYPES.has(docType)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }

    storedPath = path.posix.join(safeEmail, "doc", sanitizeSegment(docType), uniqueFileName);
  } else {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const destination = path.join(UPLOADS_ROOT, storedPath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(await file.arrayBuffer()));

  const uploadedAt = new Date().toISOString();
  const url = buildPreviewUrl(storedPath);

  return NextResponse.json({
    url,
    fileName: file.name,
    size: file.size,
    uploadedAt,
    storedPath,
    mimeType: file.type,
  });
}

export async function DELETE(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { storedPath?: string };
  const storedPath = String(body?.storedPath ?? "");

  if (!storedPath) {
    return NextResponse.json({ error: "storedPath required" }, { status: 400 });
  }

  let resolved;
  try {
    resolved = getOwnedFileCandidates(email, storedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid storedPath";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 400 });
  }

  for (const candidate of resolved.candidates) {
    try {
      await fs.unlink(candidate.filePath);
      await removeEmptyParentDirs(path.dirname(candidate.filePath), candidate.cleanupRoot);
      return NextResponse.json({ ok: true, storedPath: resolved.normalized });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
