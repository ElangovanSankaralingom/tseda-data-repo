// lib/uploadStore.ts
import fs from "fs";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
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

export function assertAllowedUpload(contentType: string, fileName: string) {
  const ext = extFromFileName(fileName);
  const okExt = [".pdf", ".png", ".jpg", ".jpeg"].includes(ext);
  const okType =
    contentType === "application/pdf" ||
    contentType === "image/png" ||
    contentType === "image/jpeg";
  if (!okExt || !okType) {
    throw new Error("Only pdf/jpg/png are allowed.");
  }
}

export function writeFileBytes(filePath: string, bytes: Uint8Array) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(bytes));
}

export function deleteIfExists(filePath: string) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}