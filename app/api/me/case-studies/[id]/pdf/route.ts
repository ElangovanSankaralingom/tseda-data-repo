import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  listEntriesForCategory,
  updateEntry,
} from "@/lib/entryEngine";
import {
  generateEntryPdfBytes,
  storeEntryPdf,
  type PdfMeta,
} from "@/lib/entry-pdf";
import { ensureActivated, isFutureDatedEntry, normalizeStreakState } from "@/lib/gamification";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";

type FileMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
};

type StaffSelection = {
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
  coordinator?: StaffSelection;
  placeOfVisit?: string;
  purposeOfVisit?: string;
  staffAccompanying?: StaffSelection[];
  studentYear?: string;
  semesterNumber?: number | null;
  participants?: number | null;
  amountSupport?: number | null;
  pdfMeta?: PdfMeta | null;
  pdfSourceHash?: string | null;
  pdfStale?: boolean;
  permissionLetter?: FileMeta | null;
  travelPlan?: FileMeta | null;
  geotaggedPhotos?: FileMeta[];
  streak?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith("@tce.edu")) return null;
  return email;
}

async function readList(email: string): Promise<EntryRecord[]> {
  return listEntriesForCategory(email, "case-studies");
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
  const placeOfVisit = String(entry.placeOfVisit ?? "").trim();
  const purposeOfVisit = String(entry.purposeOfVisit ?? "").trim();

  if (!academicYear || !semesterType || !startDate || !endDate || !placeOfVisit || !purposeOfVisit) {
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
    categoryName: "Case Studies",
    fields: [
      { label: "Academic Year", value: academicYear },
      { label: "Semester Type", value: semesterType },
      { label: "Start Date", value: startDate },
      { label: "End Date", value: endDate },
      { label: "Number of Days", value: String(inclusiveDays) },
      { label: "Place of Visit", value: placeOfVisit },
      { label: "Purpose of Visit", value: purposeOfVisit },
      {
        label: "Coordinator",
        value: entry.coordinator?.name || entry.coordinator?.email || "-",
      },
      {
        label: "Staff Accompanying",
        value:
          Array.isArray(entry.staffAccompanying) && entry.staffAccompanying.length > 0
            ? entry.staffAccompanying.map((item) => item.name || item.email || "-").join(", ")
            : "-",
      },
      { label: "Student Year", value: String(entry.studentYear ?? "-") },
      { label: "Semester Number", value: entry.semesterNumber == null ? "-" : String(entry.semesterNumber) },
      { label: "Number of Participants", value: entry.participants == null ? "-" : String(entry.participants) },
    ],
  });

  const pdfMeta = await storeEntryPdf({
    email,
    categoryFolder: "case-studies",
    entryId,
    fileNameBase: placeOfVisit || "case-study-entry",
    bytes,
  });

  const updatedEntry: EntryRecord = {
    ...entry,
    status: entry.status === "final" ? "final" : "draft",
    pdfMeta,
    pdfSourceHash: hashPrePdfFields(entry as Record<string, unknown>, "case-studies"),
    pdfStale: false,
    streak: isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "")
      ? ensureActivated(normalizeStreakState(entry.streak), entry.endDate)
      : normalizeStreakState(entry.streak),
    updatedAt: new Date().toISOString(),
  };

  const persisted = await updateEntry<EntryRecord>(
    email,
    "case-studies",
    entryId,
    updatedEntry
  );

  return NextResponse.json({ pdfMeta, entry: persisted }, { status: 200 });
}
