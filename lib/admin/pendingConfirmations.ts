import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entryEngine";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail } from "@/lib/navigation";

export type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: CategoryKey;
  entryId: string;
  title: string;
  sentForConfirmationAtISO: string | null;
  createdAtISO: string | null;
  updatedAtISO: string | null;
  status: string;
  entryHref: string;
};

function toEntryTitle(categoryKey: CategoryKey, entry: Record<string, unknown>) {
  if (categoryKey === "fdp-attended") return String(entry.programName ?? "").trim() || "FDP Entry";
  if (categoryKey === "fdp-conducted") return String(entry.eventName ?? "").trim() || "FDP Entry";
  if (categoryKey === "case-studies") return String(entry.placeOfVisit ?? "").trim() || "Case Study";
  if (categoryKey === "guest-lectures") return String(entry.eventName ?? "").trim() || "Guest Lecture";
  return String(entry.eventName ?? "").trim() || "Workshop";
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
  const usersRoot = path.join(process.cwd(), ".data", "users");
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
          if (getEntryWorkflowStatus(entry) !== "PENDING_CONFIRMATION") continue;

          const entryId = String(entry.id ?? "").trim();
          if (!entryId) continue;

          rows.push({
            ownerEmail,
            categoryKey,
            entryId,
            title: toEntryTitle(categoryKey, entry),
            sentForConfirmationAtISO:
              asOptionalISO(entry.sentForConfirmationAtISO) ??
              asOptionalISO(entry.requestEditRequestedAtISO),
            createdAtISO: asOptionalISO(entry.createdAt),
            updatedAtISO: asOptionalISO(entry.updatedAt),
            status: String(entry.status ?? "draft"),
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
  const rows = await getPendingConfirmations();
  return rows.length;
}
