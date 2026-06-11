import "server-only";

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";
import { listUsers } from "@/lib/admin/integrity";
import { CATEGORY_LIST } from "@/data/categoryRegistry";
import { readCategoryEntries } from "@/lib/dataStore";
import { ENTRY_UPLOADS_ROOT } from "@/lib/config/storagePaths";

export type OrphanScanResult = {
  orphanPaths: string[];
  scannedFiles: number;
  referencedFiles: number;
};

/**
 * Scans the private entry-uploads root for files not referenced by any entry.
 * Returns a list of orphan file paths (does NOT delete — just reports).
 * Files younger than 24 hours are excluded (may be mid-upload).
 */
export async function findOrphanUploads(): Promise<OrphanScanResult> {
  const uploadsRoot = ENTRY_UPLOADS_ROOT;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Step 1: Collect all referenced file paths from entries
  const referencedPaths = new Set<string>();
  const usersResult = await listUsers();
  const userEmails = usersResult.ok ? usersResult.data : [];

  for (const email of userEmails) {
    for (const category of CATEGORY_LIST) {
      try {
        const entries = await readCategoryEntries(email, category);
        for (const entry of entries) {
          collectFilePaths(entry as Record<string, unknown>, referencedPaths);
        }
      } catch {
        // Skip categories that fail to load
      }
    }
  }

  // Step 2: Walk public/uploads/ and find unreferenced files
  const orphanPaths: string[] = [];
  let scannedFiles = 0;

  async function walkDir(dir: string) {
    let dirEntries: Dirent[];
    try {
      dirEntries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const dirEntry of dirEntries) {
      const fullPath = path.join(dir, dirEntry.name);
      if (dirEntry.isDirectory()) {
        await walkDir(fullPath);
      } else if (dirEntry.isFile()) {
        scannedFiles++;
        const uploadsRelative = path.relative(uploadsRoot, fullPath).replace(/\\/g, "/");
        const relativePath = `uploads/${uploadsRelative}`;
        const isReferenced = referencedPaths.has(relativePath) ||
          referencedPaths.has(uploadsRelative) ||
          referencedPaths.has(`/${relativePath}`) ||
          referencedPaths.has(`/uploads/${uploadsRelative}`);
        if (!isReferenced) {
          try {
            const stat = await fs.stat(fullPath);
            if (now - stat.mtimeMs > ONE_DAY_MS) {
              orphanPaths.push(fullPath);
            }
          } catch {
            // Skip stat failures
          }
        }
      }
    }
  }

  try {
    await walkDir(uploadsRoot);
  } catch {
    // uploads dir may not exist
  }

  logger.info({
    event: "jobs.orphan_scan.complete",
    scannedFiles,
    referencedFiles: referencedPaths.size,
    orphanCount: orphanPaths.length,
  });

  return { orphanPaths, scannedFiles, referencedFiles: referencedPaths.size };
}

function collectFilePaths(obj: unknown, paths: Set<string>) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectFilePaths(item, paths);
    return;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record.storedPath === "string" && record.storedPath) {
    paths.add(record.storedPath);
  }
  if (typeof record.url === "string" && record.url) {
    paths.add(record.url);
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectFilePaths(value, paths);
  }
}
