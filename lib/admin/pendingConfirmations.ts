import "server-only";
import fs from "node:fs/promises";
import { getCategoryTitle } from "@/data/categoryRegistry";
import { CATEGORY_KEYS } from "@/lib/categories";
import { ensureUserIndex } from "@/lib/data/indexStore";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entries/lifecycle";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail } from "@/lib/navigation";
import type { Entry, EntryStatus } from "@/lib/types/entry";
import { getUsersRootDir } from "@/lib/userStore";

export type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: CategoryKey;
  entryId: string;
  title: string;
  sentForConfirmationAtISO: string | null;
  createdAtISO: string | null;
  updatedAtISO: string | null;
  status: EntryStatus;
  entryHref: string;
};

function toEntryTitle(categoryKey: CategoryKey, entry: Entry) {
  return getCategoryTitle(entry as Record<string, unknown>, categoryKey);
}

function toSortTimestamp(row: PendingConfirmationRow) {
  const sentAt = row.sentForConfirmationAtISO ? Date.parse(row.sentForConfirmationAtISO) : Number.NaN;
  if (!Number.isNaN(sentAt)) return sentAt;

  const updatedAt = row.updatedAtISO ? Date.parse(row.updatedAtISO) : Number.NaN;
  if (!Number.isNaN(updatedAt)) return updatedAt;

  const createdAt = row.createdAtISO ? Date.parse(row.createdAtISO) : Number.NaN;
  if (!Number.isNaN(createdAt)) return createdAt;

  return 0;
}

function asOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function getPendingConfirmations(): Promise<PendingConfirmationRow[]> {
  const usersRoot = getUsersRootDir();
  const rows: PendingConfirmationRow[] = [];

  try {
    const userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue;
      const ownerEmail = normalizeEmail(userDir.name);
      if (!ownerEmail.endsWith("@tce.edu")) continue;

      for (const categoryKey of CATEGORY_KEYS) {
        const list = await listEntriesForCategory(ownerEmail, categoryKey);
        for (const entry of list) {
          const workflowStatus = getEntryWorkflowStatus(entry);
          if (workflowStatus !== "PENDING_CONFIRMATION") continue;

          const entryId = String(entry.id ?? "").trim();
          if (!entryId) continue;

          rows.push({
            ownerEmail,
            categoryKey,
            entryId,
            title: toEntryTitle(categoryKey, entry),
            sentForConfirmationAtISO:
              asOptionalISO(entry.sentForConfirmationAtISO) ??
              asOptionalISO(entry.updatedAt) ??
              asOptionalISO(entry.createdAt),
            createdAtISO: asOptionalISO(entry.createdAt),
            updatedAtISO: asOptionalISO(entry.updatedAt),
            status: workflowStatus,
            entryHref: entryDetail(categoryKey, entryId),
          });
        }
      }
    }
  } catch {
    return [];
  }

  return rows.sort((left, right) => toSortTimestamp(right) - toSortTimestamp(left));
}

export async function getPendingConfirmationsCount() {
  const usersRoot = getUsersRootDir();
  let total = 0;

  try {
    const userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue;
      const ownerEmail = normalizeEmail(userDir.name);
      if (!ownerEmail.endsWith("@tce.edu")) continue;

      const ensured = await ensureUserIndex(ownerEmail);
      if (ensured.ok) {
        total += ensured.data.countsByStatus.PENDING_CONFIRMATION ?? 0;
        continue;
      }

      // Rare fallback path when index read/rebuild fails.
      for (const categoryKey of CATEGORY_KEYS) {
        const list = await listEntriesForCategory(ownerEmail, categoryKey);
        for (const entry of list) {
          if (getEntryWorkflowStatus(entry) === "PENDING_CONFIRMATION") {
            total += 1;
          }
        }
      }
    }
  } catch {
    return 0;
  }

  return total;
}
