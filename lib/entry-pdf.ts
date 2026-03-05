import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { safeEmailDir } from "@/lib/userStore";

export type PdfMeta = {
  storedPath: string;
  url: string;
  fileName: string;
  generatedAtISO: string;
};

type PdfField = {
  label: string;
  value: string;
};

const PAGE_MARGIN = 48;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LINE_HEIGHT = 16;

function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function isValidPdfMeta(meta: PdfMeta | null | undefined): meta is PdfMeta {
  return !!(
    meta &&
    typeof meta.storedPath === "string" &&
    meta.storedPath &&
    typeof meta.url === "string" &&
    meta.url &&
    typeof meta.fileName === "string" &&
    meta.fileName &&
    typeof meta.generatedAtISO === "string" &&
    meta.generatedAtISO
  );
}

function wrapText(text: string, maxChars: number) {
  if (text.length <= maxChars) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
    }
  }

  if (current) lines.push(current);
  return lines;
}

function drawFieldRows(
  page: import("pdf-lib").PDFPage,
  font: import("pdf-lib").PDFFont,
  boldFont: import("pdf-lib").PDFFont,
  fields: PdfField[],
  startY: number
) {
  let y = startY;
  const labelX = PAGE_MARGIN;
  const valueX = 210;
  const maxValueChars = 52;

  for (const field of fields) {
    const lines = wrapText(field.value || "-", maxValueChars);
    const rowHeight = Math.max(LINE_HEIGHT, lines.length * LINE_HEIGHT);

    if (y - rowHeight < 130) {
      break;
    }

    page.drawRectangle({
      x: PAGE_MARGIN - 6,
      y: y - rowHeight - 6,
      width: PAGE_WIDTH - PAGE_MARGIN * 2 + 12,
      height: rowHeight + 10,
      borderWidth: 0.5,
      borderColor: rgb(0.85, 0.87, 0.9),
      color: rgb(1, 1, 1),
    });

    page.drawText(field.label, {
      x: labelX,
      y: y - 11,
      font: boldFont,
      size: 10,
      color: rgb(0.12, 0.16, 0.22),
    });

    lines.forEach((line, index) => {
      page.drawText(line, {
        x: valueX,
        y: y - 11 - index * LINE_HEIGHT,
        font,
        size: 10,
        color: rgb(0.18, 0.2, 0.24),
      });
    });

    y -= rowHeight + 10;
  }
}

export async function generateEntryPdfBytes(args: {
  categoryName: string;
  fields: PdfField[];
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const tceLogoBytes = await fs.readFile(path.join(process.cwd(), "public", "tce-logo.png"));
  const tsedaLogoBytes = await fs.readFile(path.join(process.cwd(), "public", "tseda-logo.png"));
  const tceLogo = await pdfDoc.embedPng(tceLogoBytes);
  const tsedaLogo = await pdfDoc.embedPng(tsedaLogoBytes);

  const tceDims = tceLogo.scale(0.16);
  const tsedaDims = tsedaLogo.scale(0.18);

  page.drawImage(tceLogo, {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 78,
    width: tceDims.width,
    height: tceDims.height,
  });
  page.drawImage(tsedaLogo, {
    x: PAGE_WIDTH - PAGE_MARGIN - tsedaDims.width,
    y: PAGE_HEIGHT - 76,
    width: tsedaDims.width,
    height: tsedaDims.height,
  });

  const title = `T'SEDA Data Repository - ${args.categoryName}`;
  const titleWidth = boldFont.widthOfTextAtSize(title, 16);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT - 112,
    font: boldFont,
    size: 16,
    color: rgb(0.08, 0.11, 0.16),
  });

  page.drawLine({
    start: { x: PAGE_MARGIN, y: PAGE_HEIGHT - 125 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: PAGE_HEIGHT - 125 },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.9),
  });

  drawFieldRows(page, font, boldFont, args.fields, PAGE_HEIGHT - 152);

  const footerLines = [
    "Dr. Jinu Louishidha Kitchley,",
    "Professor and Head T'SEDA,",
    "Thiagarajar School of Environmental Design and Architecture,",
    "Thiagarajar College of Engineering, Madurai.",
  ];
  let footerY = 112;

  page.drawLine({
    start: { x: PAGE_WIDTH - 220, y: footerY + 56 },
    end: { x: PAGE_WIDTH - 40, y: footerY + 56 },
    thickness: 0.75,
    color: rgb(0.8, 0.82, 0.85),
  });

  footerLines.forEach((line) => {
    page.drawText(line, {
      x: PAGE_WIDTH - 220,
      y: footerY,
      font,
      size: 9,
      color: rgb(0.18, 0.2, 0.24),
    });
    footerY -= 12;
  });

  return Buffer.from(await pdfDoc.save());
}

export async function storeEntryPdf(args: {
  email: string;
  categoryFolder: string;
  entryId: string;
  fileNameBase: string;
  bytes: Uint8Array | Buffer;
}) {
  const generatedAtISO = new Date().toISOString();
  const storedPath = path.posix.join(
    "uploads",
    safeEmailDir(args.email),
    args.categoryFolder,
    sanitizeSegment(args.entryId),
    "pdf",
    `${Date.now()}-${sanitizeFileName(args.fileNameBase)}.pdf`
  );
  const absolutePath = path.join(process.cwd(), "public", storedPath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, args.bytes);

  return {
    storedPath,
    url: `/${storedPath}`,
    fileName: path.basename(storedPath),
    generatedAtISO,
  } satisfies PdfMeta;
}
