import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { authOptions } from "@/lib/auth";
import { getProfileByEmail, upsertProfile, StoredFile } from "@/lib/profileStore";
import { assertUploadMetadataInput } from "@/lib/security/limits";

const ACCEPT = new Set(["image/jpeg", "image/png"]);
const MAX_MB = 20;

function safe(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!email.toLowerCase().endsWith("@tce.edu")) return NextResponse.json({ error: "AccessDenied" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!ACCEPT.has(file.type)) return NextResponse.json({ error: "Only JPG/PNG allowed for avatar" }, { status: 400 });
  if (file.size > MAX_MB * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  try {
    assertUploadMetadataInput({ fileName: file.name, size: file.size, mimeType: file.type }, "avatar upload");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Metadata validation failed";
    return NextResponse.json({ error: message }, { status: 413 });
  }

  const profile = await getProfileByEmail(email);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // DELETE FIRST rule: do not overwrite if custom exists
  if (profile.avatar?.mode === "custom" && profile.avatar?.custom?.path) {
    return NextResponse.json({ error: "Delete existing custom photo first." }, { status: 409 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "data", "uploads", email.toLowerCase(), "avatar");
  await fs.mkdir(dir, { recursive: true });

  const filename = `avatar_${crypto.randomUUID()}_${safe(file.name)}`;
  const abs = path.join(dir, filename);

  await fs.writeFile(abs, bytes);

  const stored: StoredFile = {
    path: abs,
    fileName: file.name,
    contentType: file.type,
    uploadedAt: new Date().toISOString(),
  };

  const updated = await upsertProfile(email, { avatar: { mode: "custom", custom: stored } });
  return NextResponse.json(updated);
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!email.toLowerCase().endsWith("@tce.edu")) return NextResponse.json({ error: "AccessDenied" }, { status: 403 });

  const profile = await getProfileByEmail(email);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const customPath = profile.avatar?.custom?.path;
  if (customPath) {
    const base = path.join(process.cwd(), "data", "uploads", email.toLowerCase());
    const resolved = path.resolve(customPath);
    if (resolved.startsWith(path.resolve(base))) {
      await fs.rm(resolved, { force: true }).catch(() => {});
    }
  }

  const updated = await upsertProfile(email, { avatar: { mode: "google" } });
  return NextResponse.json(updated);
}