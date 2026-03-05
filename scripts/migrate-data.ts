import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_STORE_FILES } from "../lib/categoryStore.ts";
import { CATEGORY_KEYS } from "../lib/categories.ts";
import {
  CATEGORY_STORE_SCHEMA_VERSION,
  migrateCategoryStore,
  migrateEntry,
  migrateUserIndex,
  migrateWalEvent,
} from "../lib/migrations/index.ts";
import { getUsersRootDir } from "../lib/userStore.ts";

type CategorySummary = {
  file: string;
  total: number;
  migrated: number;
  dropped: number;
  rewritten: boolean;
};

type UserSummary = {
  userDir: string;
  categories: CategorySummary[];
  indexMigrated: boolean;
  walValid: number;
  walInvalid: number;
};

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

async function migrateCategoryFile(filePath: string): Promise<CategorySummary> {
  const parsed = await readJsonFile(filePath);
  const list = Array.isArray(parsed) ? parsed : [];
  let migrated = 0;
  let dropped = 0;

  for (const item of list) {
    const result = migrateEntry(item);
    if (!result.ok) {
      dropped += 1;
      continue;
    }
    if (stableJson(item) !== stableJson(result.data)) {
      migrated += 1;
    }
  }

  const migratedStore = migrateCategoryStore(parsed);
  const nextStore = migratedStore.ok
    ? migratedStore.data
    : { version: CATEGORY_STORE_SCHEMA_VERSION, byId: {}, order: [] };
  const rewritten =
    stableJson(parsed) !== stableJson(nextStore) ||
    dropped > 0 ||
    migrated > 0;
  if (rewritten) {
    await fs.writeFile(filePath, JSON.stringify(nextStore, null, 2), "utf8");
  }

  return {
    file: path.basename(filePath),
    total: nextStore.order.length,
    migrated,
    dropped,
    rewritten,
  };
}

async function migrateIndexFile(filePath: string): Promise<boolean> {
  const parsed = await readJsonFile(filePath);
  if (!parsed) return false;

  const migrated = migrateUserIndex(parsed);
  if (!migrated.ok) return false;

  const changed = stableJson(parsed) !== stableJson(migrated.data);
  if (changed) {
    await fs.writeFile(filePath, JSON.stringify(migrated.data, null, 2), "utf8");
  }
  return changed;
}

async function validateWalFile(filePath: string): Promise<{ valid: number; invalid: number }> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    let valid = 0;
    let invalid = 0;

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const migrated = migrateWalEvent(parsed);
        if (migrated.ok) valid += 1;
        else invalid += 1;
      } catch {
        invalid += 1;
      }
    }

    return { valid, invalid };
  } catch {
    return { valid: 0, invalid: 0 };
  }
}

async function migrateUserDir(userDirPath: string): Promise<UserSummary> {
  const categories: CategorySummary[] = [];
  for (const category of CATEGORY_KEYS) {
    const fileName = CATEGORY_STORE_FILES[category];
    const filePath = path.join(userDirPath, fileName);
    try {
      await fs.access(filePath);
    } catch {
      continue;
    }
    categories.push(await migrateCategoryFile(filePath));
  }

  const indexPath = path.join(userDirPath, "index.json");
  const indexMigrated = await migrateIndexFile(indexPath);

  const walPath = path.join(userDirPath, "events.log");
  const { valid: walValid, invalid: walInvalid } = await validateWalFile(walPath);

  return {
    userDir: path.basename(userDirPath),
    categories,
    indexMigrated,
    walValid,
    walInvalid,
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
    console.log("[migrate-data] No users root found. Nothing to migrate.");
    return;
  }

  const summaries: UserSummary[] = [];
  for (const userDir of userDirs) {
    summaries.push(await migrateUserDir(userDir));
  }

  let migratedCategoryFiles = 0;
  let migratedEntries = 0;
  let droppedEntries = 0;
  let migratedIndexes = 0;
  let walValid = 0;
  let walInvalid = 0;

  for (const summary of summaries) {
    for (const category of summary.categories) {
      if (category.rewritten) migratedCategoryFiles += 1;
      migratedEntries += category.migrated;
      droppedEntries += category.dropped;
    }
    if (summary.indexMigrated) migratedIndexes += 1;
    walValid += summary.walValid;
    walInvalid += summary.walInvalid;
  }

  console.log(
    JSON.stringify(
      {
        usersScanned: summaries.length,
        migratedCategoryFiles,
        migratedEntries,
        droppedEntries,
        migratedIndexes,
        walValid,
        walInvalid,
      },
      null,
      2
    )
  );
}

void main();
