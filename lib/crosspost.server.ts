import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";

export type SharedFileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

function normalizeStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }
  return normalized;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function safeEmailToPath(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function copyFileWithDirs(srcPath: string, destPath: string) {
  await ensureDir(path.dirname(destPath));
  await fs.copyFile(srcPath, destPath);
}

export async function cloneFileMetaToTarget(
  meta: SharedFileMeta,
  targetEmail: string,
  category: string,
  sharedEntryId: string,
  slot: string
): Promise<SharedFileMeta> {
  const normalizedSourcePath = normalizeStoredPath(meta.storedPath);
  const safeEmail = safeEmailToPath(targetEmail);
  const nextStoredPath = path.posix.join(
    "uploads",
    safeEmail,
    category,
    safeName(sharedEntryId),
    safeName(slot),
    `${Date.now()}-${safeName(meta.fileName)}`
  );
  const sourcePath = path.join(process.cwd(), "public", normalizedSourcePath);
  const destinationPath = path.join(process.cwd(), "public", nextStoredPath);

  await copyFileWithDirs(sourcePath, destinationPath);

  return {
    ...meta,
    uploadedAt: new Date().toISOString(),
    url: `/${nextStoredPath}`,
    storedPath: nextStoredPath,
  };
}

export async function cloneFileMetaArrayToTarget(
  metas: SharedFileMeta[],
  targetEmail: string,
  category: string,
  sharedEntryId: string,
  slot: string
) {
  const next: SharedFileMeta[] = [];
  for (const meta of metas) {
    next.push(await cloneFileMetaToTarget(meta, targetEmail, category, sharedEntryId, slot));
  }
  return next;
}
