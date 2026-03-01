import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getProfileByEmail, upsertProfile, StoredFile } from "@/lib/profileStore";

const ACCEPT = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_MB = 20;

function safe(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function ensureCategory(category: string) {
  if (category !== "academicOutside" && category !== "industry") throw new Error("Invalid category");
  return category as "academicOutside" | "industry";
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!email.toLowerCase().endsWith("@tce.edu")) return NextResponse.json({ error: "AccessDenied" }, { status: 403 });

  const form = await req.formData();
  const categoryRaw = String(form.get("category") ?? "");
  const entryId = String(form.get("entryId") ?? "");
  const file = form.get("file") as File | null;

  if (!entryId) return NextResponse.json({ error: "Missing entryId" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  let category: "academicOutside" | "industry";
  try { category = ensureCategory(categoryRaw); }
  catch { return NextResponse.json({ error: "Invalid category" }, { status: 400 }); }

  if (!ACCEPT.has(file.type)) return NextResponse.json({ error: "Only PDF/JPG/PNG allowed" }, { status: 400 });
  if (file.size > MAX_MB * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  const profile = await getProfileByEmail(email);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // locate entry and enforce DELETE FIRST (no overwrite)
  if (category === "academicOutside") {
    const idx = profile.experience.academicOutside.findIndex((x) => x.id === entryId);
    if (idx === -1) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (profile.experience.academicOutside[idx].certificate?.path) {
      return NextResponse.json({ error: "Delete existing certificate first." }, { status: 409 });
    }
  } else {
    const idx = profile.experience.industry.findIndex((x) => x.id === entryId);
    if (idx === -1) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (profile.experience.industry[idx].certificate?.path) {
      return NextResponse.json({ error: "Delete existing certificate first." }, { status: 409 });
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "data", "uploads", email.toLowerCase(), "certs", category, entryId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `cert_${crypto.randomUUID()}_${safe(file.name)}`;
  const abs = path.join(dir, filename);

  await fs.writeFile(abs, bytes);

  const stored: StoredFile = {
    path: abs,
    fileName: file.name,
    contentType: file.type,
    uploadedAt: new Date().toISOString(),
  };

  const next = JSON.parse(JSON.stringify(profile));
  if (category === "academicOutside") {
    const idx = next.experience.academicOutside.findIndex((x: any) => x.id === entryId);
    next.experience.academicOutside[idx].certificate = stored;
  } else {
    const idx = next.experience.industry.findIndex((x: any) => x.id === entryId);
    next.experience.industry[idx].certificate = stored;
  }

  const updated = await upsertProfile(email, next);
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!email.toLowerCase().endsWith("@tce.edu")) return NextResponse.json({ error: "AccessDenied" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const categoryRaw = String(body?.category ?? "");
  const entryId = String(body?.entryId ?? "");
  if (!entryId) return NextResponse.json({ error: "Missing entryId" }, { status: 400 });

  let category: "academicOutside" | "industry";
  try { category = ensureCategory(categoryRaw); }
  catch { return NextResponse.json({ error: "Invalid category" }, { status: 400 }); }

  const profile = await getProfileByEmail(email);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const next = JSON.parse(JSON.stringify(profile));
  let certPath: string | null = null;

  if (category === "academicOutside") {
    const idx = next.experience.academicOutside.findIndex((x: any) => x.id === entryId);
    if (idx === -1) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    certPath = next.experience.academicOutside[idx]?.certificate?.path ?? null;
    next.experience.academicOutside[idx].certificate = undefined;
  } else {
    const idx = next.experience.industry.findIndex((x: any) => x.id === entryId);
    if (idx === -1) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    certPath = next.experience.industry[idx]?.certificate?.path ?? null;
    next.experience.industry[idx].certificate = undefined;
  }

  if (certPath) {
    const base = path.join(process.cwd(), "data", "uploads", email.toLowerCase());
    const resolved = path.resolve(certPath);
    if (resolved.startsWith(path.resolve(base))) {
      await fs.rm(resolved, { force: true }).catch(() => {});
    }
  }

  const updated = await upsertProfile(email, next);
  return NextResponse.json(updated);
}