import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  generateEntryPdfBytes,
  storeEntryPdf,
  type PdfMeta,
} from "@/lib/entry-pdf";
import {
  computeDueAtISO,
  isFutureDatedEntry,
  isWithinDueWindow,
  normalizeStreakState,
  nowISTTimestampISO,
} from "@/lib/gamification";

const STORE_ROOT = path.join(process.cwd(), "data", "fdp-attended");

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type EntryRecord = {
  id: string;
  status?: "draft" | "final";
  academicYear?: string;
  semesterType?: string;
  startDate?: string;
  endDate?: string;
  programName?: string;
  organisingBody?: string;
  supportAmount?: number | null;
  pdfMeta?: PdfMeta | null;
  pdfStale?: boolean;
  pdfSourceHash?: string | null;
  permissionLetter?: FileMeta | null;
  completionCertificate?: FileMeta | null;
  streak?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith("@tce.edu")) return null;
  return email;
}

async function readList(email: string): Promise<EntryRecord[]> {
  const filePath = path.join(STORE_ROOT, `${sanitizeSegment(email)}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EntryRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: EntryRecord[]) {
  await fs.mkdir(STORE_ROOT, { recursive: true });
  const filePath = path.join(STORE_ROOT, `${sanitizeSegment(email)}.json`);
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
}

function hasCompletedUploads(entry: EntryRecord) {
  return !!entry.permissionLetter?.storedPath && !!entry.completionCertificate?.storedPath;
}

function getPrePdfFieldsHash(entry: EntryRecord) {
  return JSON.stringify({
    academicYear: String(entry.academicYear ?? "").trim(),
    semesterType: String(entry.semesterType ?? "").trim(),
    startDate: String(entry.startDate ?? "").trim(),
    endDate: String(entry.endDate ?? "").trim(),
    programName: String(entry.programName ?? "").trim(),
    organisingBody: String(entry.organisingBody ?? "").trim(),
    supportAmount:
      typeof entry.supportAmount === "number" && Number.isFinite(entry.supportAmount) ? entry.supportAmount : null,
  });
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const entryId = String(id ?? "").trim();
  if (!entryId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const list = await readList(email);
  const index = list.findIndex((item) => String(item?.id ?? "").trim() === entryId);
  if (index === -1) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const entry = list[index];
  const academicYear = String(entry.academicYear ?? "").trim();
  const semesterType = String(entry.semesterType ?? "").trim();
  const startDate = String(entry.startDate ?? "").trim();
  const endDate = String(entry.endDate ?? "").trim();
  const programName = String(entry.programName ?? "").trim();
  const organisingBody = String(entry.organisingBody ?? "").trim();

  if (!academicYear || !semesterType || !startDate || !endDate || !programName || !organisingBody) {
    return NextResponse.json({ error: "Complete the required fields before generating the entry." }, { status: 400 });
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const inclusiveDays = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start
    ? null
    : Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  if (!inclusiveDays) {
    return NextResponse.json({ error: "Valid start and end dates are required." }, { status: 400 });
  }

  const bytes = await generateEntryPdfBytes({
    categoryName: "FDP - Attended",
    fields: [
      { label: "Academic Year", value: academicYear },
      { label: "Semester Type", value: semesterType },
      { label: "Start Date", value: startDate },
      { label: "End Date", value: endDate },
      { label: "Number of Days", value: String(inclusiveDays) },
      { label: "FDP Name", value: programName },
      { label: "Organising Body", value: organisingBody },
      { label: "Amount of Support", value: entry.supportAmount == null ? "-" : `INR ${entry.supportAmount}` },
    ],
  });

  const pdfMeta = await storeEntryPdf({
    email,
    categoryFolder: "fdp-attended",
    entryId,
    fileNameBase: programName || "fdp-attended-entry",
    bytes,
  });

  const eligible = isFutureDatedEntry(startDate, endDate);
  const normalizedStreak = normalizeStreakState(entry.streak);
  const dueAtISO = eligible ? normalizedStreak.dueAtISO ?? computeDueAtISO(endDate) : null;
  const updatedStreak = eligible
    ? {
        ...normalizedStreak,
        activatedAtISO: normalizedStreak.activatedAtISO ?? nowISTTimestampISO(),
        dueAtISO,
        completedAtISO:
          hasCompletedUploads(entry) && dueAtISO && isWithinDueWindow(dueAtISO)
            ? normalizedStreak.completedAtISO ?? nowISTTimestampISO()
            : normalizedStreak.completedAtISO ?? null,
      }
    : normalizeStreakState(null);

  const updatedEntry: EntryRecord = {
    ...entry,
    status: "final",
    pdfMeta,
    pdfSourceHash: getPrePdfFieldsHash(entry),
    pdfStale: false,
    streak: updatedStreak,
    updatedAt: new Date().toISOString(),
  };

  list[index] = updatedEntry;
  await writeList(email, list);

  return NextResponse.json({ pdfMeta, entry: updatedEntry }, { status: 200 });
}
