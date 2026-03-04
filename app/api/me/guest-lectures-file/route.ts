import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isEntryEditable } from "@/lib/gamification";
import { getUserCategoryStoreFile, safeEmailDir } from "@/lib/userStore";

type Slot =
  | "permissionLetter"
  | "brochure"
  | "attendance"
  | "speakerProfile"
  | "geotaggedPhotos";

type GuestLectureRecord = {
  id: string;
  status?: "draft" | "final";
  pdfMeta?: { storedPath?: string | null; url?: string | null } | null;
  uploads?: Record<string, unknown> | null;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  streak?: unknown;
  requestEditStatus?: string | null;
};

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const ALLOWED_SLOTS = new Set<Slot>([
  "permissionLetter",
  "brochure",
  "attendance",
  "speakerProfile",
  "geotaggedPhotos",
]);

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getStoreFile(email: string) {
  return getUserCategoryStoreFile(email, "guest-lectures.json");
}

async function readList(email: string): Promise<GuestLectureRecord[]> {
  try {
    const raw = await fs.readFile(getStoreFile(email), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GuestLectureRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: GuestLectureRecord[]) {
  const filePath = getStoreFile(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
}

async function getEntryForRecordId(email: string, recordId: string) {
  const safeRecordId = safeName(recordId);
  const list = await readList(email);
  return list.find((item) => safeName(String(item?.id ?? "")) === safeRecordId) ?? null;
}

function getRecordIdFromStoredPath(storedPath: string) {
  const normalized = normalizeStoredPath(storedPath);
  const parts = normalized.split("/");

  if (parts.length < 5) return null;
  if (parts[0] !== "uploads" || parts[2] !== "guest-lectures") return null;

  return parts[3] ?? null;
}

function getSlotFromStoredPath(storedPath: string): Slot | null {
  const normalized = normalizeStoredPath(storedPath);
  const parts = normalized.split("/");

  if (parts.length < 6) return null;
  if (parts[0] !== "uploads" || parts[2] !== "guest-lectures") return null;

  const slot = parts[4] ?? null;
  return ALLOWED_SLOTS.has(slot as Slot) ? (slot as Slot) : null;
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
}

function normalizeStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");

  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }

  return normalized;
}

export async function POST(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const recordId = String(form.get("recordId") ?? "").trim();
    const slot = String(form.get("slot") ?? "").trim() as Slot;
    const file = form.get("file");

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    if (safeEmailDir(email) !== safeEmailDir(authorizedEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    if (!isEntryEditable(existing)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
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

    const relDir = path.posix.join(
      "uploads",
      safeEmailDir(email),
      "guest-lectures",
      safeName(recordId),
      slot
    );
    const stampedFileName = `${Date.now()}-${safeName(file.name)}`;
    const storedPath = path.posix.join(relDir, stampedFileName);
    const absPath = path.join(process.cwd(), "public", storedPath);

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: `/${storedPath}`,
      storedPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authorizedEmail = await getAuthorizedEmail();
  if (!authorizedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { storedPath?: string };
    const storedPath = normalizeStoredPath(String(body?.storedPath ?? "").trim());
    const ownerPrefix = path.posix.join("uploads", safeEmailDir(authorizedEmail), "guest-lectures") + "/";

    if (!storedPath.startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const recordId = getRecordIdFromStoredPath(storedPath);
    const slot = getSlotFromStoredPath(storedPath);
    if (recordId) {
      const existing = await getEntryForRecordId(authorizedEmail, recordId);
      if (existing && !isEntryEditable(existing)) {
        return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
      }
    }

    await fs.unlink(path.join(process.cwd(), "public", storedPath)).catch(() => null);
    if (recordId && slot) {
      const list = await readList(authorizedEmail);
      const nextList = list.map((item) => {
        if (safeName(String(item?.id ?? "")) !== safeName(recordId)) {
          return item;
        }
        const currentUploads =
          item.uploads && typeof item.uploads === "object" ? { ...item.uploads } : {};
        currentUploads[slot] = slot === "geotaggedPhotos" ? [] : null;
        return {
          ...item,
          uploads: currentUploads,
          updatedAt: new Date().toISOString(),
        };
      });
      await writeList(authorizedEmail, nextList);
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
