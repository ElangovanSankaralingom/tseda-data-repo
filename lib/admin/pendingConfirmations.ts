import "server-only";
import fs from "node:fs/promises";
import { getCategoryTitle } from "@/data/categoryRegistry";
import { CATEGORY_KEYS } from "@/lib/categories";
import { ensureUserIndex } from "@/lib/data/indexStore";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entries/lifecycle";
import type { CategoryKey } from "@/lib/entries/types";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail } from "@/lib/entryNavigation";
import type { Entry, EntryStatus } from "@/lib/types/entry";
import { getUsersRootDir } from "@/lib/userStore";

export type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: CategoryKey;
  entryId: string;
  title: string;
  editRequestedAtISO: string | null;
  editRequestMessage: string | null;
  createdAtISO: string | null;
  updatedAtISO: string | null;
  status: EntryStatus;
  entryHref: string;
};

function toEntryTitle(categoryKey: CategoryKey, entry: Entry) {
  return getCategoryTitle(entry as Record<string, unknown>, categoryKey);
}

function toSortTimestamp(row: PendingConfirmationRow) {
  const requestedAt = row.editRequestedAtISO ? Date.parse(row.editRequestedAtISO) : Number.NaN;
  if (!Number.isNaN(requestedAt)) return requestedAt;

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

export async function getPendingEditRequests(): Promise<PendingConfirmationRow[]> {
  const usersRoot = getUsersRootDir();
  const rows: PendingConfirmationRow[] = [];

  try {
    const userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue;
      const ownerEmail = normalizeEmail(userDir.name);
      if (!ownerEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) continue;

      for (const categoryKey of CATEGORY_KEYS) {
        const list = await listEntriesForCategory(ownerEmail, categoryKey);
        for (const entry of list) {
          const workflowStatus = getEntryWorkflowStatus(entry);
          if (workflowStatus !== "EDIT_REQUESTED") continue;

          const entryId = String(entry.id ?? "").trim();
          if (!entryId) continue;

          rows.push({
            ownerEmail,
            categoryKey,
            entryId,
            title: toEntryTitle(categoryKey, entry),
            editRequestedAtISO:
              asOptionalISO(entry.editRequestedAt) ??
              asOptionalISO(entry.updatedAt) ??
              asOptionalISO(entry.createdAt),
            editRequestMessage: asOptionalISO(entry.editRequestMessage),
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

/** @deprecated Use getPendingEditRequests instead */
export const getPendingConfirmations = getPendingEditRequests;

export async function getPendingEditRequestsCount() {
  const usersRoot = getUsersRootDir();
  let total = 0;

  try {
    const userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue;
      const ownerEmail = normalizeEmail(userDir.name);
      if (!ownerEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) continue;

      const ensured = await ensureUserIndex(ownerEmail);
      if (ensured.ok) {
        total += ensured.data.countsByStatus.EDIT_REQUESTED ?? 0;
        continue;
      }

      for (const categoryKey of CATEGORY_KEYS) {
        const list = await listEntriesForCategory(ownerEmail, categoryKey);
        for (const entry of list) {
          if (getEntryWorkflowStatus(entry) === "EDIT_REQUESTED") {
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

/** @deprecated Use getPendingEditRequestsCount instead */
export const getPendingConfirmationsCount = getPendingEditRequestsCount;
