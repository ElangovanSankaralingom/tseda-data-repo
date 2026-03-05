type PdfMetaLike = {
  url?: string | null;
  storedPath?: string | null;
} | null | undefined;

type FacultyRowLike = {
  id?: string | null;
  email?: string | null;
};

type PdfSnapshotCategory =
  | "fdp-attended"
  | "fdp-conducted"
  | "case-studies"
  | "guest-lectures"
  | "workshops";

type PdfStateInput = {
  pdfMeta: PdfMetaLike;
  pdfSourceHash?: string | null;
  draftHash: string;
  fieldsGateOk: boolean;
  isLocked?: boolean;
};

type PdfStateOutput = {
  pdfStale: boolean;
  canGenerate: boolean;
  canPreviewDownload: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function normalizeFacultyRows(rows: unknown) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const item = (row ?? {}) as FacultyRowLike;
    return {
      id: normalizeText(item.id),
      email: normalizeEmail(item.email),
    };
  });
}

function getHashPayload(entry: Record<string, unknown>, category: PdfSnapshotCategory) {
  switch (category) {
    case "fdp-attended":
      return {
        academicYear: normalizeText(entry.academicYear),
        semesterType: normalizeText(entry.semesterType),
        startDate: normalizeText(entry.startDate),
        endDate: normalizeText(entry.endDate),
        programName: normalizeText(entry.programName),
        organisingBody: normalizeText(entry.organisingBody),
        supportAmount: normalizeNullableNumber(entry.supportAmount),
      };

    case "fdp-conducted":
      return {
        academicYear: normalizeText(entry.academicYear),
        semesterType: normalizeText(entry.semesterType),
        startDate: normalizeText(entry.startDate),
        endDate: normalizeText(entry.endDate),
        eventName: normalizeText(entry.eventName),
        coCoordinators: normalizeFacultyRows(entry.coCoordinators),
      };

    case "case-studies":
      return {
        academicYear: normalizeText(entry.academicYear),
        semesterType: normalizeText(entry.semesterType),
        startDate: normalizeText(entry.startDate),
        endDate: normalizeText(entry.endDate),
        placeOfVisit: normalizeText(entry.placeOfVisit),
        purposeOfVisit: normalizeText(entry.purposeOfVisit),
        staffAccompanying: normalizeFacultyRows(entry.staffAccompanying),
      };

    case "guest-lectures":
      return {
        academicYear: normalizeText(entry.academicYear),
        semesterType: normalizeText(entry.semesterType),
        startDate: normalizeText(entry.startDate),
        endDate: normalizeText(entry.endDate),
        eventName: normalizeText(entry.eventName),
        speakerName: normalizeText(entry.speakerName),
        organizationName: normalizeText(entry.organizationName),
        studentYear: normalizeText(entry.studentYear),
        semesterNumber: normalizeText(entry.semesterNumber),
      };

    case "workshops":
      return {
        academicYear: normalizeText(entry.academicYear),
        semesterType: normalizeText(entry.semesterType),
        startDate: normalizeText(entry.startDate),
        endDate: normalizeText(entry.endDate),
        eventName: normalizeText(entry.eventName),
        speakerName: normalizeText(entry.speakerName),
        organizationName: normalizeText(entry.organizationName),
        coCoordinators: normalizeFacultyRows(entry.coCoordinators),
      };
  }
}

export function hashPrePdfFields(entry: unknown, category: PdfSnapshotCategory) {
  const record = ((entry ?? {}) as Record<string, unknown>) || {};
  return stableStringify(getHashPayload(record, category));
}

export function computePdfState({
  pdfMeta,
  pdfSourceHash,
  draftHash,
  fieldsGateOk,
}: PdfStateInput): PdfStateOutput {
  const hasPdf = !!pdfMeta?.url && !!pdfMeta?.storedPath;
  const pdfStale = hasPdf && !!pdfSourceHash && draftHash !== pdfSourceHash;

  return {
    pdfStale,
    canGenerate: fieldsGateOk && (!hasPdf || pdfStale),
    canPreviewDownload: hasPdf && !pdfStale,
  };
}

export function hydratePdfSnapshot<T extends { pdfMeta?: PdfMetaLike; pdfSourceHash?: string | null; pdfStale?: boolean }>(
  entry: T,
  category: PdfSnapshotCategory
) {
  const currentHash = hashPrePdfFields(entry, category);

  if (!entry.pdfMeta?.url || !entry.pdfMeta?.storedPath) {
    return {
      ...entry,
      pdfStale: false,
    };
  }

  return {
    ...entry,
    pdfSourceHash: entry.pdfSourceHash || currentHash,
    pdfStale: false,
  };
}

export type { PdfSnapshotCategory, PdfStateOutput };
