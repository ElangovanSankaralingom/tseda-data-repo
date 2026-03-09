/**
 * One-time migration: normalize all existing entries to have correct
 * streak/lifecycle fields that engine.ts now sets on every mutation.
 *
 * This ensures old entries (created before Phase 3 engine delegation)
 * have pdfGenerated, streakEligible, and editWindowExpiresAt set correctly.
 *
 * Run once: npx tsx scripts/migrate-normalize-entries.ts
 * Safe to run multiple times (idempotent).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_STORE_FILES } from "../lib/categoryStore.ts";
import { CATEGORY_KEYS } from "../lib/categories.ts";

// Inline getUsersRootDir to avoid importing userStore.ts which has "server-only"
function getUsersRootDir() {
  const dataRoot = process.env.DATA_ROOT?.trim() || ".data";
  return path.join(process.cwd(), dataRoot, "users");
}

// Inline normalizeEntryStreakFields to avoid transitive "server-only" imports
// from postSave.ts → lib/time.ts. This is a copy of the logic from postSave.ts.
function hasPdfMeta(entry: Record<string, unknown>): boolean {
  const meta = entry.pdfMeta;
  if (!meta || typeof meta !== "object") return false;
  const record = meta as Record<string, unknown>;
  return !!(
    typeof record.storedPath === "string" &&
    record.storedPath.trim() &&
    typeof record.url === "string" &&
    record.url.trim()
  );
}

function nowISTDateISO(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function normalizeEntryStreakFields(
  entry: Record<string, unknown>,
): Record<string, unknown> {
  if (hasPdfMeta(entry)) {
    entry.pdfGenerated = true;
    if (!entry.pdfGeneratedAt) {
      const meta = entry.pdfMeta as Record<string, unknown>;
      if (typeof meta.generatedAtISO === "string" && meta.generatedAtISO.trim()) {
        entry.pdfGeneratedAt = meta.generatedAtISO;
      }
    }
  } else if (
    typeof entry.pdfGeneratedAt === "string" &&
    entry.pdfGeneratedAt.trim()
  ) {
    entry.pdfGenerated = true;
  }

  if (entry.pdfGenerated === true) {
    const endDate = entry.endDate;
    if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      const todayIST = nowISTDateISO();
      entry.streakEligible = endDate.trim() > todayIST;
    } else {
      entry.streakEligible = false;
    }
  }

  const status = entry.confirmationStatus ?? entry.status;
  if (
    status === "GENERATED" &&
    !entry.editWindowExpiresAt &&
    entry.pdfGenerated === true
  ) {
    const baseISO =
      (typeof entry.committedAtISO === "string" && entry.committedAtISO.trim()
        ? entry.committedAtISO
        : typeof entry.generatedAt === "string" && entry.generatedAt.trim()
          ? entry.generatedAt
          : typeof entry.pdfGeneratedAt === "string" && entry.pdfGeneratedAt.trim()
            ? entry.pdfGeneratedAt
            : null) as string | null;

    if (baseISO) {
      const DEFAULT_EDIT_WINDOW_DAYS = 3;
      const STREAK_BUFFER_DAYS = 8;
      const defaultExpiry = new Date(
        new Date(baseISO).getTime() + DEFAULT_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      if (
        entry.streakEligible === true &&
        typeof entry.endDate === "string" &&
        entry.endDate.trim()
      ) {
        const endDateExpiry = new Date(
          new Date(entry.endDate.trim() + "T23:59:59.999Z").getTime() +
            STREAK_BUFFER_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();
        entry.editWindowExpiresAt =
          endDateExpiry > defaultExpiry ? endDateExpiry : defaultExpiry;
      } else {
        entry.editWindowExpiresAt = defaultExpiry;
      }
    }
  }

  return entry;
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function normalizeCategoryFile(
  filePath: string,
): Promise<{ file: string; total: number; normalized: number }> {
  const parsed = await readJsonFile(filePath);
  if (!parsed || typeof parsed !== "object") {
    return { file: path.basename(filePath), total: 0, normalized: 0 };
  }

  const store = parsed as { byId?: Record<string, unknown>; order?: string[] };
  const byId = store.byId ?? {};
  let normalized = 0;
  let changed = false;

  for (const [entryId, entry] of Object.entries(byId)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const before = stableJson(record);
    normalizeEntryStreakFields(record);
    if (stableJson(record) !== before) {
      byId[entryId] = record;
      normalized++;
      changed = true;
    }
  }

  if (changed) {
    await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
  }

  return {
    file: path.basename(filePath),
    total: Object.keys(byId).length,
    normalized,
  };
}

async function main() {
  const usersRoot = getUsersRootDir();
  let userDirs: string[] = [];
  try {
    const entries = await fs.readdir(usersRoot, { withFileTypes: true });
    userDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(usersRoot, entry.name));
  } catch {
    console.log("[migrate-normalize] No users root found. Nothing to migrate.");
    return;
  }

  let totalUsers = 0;
  let totalEntries = 0;
  let totalNormalized = 0;

  for (const userDir of userDirs) {
    totalUsers++;
    for (const category of CATEGORY_KEYS) {
      const fileName = CATEGORY_STORE_FILES[category];
      const filePath = path.join(userDir, fileName);
      try {
        await fs.access(filePath);
      } catch {
        continue;
      }
      const result = await normalizeCategoryFile(filePath);
      totalEntries += result.total;
      totalNormalized += result.normalized;
      if (result.normalized > 0) {
        console.log(
          `  [${path.basename(userDir)}] ${result.file}: ${result.normalized}/${result.total} entries normalized`,
        );
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        usersScanned: totalUsers,
        totalEntries,
        entriesNormalized: totalNormalized,
      },
      null,
      2,
    ),
  );
}

void main();
