import "server-only";
// lib/uploadStore.ts
import fs from "fs";
import path from "path";
import { APP_CONFIG } from "@/lib/config/appConfig";

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
  const okExt = (APP_CONFIG.upload.allowedExtensions as readonly string[]).includes(ext);
  const allMimeTypes = [...APP_CONFIG.upload.allowedDocMimeTypes, ...APP_CONFIG.upload.allowedImageMimeTypes];
  const okType = allMimeTypes.includes(contentType);
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
