import fs from "node:fs/promises";
import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isFutureDatedEntry, normalizeStreakState } from "@/lib/gamification";

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

function safeEmailDir(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

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
    `${sanitizeSegment(normalizedEmail)}.json`
  );
  const userRoot = path.join(process.cwd(), ".data", "users", safeEmailDir(normalizedEmail));

  const [fdpAttended, fdpConducted, caseStudies, guestLectures, workshops] = await Promise.all([
    readSummaryFile(attendedPath),
    readSummaryFile(path.join(userRoot, "fdp-conducted.json")),
    readSummaryFile(path.join(userRoot, "case-studies.json")),
    readSummaryFile(path.join(userRoot, "guest-lectures.json")),
    readSummaryFile(path.join(userRoot, "workshops.json")),
  ]);

  return {
    fdpAttended,
    fdpConducted,
    caseStudies,
    guestLectures,
    workshops,
  };
}
