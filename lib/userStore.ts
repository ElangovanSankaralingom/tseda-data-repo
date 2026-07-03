import "server-only";
import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { universeRoot } from "@/lib/demo/universe";

export function safeEmailDir(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

/** The REAL data root. SHARED stores (settings, registry, preferences,
 *  awards config, demo state) resolve from this directly and never fork. */
export function getDataRoot() {
  const value = process.env.DATA_ROOT?.trim();
  return value || ".data";
}

/** The data root of the CURRENT UNIVERSE — `<root>/demo` inside a demo-mode
 *  request, the real root otherwise. All per-user data and its side-effect
 *  stores (feed, action history, analytics cache) resolve through this. */
export function getUniverseDataRoot() {
  return universeRoot(getDataRoot());
}

export function getUsersRootDir(dataRoot?: string) {
  return path.join(process.cwd(), dataRoot ?? getUniverseDataRoot(), "users");
}

export function getUserStoreDir(email: string, dataRoot?: string) {
  return path.join(getUsersRootDir(dataRoot), safeEmailDir(email));
}

export function getUserCategoryStoreFile(email: string, fileName: string, dataRoot?: string) {
  return path.join(getUserStoreDir(email, dataRoot), fileName);
}
