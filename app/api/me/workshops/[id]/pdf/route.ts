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
import { normalizeStreakState } from "@/lib/gamification";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";

const STORE_ROOT = path.join(process.cwd(), ".data", "users");

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

type Uploads = {
  permissionLetter?: FileMeta | null;
  brochure?: FileMeta | null;
  attendance?: FileMeta | null;
  organiserProfile?: FileMeta | null;
  geotaggedPhotos?: FileMeta[];
};

type EntryRecord = {
  id: string;
  status?: "draft" | "final";
  academicYear?: string;
  semesterType?: string;
  startDate?: string;
  endDate?: string;
  eventName?: string;
  speakerName?: string;
  organisationName?: string;
  coordinator?: FacultySelection;
  coCoordinators?: FacultySelection[];
  participants?: number | null;
  pdfMeta?: PdfMeta | null;
  pdfSourceHash?: string | null;
  pdfStale?: boolean;
  uploads?: Uploads;
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

function getStoreFile(email: string) {
  return path.join(STORE_ROOT, sanitizeSegment(email), "workshops.json");
}

async function readList(email: string): Promise<EntryRecord[]> {
  const filePath = getStoreFile(email);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EntryRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: EntryRecord[]) {
  const filePath = getStoreFile(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
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
  const speakerName = String(entry.speakerName ?? "").trim();
  const organisationName = String(entry.organisationName ?? "").trim();

  if (!academicYear || !semesterType || !startDate || !endDate || !eventName || !speakerName || !organisationName) {
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
    categoryName: "Workshops",
    fields: [
      { label: "Academic Year", value: academicYear },
      { label: "Semester Type", value: semesterType },
      { label: "Start Date", value: startDate },
      { label: "End Date", value: endDate },
      { label: "Number of Days", value: String(inclusiveDays) },
      { label: "Event Name", value: eventName },
      { label: "Speaker Name", value: speakerName },
      { label: "Organization Name", value: organisationName },
      { label: "Coordinator", value: entry.coordinator?.name || entry.coordinator?.email || "-" },
      {
        label: "Co-Coordinators",
        value:
          Array.isArray(entry.coCoordinators) && entry.coCoordinators.length > 0
            ? entry.coCoordinators.map((item) => item.name || item.email || "-").join(", ")
            : "-",
      },
      { label: "Number of Participants", value: entry.participants == null ? "-" : String(entry.participants) },
    ],
  });

  const pdfMeta = await storeEntryPdf({
    email,
    categoryFolder: "workshops",
    entryId,
    fileNameBase: eventName || "workshop-entry",
    bytes,
  });

  const updatedEntry: EntryRecord = {
    ...entry,
    status: entry.status === "final" ? "final" : "draft",
    pdfMeta,
    pdfSourceHash: hashPrePdfFields(entry as Record<string, unknown>, "workshops"),
    pdfStale: false,
    streak: normalizeStreakState(entry.streak),
    updatedAt: new Date().toISOString(),
  };

  list[index] = updatedEntry;
  await writeList(email, list);

  return NextResponse.json({ pdfMeta, entry: updatedEntry }, { status: 200 });
}
