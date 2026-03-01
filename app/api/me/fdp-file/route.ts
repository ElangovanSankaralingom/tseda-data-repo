import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const MAX_BYTES = 20 * 1024 * 1024;
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const ALLOWED_SLOTS = new Set(["permissionLetter", "completionCertificate"]);

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
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

  return {
    normalized,
    absolutePath,
  };
}

export async function POST(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const recordId = String(form.get("recordId") ?? "").trim();
  const slot = String(form.get("slot") ?? "").trim();
  const file = form.get("file");

  if (!recordId) {
    return NextResponse.json({ error: "recordId required" }, { status: 400 });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return NextResponse.json({ error: "invalid slot" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Max file size is 20MB." }, { status: 400 });
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Only PDF/JPG/PNG allowed." }, { status: 400 });
  }

  const safeEmail = sanitizeSegment(email);
  const safeRecordId = sanitizeSegment(recordId);
  const safeSlot = sanitizeSegment(slot);
  const safeOriginalFileName = sanitizeFileName(path.basename(file.name));
  const uniqueFileName = `${Date.now()}_${randomUUID()}_${safeOriginalFileName}`;
  const storedPath = path.posix.join(
    safeEmail,
    "fdp-attended",
    safeRecordId,
    safeSlot,
    uniqueFileName
  );
  const destination = path.join(UPLOADS_ROOT, storedPath);

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    url: `/uploads/${storedPath}`,
    storedPath,
  });
}

export async function DELETE(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { storedPath?: string };
  const storedPath = String(body?.storedPath ?? "").trim();

  if (!storedPath) {
    return NextResponse.json({ error: "storedPath required" }, { status: 400 });
  }

  try {
    const resolved = resolveOwnedStoredPath(email, storedPath);
    await fs.unlink(resolved.absolutePath).catch(() => null);
    return NextResponse.json({ ok: true, storedPath: resolved.normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid storedPath";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 400 });
  }
}
