import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { assertUploadMetadataInput } from "@/lib/security/limits";

type Category = "academic_outside" | "industry";
type ExperienceCertificate = {
  fileId?: string;
  fileName?: string;
  mime?: string;
  size?: number;
  uploadedAt?: string;
  storagePath?: string;
  downloadUrl?: string;
} | null;
type ExperienceEntryRecord = {
  id: string;
  certificate?: ExperienceCertificate;
};
type ExperienceProfile = {
  email?: string;
  experience?: {
    academicOutside?: ExperienceEntryRecord[];
    industry?: ExperienceEntryRecord[];
  };
};

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

function safeEmailDir(email: string) {
  return email.replace(/[^a-zA-Z0-9@._-]/g, "_");
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function extFromMime(mime: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

async function readProfile(email: string): Promise<ExperienceProfile> {
  const base = path.join(process.cwd(), "data", "profiles");
  await ensureDir(base);
  const file = path.join(base, `${safeEmailDir(email)}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    const fresh = { email };
    await fs.writeFile(file, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

async function writeProfile(email: string, profile: ExperienceProfile) {
  const base = path.join(process.cwd(), "data", "profiles");
  await ensureDir(base);
  const file = path.join(base, `${safeEmailDir(email)}.json`);
  await fs.writeFile(file, JSON.stringify(profile, null, 2), "utf8");
}

function findEntry(profile: ExperienceProfile, category: Category, entryId: string) {
  const exp = profile?.experience || {};
  if (category === "academic_outside") {
    const list = exp.academicOutside || [];
    const idx = list.findIndex((x) => x.id === entryId);
    return { list, idx, key: "academicOutside" as const };
  }
  const list = exp.industry || [];
  const idx = list.findIndex((x) => x.id === entryId);
  return { list, idx, key: "industry" as const };
}

function requireQuery(req: Request, key: string) {
  const url = new URL(req.url);
  const v = url.searchParams.get(key);
  if (!v) throw new Error(`Missing query param: ${key}`);
  return v;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!email.endsWith("@tce.edu")) return NextResponse.json({ error: "AccessDenied" }, { status: 403 });

  let category = "";
  let entryId = "";
  try {
    category = requireQuery(req, "category");
    entryId = requireQuery(req, "entryId");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (category !== "academic_outside" && category !== "industry") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 20MB" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Only pdf/jpg/png allowed" }, { status: 400 });
  }

  try {
    assertUploadMetadataInput({ category, entryId, fileName: file.name, size: file.size, mimeType: file.type }, "experience certificate upload");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Metadata validation failed";
    return NextResponse.json({ error: message }, { status: 413 });
  }

  const profile = await readProfile(email);
  profile.experience = profile.experience || {};
  profile.experience.academicOutside = profile.experience.academicOutside || [];
  profile.experience.industry = profile.experience.industry || [];

  const { list, idx, key } = findEntry(profile, category as Category, entryId);
  if (idx < 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  // delete-first if existing
  const existing = list[idx]?.certificate;
  if (existing?.storagePath) {
    try {
      await fs.unlink(existing.storagePath);
    } catch {}
  }

  const baseDir = path.join(process.cwd(), "data", "uploads", safeEmailDir(email), "experience", category);
  await ensureDir(baseDir);

  const fileId = crypto.randomUUID();
  const ext = extFromMime(file.type);
  const storagePath = path.join(baseDir, `${entryId}-${fileId}.${ext}`);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, bytes);

  const certificate = {
    fileId,
    fileName: file.name,
    mime: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    storagePath,
    downloadUrl: `/api/me/experience/certificate?category=${category}&entryId=${entryId}`,
  };

  list[idx].certificate = certificate;
  profile.experience[key] = list;
  await writeProfile(email, profile);

  return NextResponse.json({ ok: true, certificate });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!email.endsWith("@tce.edu")) return NextResponse.json({ error: "AccessDenied" }, { status: 403 });

  let category = "";
  let entryId = "";
  try {
    category = requireQuery(req, "category");
    entryId = requireQuery(req, "entryId");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (category !== "academic_outside" && category !== "industry") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const profile = await readProfile(email);
  const { list, idx, key } = findEntry(profile, category as Category, entryId);
  if (idx < 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const cert = list[idx]?.certificate;
  if (cert?.storagePath) {
    try {
      await fs.unlink(cert.storagePath);
    } catch {}
  }
  list[idx].certificate = null;
  profile.experience = profile.experience || {};
  profile.experience[key] = list;
  await writeProfile(email, profile);

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!email.endsWith("@tce.edu")) return NextResponse.json({ error: "AccessDenied" }, { status: 403 });

  let category = "";
  let entryId = "";
  try {
    category = requireQuery(req, "category");
    entryId = requireQuery(req, "entryId");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (category !== "academic_outside" && category !== "industry") {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const profile = await readProfile(email);
  const { list, idx } = findEntry(profile, category as Category, entryId);
  if (idx < 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const cert = list[idx]?.certificate;
  if (!cert?.storagePath) return NextResponse.json({ error: "No certificate" }, { status: 404 });

  const fileBytes = await fs.readFile(cert.storagePath);
  return new NextResponse(fileBytes, {
    headers: {
      "Content-Type": cert.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(cert.fileName || "certificate")}"`,
      "Cache-Control": "no-store",
    },
  });
}
