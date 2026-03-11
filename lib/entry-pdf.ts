import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
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

// ---------------------------------------------------------------------------
// Helpers (sanitisation, validation)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const MARGIN_LEFT = 56;
const MARGIN_RIGHT = 56;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 80;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_HEIGHT = 100;
const LINE_HEIGHT = 14;
const FIELD_PADDING = 8;

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLOR_TITLE = rgb(0.08, 0.11, 0.16);
const COLOR_SUBTITLE = rgb(0.3, 0.35, 0.4);
const COLOR_LABEL = rgb(0.2, 0.25, 0.3);
const COLOR_VALUE = rgb(0.05, 0.07, 0.1);
const COLOR_BORDER = rgb(0.82, 0.85, 0.88);
const COLOR_ROW_ALT = rgb(0.97, 0.975, 0.98);
const COLOR_ACCENT = rgb(0.12, 0.23, 0.37); // #1E3A5F
const COLOR_FOOTER = rgb(0.3, 0.35, 0.4);
const COLOR_WATERMARK = rgb(0.92, 0.93, 0.95);

// ---------------------------------------------------------------------------
// Text wrapping (pixel-width based — fixes overflow bug)
// ---------------------------------------------------------------------------

function wrapTextByWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text || !text.trim()) return ["-"];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      // Single word exceeds max width — break with hyphens
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let remaining = word;
        while (remaining.length > 0) {
          let end = remaining.length;
          while (end > 1 && font.widthOfTextAtSize(remaining.slice(0, end), fontSize) > maxWidth) {
            end--;
          }
          lines.push(remaining.slice(0, end) + (end < remaining.length ? "-" : ""));
          remaining = remaining.slice(end);
        }
        currentLine = "";
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : ["-"];
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

async function drawHeader(
  page: PDFPage,
  pdfDoc: PDFDocument,
  boldFont: PDFFont,
  font: PDFFont,
  args: { categoryName: string; facultyName?: string; generatedDate?: string },
): Promise<number> {
  // Logos
  try {
    const tceLogoBytes = await fs.readFile(path.join(process.cwd(), "public", "tce-logo.png"));
    const tsedaLogoBytes = await fs.readFile(path.join(process.cwd(), "public", "tseda-logo.png"));
    const tceLogo = await pdfDoc.embedPng(tceLogoBytes);
    const tsedaLogo = await pdfDoc.embedPng(tsedaLogoBytes);

    const logoHeight = 48;
    const tceAspect = tceLogo.width / tceLogo.height;
    const tsedaAspect = tsedaLogo.width / tsedaLogo.height;

    page.drawImage(tceLogo, {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - MARGIN_TOP - logoHeight,
      width: logoHeight * tceAspect,
      height: logoHeight,
    });

    page.drawImage(tsedaLogo, {
      x: PAGE_WIDTH - MARGIN_RIGHT - logoHeight * tsedaAspect,
      y: PAGE_HEIGHT - MARGIN_TOP - logoHeight,
      width: logoHeight * tsedaAspect,
      height: logoHeight,
    });
  } catch {
    // Logos not found — continue without them
  }

  // Institution name
  const instName = "Thiagarajar College of Engineering, Madurai";
  const instWidth = font.widthOfTextAtSize(instName, 9);
  page.drawText(instName, {
    x: (PAGE_WIDTH - instWidth) / 2,
    y: PAGE_HEIGHT - MARGIN_TOP - 14,
    font,
    size: 9,
    color: COLOR_SUBTITLE,
  });

  // Department name
  const deptName = "T\u2019SEDA \u2014 School of Environmental Design and Architecture";
  const deptWidth = font.widthOfTextAtSize(deptName, 9);
  page.drawText(deptName, {
    x: (PAGE_WIDTH - deptWidth) / 2,
    y: PAGE_HEIGHT - MARGIN_TOP - 28,
    font,
    size: 9,
    color: COLOR_SUBTITLE,
  });

  // Accent line
  const accentY = PAGE_HEIGHT - MARGIN_TOP - 56;
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: accentY,
    width: CONTENT_WIDTH,
    height: 2,
    color: COLOR_ACCENT,
  });

  // Category title
  const title = args.categoryName;
  const titleSize = 15;
  const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: accentY - 22,
    font: boldFont,
    size: titleSize,
    color: COLOR_TITLE,
  });

  // Faculty name + date subtitle
  const subtitleParts: string[] = [];
  if (args.facultyName) subtitleParts.push(args.facultyName);
  if (args.generatedDate) subtitleParts.push(`Generated: ${args.generatedDate}`);
  if (subtitleParts.length > 0) {
    const subtitle = subtitleParts.join("  |  ");
    const subWidth = font.widthOfTextAtSize(subtitle, 9);
    page.drawText(subtitle, {
      x: (PAGE_WIDTH - subWidth) / 2,
      y: accentY - 36,
      font,
      size: 9,
      color: COLOR_SUBTITLE,
    });
  }

  // Return Y position where content starts
  return accentY - 52;
}

// ---------------------------------------------------------------------------
// Footer (last page only)
// ---------------------------------------------------------------------------

function drawFooter(page: PDFPage, font: PDFFont, boldFont: PDFFont) {
  const footerTop = MARGIN_BOTTOM + FOOTER_HEIGHT - 20;

  // Signature line
  page.drawLine({
    start: { x: PAGE_WIDTH - MARGIN_RIGHT - 200, y: footerTop + 10 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: footerTop + 10 },
    thickness: 0.75,
    color: COLOR_BORDER,
  });

  const sigLines = [
    { text: "Dr. Jinu Louishidha Kitchley", bold: true },
    { text: "Professor and Head, T\u2019SEDA", bold: false },
    { text: "Thiagarajar College of Engineering", bold: false },
    { text: "Madurai \u2014 625 015", bold: false },
  ];

  let sigY = footerTop;
  for (const line of sigLines) {
    page.drawText(line.text, {
      x: PAGE_WIDTH - MARGIN_RIGHT - 200,
      y: sigY,
      font: line.bold ? boldFont : font,
      size: 8.5,
      color: COLOR_FOOTER,
    });
    sigY -= 12;
  }

  // Bottom line
  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM - 10 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM - 10 },
    thickness: 0.5,
    color: COLOR_BORDER,
  });

  // Confidential marker
  const idText = "T\u2019SEDA Data Repository \u2014 Confidential";
  const idWidth = font.widthOfTextAtSize(idText, 7);
  page.drawText(idText, {
    x: (PAGE_WIDTH - idWidth) / 2,
    y: MARGIN_BOTTOM - 22,
    font,
    size: 7,
    color: COLOR_WATERMARK,
  });
}

// ---------------------------------------------------------------------------
// Page number
// ---------------------------------------------------------------------------

function drawPageNumber(page: PDFPage, font: PDFFont, pageNum: number) {
  const text = `Page ${pageNum}`;
  const width = font.widthOfTextAtSize(text, 8);
  page.drawText(text, {
    x: (PAGE_WIDTH - width) / 2,
    y: MARGIN_BOTTOM - 8,
    font,
    size: 8,
    color: COLOR_SUBTITLE,
  });
}

// ---------------------------------------------------------------------------
// Table header row
// ---------------------------------------------------------------------------

function drawTableHeader(page: PDFPage, boldFont: PDFFont, y: number, labelColWidth: number) {
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - 20,
    width: CONTENT_WIDTH,
    height: 20,
    color: COLOR_ACCENT,
  });

  page.drawText("Field", {
    x: MARGIN_LEFT + 8,
    y: y - 14,
    font: boldFont,
    size: 9,
    color: rgb(1, 1, 1),
  });

  page.drawText("Details", {
    x: MARGIN_LEFT + labelColWidth + 8,
    y: y - 14,
    font: boldFont,
    size: 9,
    color: rgb(1, 1, 1),
  });
}

// ---------------------------------------------------------------------------
// Field table (multi-page)
// ---------------------------------------------------------------------------

function drawFieldTable(
  pages: PDFPage[],
  pdfDoc: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  fields: PdfField[],
  startY: number,
): void {
  let y = startY;
  let currentPage = pages[pages.length - 1];
  const labelColWidth = 160;
  const valueColWidth = CONTENT_WIDTH - labelColWidth;
  const minY = MARGIN_BOTTOM + FOOTER_HEIGHT + 20;

  // Table header
  drawTableHeader(currentPage, boldFont, y, labelColWidth);
  y -= 24;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const valueLines = wrapTextByWidth(field.value || "-", font, 10, valueColWidth - 16);
    const rowHeight = Math.max(24, valueLines.length * LINE_HEIGHT + FIELD_PADDING * 2);

    // Check if we need a new page
    if (y - rowHeight < minY) {
      drawPageNumber(currentPage, font, pages.length);

      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(currentPage);
      y = PAGE_HEIGHT - MARGIN_TOP - 20;

      currentPage.drawText("...continued", {
        x: MARGIN_LEFT,
        y,
        font,
        size: 8,
        color: COLOR_SUBTITLE,
      });
      y -= 20;

      drawTableHeader(currentPage, boldFont, y, labelColWidth);
      y -= 24;
    }

    // Alternating row background
    if (i % 2 === 0) {
      currentPage.drawRectangle({
        x: MARGIN_LEFT,
        y: y - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: COLOR_ROW_ALT,
      });
    }

    // Row border
    currentPage.drawLine({
      start: { x: MARGIN_LEFT, y: y - rowHeight },
      end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: y - rowHeight },
      thickness: 0.25,
      color: COLOR_BORDER,
    });

    // Column divider
    currentPage.drawLine({
      start: { x: MARGIN_LEFT + labelColWidth, y },
      end: { x: MARGIN_LEFT + labelColWidth, y: y - rowHeight },
      thickness: 0.25,
      color: COLOR_BORDER,
    });

    // Label
    currentPage.drawText(field.label, {
      x: MARGIN_LEFT + 8,
      y: y - 16,
      font: boldFont,
      size: 9.5,
      color: COLOR_LABEL,
    });

    // Value lines
    valueLines.forEach((line, lineIndex) => {
      currentPage.drawText(line, {
        x: MARGIN_LEFT + labelColWidth + 8,
        y: y - 16 - lineIndex * LINE_HEIGHT,
        font,
        size: 10,
        color: COLOR_VALUE,
      });
    });

    y -= rowHeight;
  }

  // Bottom table border
  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: MARGIN_LEFT + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: COLOR_BORDER,
  });
}

// ---------------------------------------------------------------------------
// Main export — generateEntryPdfBytes
// ---------------------------------------------------------------------------

export async function generateEntryPdfBytes(args: {
  categoryName: string;
  fields: PdfField[];
  facultyName?: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const pages: PDFPage[] = [];
  const firstPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(firstPage);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Header on first page
  const contentStartY = await drawHeader(firstPage, pdfDoc, boldFont, font, {
    categoryName: args.categoryName,
    facultyName: args.facultyName,
    generatedDate,
  });

  // Field table (handles multi-page automatically)
  drawFieldTable(pages, pdfDoc, font, boldFont, args.fields, contentStartY);

  // Footer on last page only
  drawFooter(pages[pages.length - 1], font, boldFont);

  // Page numbers on all pages (only if multi-page)
  if (pages.length > 1) {
    pages.forEach((pg, i) => drawPageNumber(pg, font, i + 1));
  }

  return Buffer.from(await pdfDoc.save());
}

// ---------------------------------------------------------------------------
// File storage
// ---------------------------------------------------------------------------

export async function storeEntryPdf(args: {
  email: string;
  categoryFolder: string;
  entryId: string;
  fileNameBase: string;
  bytes: Uint8Array | Buffer;
}) {
  const generatedAtISO = new Date().toISOString();
  const generatedDatePart = generatedAtISO.slice(0, 10).replace(/-/g, "");
  const normalizedCategory = sanitizeSegment(args.categoryFolder || "entry");
  const normalizedEntryId = sanitizeSegment(args.entryId || "entry");
  const normalizedBase = sanitizeFileName(args.fileNameBase || "entry");
  const logicalFileName = `TSEDA_${normalizedCategory}_${normalizedEntryId}_${generatedDatePart}_${normalizedBase}.pdf`;
  const storedPath = path.posix.join(
    "uploads",
    safeEmailDir(args.email),
    args.categoryFolder,
    sanitizeSegment(args.entryId),
    "pdf",
    logicalFileName,
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
