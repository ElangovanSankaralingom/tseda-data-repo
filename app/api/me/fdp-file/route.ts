import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { normalizeError } from "@/lib/errors";
import { isEntryEditable } from "@/lib/entries/lock";
import { assertUploadMetadataInput } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { getUserCategoryStoreFile, safeEmailDir } from "@/lib/userStore";

const MAX_BYTES = 20 * 1024 * 1024;
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const ALLOWED_SLOTS = new Set(["permissionLetter", "completionCertificate"]);

type FdpAttendedRecord = {
  id: string;
  status?: string;
  pdfMeta?: { storedPath?: string | null; url?: string | null } | null;
  permissionLetter?: unknown;
  completionCertificate?: unknown;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  streak?: unknown;
  requestEditStatus?: string | null;
};

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function readList(email: string): Promise<FdpAttendedRecord[]> {
  const filePath = getUserCategoryStoreFile(email, "fdp-attended.json");

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FdpAttendedRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: FdpAttendedRecord[]) {
  const filePath = getUserCategoryStoreFile(email, "fdp-attended.json");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
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

  return {
    normalized,
    absolutePath,
  };
}

async function getEntryForRecordId(email: string, recordId: string) {
  const safeRecordId = sanitizeSegment(recordId);
  const list = await readList(email);
  return list.find((item) => sanitizeSegment(String(item?.id ?? "")) === safeRecordId) ?? null;
}

function getRecordIdFromStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");
  const parts = normalized.split("/");

  if (parts.length < 4) return null;
  if (parts[1] !== "fdp-attended") return null;

  return parts[2] ?? null;
}

function getSlotFromStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");
  const parts = normalized.split("/");

  if (parts.length < 5) return null;
  if (parts[1] !== "fdp-attended") return null;

  const slot = parts[3] ?? null;
  return slot === "permissionLetter" || slot === "completionCertificate" ? slot : null;
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
      action: "upload.fdp-attended.post",
      options: RATE_LIMIT_PRESETS.uploadOps,
    });

    const form = await request.formData();
    const recordId = String(form.get("recordId") ?? "").trim();
    const slot = String(form.get("slot") ?? "").trim();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    assertUploadMetadataInput(
      {
        recordId,
        slot,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      },
      "fdp-attended upload request"
    );

    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }

    const existing = await getEntryForRecordId(email, recordId);
    if (!existing) {
      return NextResponse.json({ error: "Generate the entry first." }, { status: 400 });
    }
    if (!existing.pdfMeta?.storedPath || !existing.pdfMeta?.url) {
      return NextResponse.json({ error: "Generate the entry first." }, { status: 400 });
    }
    if (existing && !isEntryEditable(existing)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    if (!ALLOWED_SLOTS.has(slot)) {
      return NextResponse.json({ error: "invalid slot" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Max file size is 20MB." }, { status: 400 });
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: "Only PDF/JPG/PNG allowed." }, { status: 400 });
    }

    const safeEmail = safeEmailDir(email);
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
  } catch (error) {
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
    return NextResponse.json({ error: appError.message || "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "upload.fdp-attended.delete",
      options: RATE_LIMIT_PRESETS.uploadOps,
    });

    const body = (await request.json()) as { storedPath?: string };
    assertUploadMetadataInput(
      { storedPath: body?.storedPath ?? "" },
      "fdp-attended upload delete request"
    );
    const storedPath = String(body?.storedPath ?? "").trim();

    if (!storedPath) {
      return NextResponse.json({ error: "storedPath required" }, { status: 400 });
    }

    const recordId = getRecordIdFromStoredPath(storedPath);
    const slot = getSlotFromStoredPath(storedPath);
    if (recordId) {
      const existing = await getEntryForRecordId(email, recordId);
      if (existing && !isEntryEditable(existing)) {
        return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
      }
    }

    const resolved = resolveOwnedStoredPath(email, storedPath);
    await fs.unlink(resolved.absolutePath).catch(() => null);
    if (recordId && slot) {
      const list = await readList(email);
      const nextList = list.map((item) =>
        sanitizeSegment(String(item?.id ?? "")) === sanitizeSegment(recordId)
          ? {
              ...item,
              [slot]: null,
              updatedAt: new Date().toISOString(),
            }
          : item
      );
      await writeList(email, nextList);
    }
    return NextResponse.json({ ok: true, storedPath: resolved.normalized });
  } catch (error) {
    const appError = normalizeError(error);
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    if (appError.code === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
    }
    const message = appError.message || "Invalid storedPath";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 400 });
  }
}
