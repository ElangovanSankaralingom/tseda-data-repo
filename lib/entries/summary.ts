import fs from "node:fs/promises";
import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isFutureDatedEntry, normalizeStreakState } from "@/lib/gamification";
import { getUserCategoryStoreFile, safeEmailDir } from "@/lib/userStore";

export type CategorySummary = {
  active: number;
  pending: number;
};

export type DataEntrySummary = {
  fdpAttended: CategorySummary;
  fdpConducted: CategorySummary;
  caseStudies: CategorySummary;
  guestLectures: CategorySummary;
  workshops: CategorySummary;
};

export function getUnfinishedCount(summary: DataEntrySummary) {
  return Object.values(summary).reduce((total, category) => total + category.active + category.pending, 0);
}

export function countUnfinished(summary: CategorySummary) {
  return summary.active + summary.pending;
}

export function getUnfinishedCountByCategory(summary: DataEntrySummary) {
  return {
    fdpAttended: countUnfinished(summary.fdpAttended),
    fdpConducted: countUnfinished(summary.fdpConducted),
    caseStudies: countUnfinished(summary.caseStudies),
    guestLectures: countUnfinished(summary.guestLectures),
    workshops: countUnfinished(summary.workshops),
  } satisfies Record<keyof DataEntrySummary, number>;
}

type SummaryEntry = {
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  streak?: unknown;
};

const EMPTY_SUMMARY: CategorySummary = { active: 0, pending: 0 };

function isCompletedEntry(entry: SummaryEntry) {
  const streak = normalizeStreakState(entry.streak);
  return entry.status === "final" || !!streak.completedAtISO;
}

function isActiveEntry(entry: SummaryEntry) {
  const streak = normalizeStreakState(entry.streak);
  return (
    isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "") &&
    !!streak.activatedAtISO &&
    !isCompletedEntry(entry)
  );
}

function summarizeEntries(entries: SummaryEntry[]): CategorySummary {
  return entries.reduce<CategorySummary>(
    (summary, entry) => {
      if (isActiveEntry(entry)) {
        summary.active += 1;
        return summary;
      }

      if (!isCompletedEntry(entry)) {
        summary.pending += 1;
      }

      return summary;
    },
    { active: 0, pending: 0 }
  );
}

async function readSummaryFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? summarizeEntries(parsed as SummaryEntry[]) : EMPTY_SUMMARY;
  } catch {
    return EMPTY_SUMMARY;
  }
}

export async function getDataEntrySummary(email: string): Promise<DataEntrySummary> {
  const normalizedEmail = normalizeEmail(email);

  const attendedPath = path.join(
    process.cwd(),
    "data",
    "fdp-attended",
    `${safeEmailDir(normalizedEmail)}.json`
  );

  const [fdpAttended, fdpConducted, caseStudies, guestLectures, workshops] = await Promise.all([
    readSummaryFile(attendedPath),
    readSummaryFile(getUserCategoryStoreFile(normalizedEmail, "fdp-conducted.json")),
    readSummaryFile(getUserCategoryStoreFile(normalizedEmail, "case-studies.json")),
    readSummaryFile(getUserCategoryStoreFile(normalizedEmail, "guest-lectures.json")),
    readSummaryFile(getUserCategoryStoreFile(normalizedEmail, "workshops.json")),
  ]);

  return {
    fdpAttended,
    fdpConducted,
    caseStudies,
    guestLectures,
    workshops,
  };
}
