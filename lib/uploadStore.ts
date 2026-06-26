import "server-only";
// lib/uploadStore.ts
import fs from "fs";
import path from "path";

/* S0: profile documents and uploads contain PII — they live under the
   gitignored .data/ root, never under the git-tracked data/ tree. */
export const DATA_DIR = path.join(process.cwd(), ".data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const PROFILES_DIR = path.join(DATA_DIR, "profiles");

export function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

export function safeEmailKey(email: string) {
  return email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
}

export function extFromFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return ext;
}
