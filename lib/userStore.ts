import "server-only";
import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";

export function safeEmailDir(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

export function getDataRoot() {
  const value = process.env.DATA_ROOT?.trim();
  return value || ".data";
}

export function getUsersRootDir(dataRoot = getDataRoot()) {
  return path.join(process.cwd(), dataRoot, "users");
}

export function getUserStoreDir(email: string, dataRoot = getDataRoot()) {
  return path.join(getUsersRootDir(dataRoot), safeEmailDir(email));
}

export function getUserCategoryStoreFile(email: string, fileName: string, dataRoot = getDataRoot()) {
  return path.join(getUserStoreDir(email, dataRoot), fileName);
}
