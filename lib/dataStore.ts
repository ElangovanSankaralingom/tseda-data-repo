import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import {
  normalizeEntryStatus,
  type EntryStateLike,
} from "@/lib/entryStateMachine";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import type { Entry } from "@/lib/types/entry";
import { getDataRoot, getUserCategoryStoreFile } from "@/lib/userStore";

export type EntryEngineRecord = Entry;

export type DataStoreEntry = EntryEngineRecord & {
  attachments?: unknown;
  status?: unknown;
  confirmationStatus?: unknown;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDataStoreEntry(entry: unknown): EntryEngineRecord | null {
  if (!isPlainRecord(entry)) return null;

  const next = { ...entry } as DataStoreEntry;
  next.confirmationStatus = normalizeEntryStatus(next as EntryStateLike);

  if (typeof next.status !== "string" || !next.status.trim()) {
    next.status = "draft";
  }

  if (!Array.isArray(next.attachments)) {
    next.attachments = [];
  }

  return next as EntryEngineRecord;
}

export class DataStore {
  private readonly dataRoot: string;

  constructor(options?: { dataRoot?: string }) {
    this.dataRoot = options?.dataRoot?.trim() || getDataRoot();
  }

  categoryFilePath(email: string, category: CategoryKey) {
    return getUserCategoryStoreFile(
      normalizeEmail(email),
      CATEGORY_STORE_FILES[category],
      this.dataRoot
    );
  }

  async readCategory(
    email: string,
    category: CategoryKey
  ): Promise<EntryEngineRecord[]> {
    const filePath = this.categoryFilePath(email, category);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, "[]", "utf8");
    }

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((value) => normalizeDataStoreEntry(value))
        .filter((value): value is EntryEngineRecord => !!value);
    } catch {
      return [];
    }
  }

  async writeCategory(
    email: string,
    category: CategoryKey,
    entries: EntryEngineRecord[]
  ) {
    const filePath = this.categoryFilePath(email, category);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const normalized = entries
      .map((value) => normalizeDataStoreEntry(value))
      .filter((value): value is EntryEngineRecord => !!value);

    await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
  }
}

export async function readCategoryEntries(
  email: string,
  category: CategoryKey
): Promise<EntryEngineRecord[]> {
  return new DataStore().readCategory(email, category);
}

export async function writeCategoryEntries(
  email: string,
  category: CategoryKey,
  entries: EntryEngineRecord[]
) {
  return new DataStore().writeCategory(email, category, entries);
}
