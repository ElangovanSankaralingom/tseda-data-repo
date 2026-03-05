import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { safeEmailDir } from "@/lib/userStore";
import { PROFILES_DIR, safeEmailKey } from "@/lib/uploadStore";

const LEGACY_DATA_DIR = path.join(process.cwd(), "data");
const MODERN_USERS_DIR = path.join(process.cwd(), ".data", "users");
const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const LEGACY_STORAGE_DIR = path.join(process.cwd(), "storage");
const LEGACY_CATEGORY_DIRS = CATEGORY_KEYS;

function legacyEmailKey(email: string) {
  return email.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

async function removePath(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => null);
}

async function clearLegacyProfilesIndex(email: string) {
  const filePath = path.join(LEGACY_DATA_DIR, "profiles.json");

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return;
    }

    delete parsed[email];
    delete parsed[email.toLowerCase()];

    await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), "utf8");
  } catch {
    return;
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email;
  const email = sessionEmail ? normalizeEmail(sessionEmail) : "";

  if (!email || !email.endsWith("@tce.edu")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modernEmailKey = safeEmailDir(email);
  const legacyKey = legacyEmailKey(email);
  const profileKey = safeEmailKey(email);

  const pathsToRemove = [
    path.join(PROFILES_DIR, `${profileKey}.json`),
    path.join(MODERN_USERS_DIR, modernEmailKey),
    path.join(LEGACY_DATA_DIR, "uploads", modernEmailKey),
    path.join(LEGACY_DATA_DIR, "uploads", legacyKey),
    path.join(PUBLIC_UPLOADS_DIR, modernEmailKey),
    path.join(PUBLIC_UPLOADS_DIR, legacyKey),
    path.join(LEGACY_STORAGE_DIR, modernEmailKey),
    path.join(LEGACY_STORAGE_DIR, legacyKey),
    ...LEGACY_CATEGORY_DIRS.flatMap((dirName) => [
      path.join(LEGACY_DATA_DIR, dirName, `${modernEmailKey}.json`),
      path.join(LEGACY_DATA_DIR, dirName, `${legacyKey}.json`),
    ]),
  ];

  await Promise.all(pathsToRemove.map((targetPath) => removePath(targetPath)));
  await clearLegacyProfilesIndex(email);

  return NextResponse.json({ success: true });
}
