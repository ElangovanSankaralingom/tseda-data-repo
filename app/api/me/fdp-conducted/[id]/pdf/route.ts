import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  listEntriesForCategory,
  updateEntry,
} from "@/lib/entryEngine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  generateEntryPdfBytes,
  storeEntryPdf,
  type PdfMeta,
} from "@/lib/entry-pdf";
import { ensureActivated, isFutureDatedEntry, normalizeStreakState } from "@/lib/gamification";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type FacultySelection = {
  name?: string;
  email?: string;
};

type EntryRecord = {
  id: string;
  status?: "draft" | "final";
  academicYear?: string;
  semesterType?: string;
  startDate?: string;
  endDate?: string;
  eventName?: string;
  coordinatorName?: string;
  coordinatorEmail?: string;
  coCoordinators?: FacultySelection[];
  pdfMeta?: PdfMeta | null;
  pdfStale?: boolean;
  pdfSourceHash?: string | null;
  permissionLetter?: FileMeta | null;
  geotaggedPhotos?: FileMeta[];
  streak?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email.endsWith("@tce.edu")) return null;
  return email;
}

async function readList(email: string): Promise<EntryRecord[]> {
  return listEntriesForCategory(email, "fdp-conducted");
}

function getPrePdfFieldsHash(entry: EntryRecord) {
  return JSON.stringify({
    academicYear: String(entry.academicYear ?? "").trim(),
    semesterType: String(entry.semesterType ?? "").trim(),
    startDate: String(entry.startDate ?? "").trim(),
    endDate: String(entry.endDate ?? "").trim(),
    eventName: String(entry.eventName ?? "").trim(),
    coCoordinators: Array.isArray(entry.coCoordinators)
      ? entry.coCoordinators.map((item) => ({
          id: String((item as { id?: unknown })?.id ?? ""),
          email: String(item?.email ?? "").trim().toLowerCase(),
        }))
      : [],
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
  const eventName = String(entry.eventName ?? "").trim();
  const coordinatorName = String(entry.coordinatorName ?? "").trim();

  if (!academicYear || !semesterType || !startDate || !endDate || !eventName || !coordinatorName) {
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
    categoryName: "FDP - Conducted",
    fields: [
      { label: "Academic Year", value: academicYear },
      { label: "Semester Type", value: semesterType },
      { label: "Start Date", value: startDate },
      { label: "End Date", value: endDate },
      { label: "Number of Days", value: String(inclusiveDays) },
      { label: "Event Name", value: eventName },
      { label: "Coordinator", value: coordinatorName },
      {
        label: "Co-Coordinators",
        value:
          Array.isArray(entry.coCoordinators) && entry.coCoordinators.length > 0
            ? entry.coCoordinators.map((item) => item.name || item.email || "-").join(", ")
            : "-",
      },
    ],
  });

  const pdfMeta = await storeEntryPdf({
    email,
    categoryFolder: "fdp-conducted",
    entryId,
    fileNameBase: eventName || "fdp-conducted-entry",
    bytes,
  });

  const updatedEntry: EntryRecord = {
    ...entry,
    status: entry.status === "final" ? "final" : "draft",
    pdfMeta,
    pdfSourceHash: getPrePdfFieldsHash(entry),
    pdfStale: false,
    streak: isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "")
      ? ensureActivated(normalizeStreakState(entry.streak), entry.endDate)
      : normalizeStreakState(entry.streak),
    updatedAt: new Date().toISOString(),
  };

  const persisted = await updateEntry<EntryRecord>(
    email,
    "fdp-conducted",
    entryId,
    updatedEntry
  );

  return NextResponse.json({ pdfMeta, entry: persisted }, { status: 200 });
}
