import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  CATEGORY_STORE_SCHEMA_VERSION,
  migrateCategoryStore,
  migrateEntry,
} from "@/lib/migrations";
import type { Entry } from "@/lib/types/entry";
import { getUserCategoryStoreFile } from "@/lib/userStore";
import { logger, withTimer } from "@/lib/logger";
import { readJsonFileDetailed } from "./integrityCheckCategory";
import {
  isUploadedFileLike,
  normalizeId,
  toISO,
  type RepairResult,
} from "./integrityTypes";

// ---------------------------------------------------------------------------
// createBackup
// ---------------------------------------------------------------------------

export async function createBackup(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const backupPath = `${filePath}.bak.${stamp}`;
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

// ---------------------------------------------------------------------------
// normalizeEntryForRepair
// ---------------------------------------------------------------------------

export function normalizeEntryForRepair(
  value: unknown,
  key: string,
  category: CategoryKey,
  userEmail: string,
  nowISO: string
): { entry: Entry | null; fixed: string[] } {
  const fixed = new Array<string>();
  const migrated = migrateEntry(value);
  if (!migrated.ok) {
    fixed.push(`Removed invalid entry ${key}.`);
    return { entry: null, fixed };
  }

  const entry = { ...migrated.data } as Entry;
  entry.id = key;
  if (String(entry.category ?? "").trim().toLowerCase() !== category) {
    entry.category = category;
    fixed.push(`Entry ${key}: normalized category.`);
  }

  if (normalizeEmail(String(entry.ownerEmail ?? "")) !== userEmail) {
    entry.ownerEmail = userEmail;
    fixed.push(`Entry ${key}: normalized ownerEmail.`);
  }

  const canonicalStatus = normalizeEntryStatus(entry as EntryStateLike);
  if (entry.confirmationStatus !== canonicalStatus) {
    entry.confirmationStatus = canonicalStatus;
    fixed.push(`Entry ${key}: normalized confirmationStatus.`);
  }

  if (!toISO(entry.createdAt)) {
    entry.createdAt = nowISO;
    fixed.push(`Entry ${key}: restored createdAt.`);
  }
  if (!toISO(entry.updatedAt)) {
    entry.updatedAt = String(entry.createdAt ?? nowISO);
    fixed.push(`Entry ${key}: restored updatedAt.`);
  }

  if (!Array.isArray(entry.attachments)) {
    entry.attachments = [];
    fixed.push(`Entry ${key}: normalized attachments to array.`);
  } else {
    const filtered = entry.attachments.filter((item) => isUploadedFileLike(item));
    if (filtered.length !== entry.attachments.length) {
      entry.attachments = filtered;
      fixed.push(`Entry ${key}: removed invalid attachments.`);
    }
  }

  return { entry, fixed };
}

// ---------------------------------------------------------------------------
// repairCategoryStoreInternal
// ---------------------------------------------------------------------------

export async function repairCategoryStoreInternal(
  userEmail: string,
  category: CategoryKey,
  options?: { backup?: boolean }
): Promise<RepairResult> {
  return withTimer(
    "admin.integrity.repair.category",
    async () => {
      const normalizedUserEmail = normalizeEmail(userEmail);
      const nowISO = new Date().toISOString();
      const filePath = getUserCategoryStoreFile(
        normalizedUserEmail,
        CATEGORY_STORE_FILES[category]
      );
      const read = await readJsonFileDetailed(filePath);
      const raw = read.parseError ? [] : read.parsed;
      const migrated = migrateCategoryStore(raw);
      if (!migrated.ok) {
        throw migrated.error;
      }

      const store = migrated.data;
      const fixedIssues = new Array<string>();
      const backupsCreated = new Array<string>();
      const filesTouched = new Array<string>();

      const seen = new Set<string>();
      const nextOrder = new Array<string>();
      const duplicatesRemoved = new Set<string>();
      const orphansRemoved = new Set<string>();

      for (const rawId of store.order) {
        const id = normalizeId(rawId);
        if (!id) continue;
        if (!store.byId[id]) {
          orphansRemoved.add(id);
          continue;
        }
        if (seen.has(id)) {
          duplicatesRemoved.add(id);
          continue;
        }
        seen.add(id);
        nextOrder.push(id);
      }

      if (duplicatesRemoved.size > 0) {
        fixedIssues.push(
          `Removed duplicate IDs from order: ${[...duplicatesRemoved].join(", ")}.`
        );
      }
      if (orphansRemoved.size > 0) {
        fixedIssues.push(
          `Removed orphan IDs from order: ${[...orphansRemoved].join(", ")}.`
        );
      }

      const nextById: Record<string, Entry> = {};
      const removedInvalid = new Array<string>();
      for (const id of nextOrder) {
        const rawEntry = store.byId[id];
        const normalized = normalizeEntryForRepair(
          rawEntry,
          id,
          category,
          normalizedUserEmail,
          nowISO
        );
        fixedIssues.push(...normalized.fixed);
        if (!normalized.entry) {
          removedInvalid.push(id);
          continue;
        }
        nextById[id] = normalized.entry;
      }

      if (removedInvalid.length > 0) {
        fixedIssues.push(`Dropped invalid entries: ${removedInvalid.join(", ")}.`);
      }

      for (const rawKey of Object.keys(store.byId)) {
        const id = normalizeId(rawKey);
        if (!id) continue;
        if (nextById[id]) continue;

        const normalized = normalizeEntryForRepair(
          store.byId[id],
          id,
          category,
          normalizedUserEmail,
          nowISO
        );
        fixedIssues.push(...normalized.fixed);
        if (!normalized.entry) {
          continue;
        }
        nextById[id] = normalized.entry;
        nextOrder.push(id);
        fixedIssues.push(`Added missing order ID: ${id}.`);
      }

      const dedupedOrder = new Array<string>();
      const seenOrder = new Set<string>();
      for (const id of nextOrder) {
        if (!nextById[id]) continue;
        if (seenOrder.has(id)) continue;
        seenOrder.add(id);
        dedupedOrder.push(id);
      }

      const repairedStore = {
        version: CATEGORY_STORE_SCHEMA_VERSION,
        byId: nextById,
        order: dedupedOrder,
      };

      const previousComparable = read.exists && !read.parseError ? read.parsed : null;
      const changed = JSON.stringify(previousComparable) !== JSON.stringify(repairedStore);
      if (changed || !read.exists) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        if (options?.backup !== false && read.exists) {
          const backupPath = await createBackup(filePath);
          if (backupPath) {
            backupsCreated.push(backupPath);
          }
        }
        await atomicWriteTextFile(filePath, JSON.stringify(repairedStore, null, 2));
        filesTouched.push(filePath);
      }

      logger.info({
        event: "admin.integrity.repair.category.result",
        userEmail: normalizedUserEmail,
        category,
        count: fixedIssues.length,
        filesTouched: filesTouched.length,
      });

      return {
        userEmail: normalizedUserEmail,
        category,
        fixedIssues,
        backupsCreated,
        filesTouched,
      };
    },
    {
      userEmail: normalizeEmail(userEmail),
      category,
    }
  );
}
