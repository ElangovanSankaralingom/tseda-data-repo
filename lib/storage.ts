import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/** Git-tracked operational data (faculty roster, admin list). NEVER put PII here. */
const DATA_DIR = path.join(process.cwd(), "data");
/** Gitignored private root for anything containing PII (S0 audit fix). */
export const PRIVATE_DIR = path.join(process.cwd(), ".data");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson<T>(fileName: string, fallback: T, baseDir: string = DATA_DIR): Promise<T> {
  await ensureDir(baseDir);
  const filePath = path.join(baseDir, fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(fileName: string, data: T, baseDir: string = DATA_DIR): Promise<void> {
  await ensureDir(baseDir);
  const filePath = path.join(baseDir, fileName);
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
}

export function newId(): string {
  return crypto.randomUUID();
}
