import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";

export function safeEmailDir(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

export function getUserStoreDir(email: string) {
  return path.join(process.cwd(), ".data", "users", safeEmailDir(email));
}

export function getUserCategoryStoreFile(email: string, fileName: string) {
  return path.join(getUserStoreDir(email), fileName);
}
