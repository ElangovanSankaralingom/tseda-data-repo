import "server-only";
import zlib from "node:zlib";

/**
 * Minimal, dependency-free .xlsx READER for the workbook importer.
 *
 * Deliberately hand-rolled (mirrors the hand-rolled writer in
 * lib/export/exportGenerators.ts): the importer runs against ONE known
 * departmental workbook shape, and a scoped ~300-line reader we fully own
 * beats adding a heavyweight spreadsheet dependency to a codebase that just
 * completed a supply-chain-conscious security pass.
 *
 * Supported (all the real workbook needs): ZIP entries stored (method 0) or
 * deflated (method 8); shared strings incl. rich-text runs (<r><t> concat,
 * <rPh> phonetic runs skipped); inline strings; boolean/error/numeric cells;
 * XML entities. NOT supported and out of scope: zip64, encryption, formulas
 * (cached <v> is read), styles/number formats (date-serial interpretation is
 * the normalizer's job, where the target schema kind is known).
 *
 * SAFETY (I-X-adjacent): the workbook is untrusted user input. Hard caps on
 * entry count, per-entry and total uncompressed bytes (zip-bomb guard), and
 * cell count. Failures throw XlsxReadError with a human-readable reason —
 * the importer reports them, never crashes the run.
 */

export class XlsxReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XlsxReadError";
  }
}

const MAX_ZIP_ENTRIES = 4096;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024; // 64 MB per part
const MAX_TOTAL_BYTES = 256 * 1024 * 1024; // 256 MB inflated total
const MAX_CELLS = 2_000_000;

export type CellValue = string | number | boolean | null;

export type SheetGrid = {
  name: string;
  /** Dense row-major grid; trailing empty rows/columns trimmed. */
  rows: CellValue[][];
};

export type Workbook = { sheets: SheetGrid[] };

// ---------------------------------------------------------------------------
// ZIP container
// ---------------------------------------------------------------------------

type ZipEntryMeta = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function findEndOfCentralDirectory(buf: Buffer): number {
  // EOCD = 0x06054b50, at most 22 + 65535 bytes from the end (zip comment).
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new XlsxReadError("Not a valid .xlsx file (zip end record missing)");
}

function readCentralDirectory(buf: Buffer): ZipEntryMeta[] {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count > MAX_ZIP_ENTRIES) {
    throw new XlsxReadError(`Workbook zip has ${count} entries (max ${MAX_ZIP_ENTRIES})`);
  }
  const entries: ZipEntryMeta[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) {
      throw new XlsxReadError("Corrupt zip central directory");
    }
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function extractEntry(buf: Buffer, meta: ZipEntryMeta): Buffer {
  if (meta.uncompressedSize > MAX_ENTRY_BYTES) {
    throw new XlsxReadError(`Zip part ${meta.name} inflates to ${meta.uncompressedSize} bytes (max ${MAX_ENTRY_BYTES})`);
  }
  const p = meta.localHeaderOffset;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) {
    throw new XlsxReadError(`Corrupt local header for ${meta.name}`);
  }
  // The LOCAL header's own name/extra lengths govern the data offset (they
  // can differ from the central directory's copies).
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + meta.compressedSize);
  if (meta.method === 0) return Buffer.from(raw);
  if (meta.method === 8) {
    const out = zlib.inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
    return out;
  }
  throw new XlsxReadError(`Unsupported zip compression method ${meta.method} in ${meta.name}`);
}

function readZip(buf: Buffer): Map<string, Buffer> {
  const metas = readCentralDirectory(buf);
  const out = new Map<string, Buffer>();
  let total = 0;
  for (const meta of metas) {
    // Only materialize the parts the reader actually consumes.
    if (!/^xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(meta.name)) {
      continue;
    }
    const data = extractEntry(buf, meta);
    total += data.length;
    if (total > MAX_TOTAL_BYTES) {
      throw new XlsxReadError("Workbook inflates past the safety cap (possible zip bomb)");
    }
    out.set(meta.name, data);
  }
  return out;
}

// ---------------------------------------------------------------------------
// XML helpers — targeted extraction, not a general parser (see header note)
// ---------------------------------------------------------------------------

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Concatenate every <t> in a fragment, skipping phonetic <rPh> runs. */
function textOf(fragment: string): string {
  const noPhonetic = fragment.replace(/<rPh[\s\S]*?<\/rPh>/g, "");
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noPhonetic))) out += decodeXml(m[1] ?? "");
  return out;
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(textOf(m[1] ?? ""));
  return out;
}

type SheetRef = { name: string; relId: string };

function parseWorkbookSheets(xml: string): SheetRef[] {
  const out: SheetRef[] = [];
  const re = /<sheet\s[^>]*?\/?>(?:<\/sheet>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    const name = /\sname="([^"]*)"/.exec(tag)?.[1];
    const relId = /\sr:id="([^"]*)"/.exec(tag)?.[1];
    if (name !== undefined && relId) out.push({ name: decodeXml(name), relId });
  }
  return out;
}

function parseRels(xml: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!xml) return out;
  const re = /<Relationship\s[^>]*?\/?>(?:<\/Relationship>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    const id = /\sId="([^"]*)"/.exec(tag)?.[1];
    const target = /\sTarget="([^"]*)"/.exec(tag)?.[1];
    if (id && target) out.set(id, target);
  }
  return out;
}

/** "BC7" → { col: 54, row: 7 } (0-based col). */
export function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: parseInt(m[2], 10) - 1 };
}

function parseWorksheet(xml: string, shared: string[], cellBudget: { left: number }): CellValue[][] {
  const grid: CellValue[][] = [];
  const rowRe = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    const rowBody = rowMatch[1];
    while ((cellMatch = cellRe.exec(rowBody))) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const ref = /\sr="([^"]*)"/.exec(" " + attrs)?.[1] ?? /^r="([^"]*)"/.exec(attrs)?.[1];
      if (!ref) continue; // cells without refs (rare producer) are skipped
      const pos = parseCellRef(ref);
      if (!pos) continue;
      const type = /(?:^|\s)t="([^"]*)"/.exec(attrs)?.[1] ?? "n";
      let value: CellValue = null;
      if (type === "inlineStr") {
        value = textOf(body);
      } else {
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v === undefined) {
          value = null;
        } else if (type === "s") {
          value = shared[parseInt(decodeXml(v), 10)] ?? null;
        } else if (type === "str") {
          value = decodeXml(v);
        } else if (type === "b") {
          value = decodeXml(v).trim() === "1";
        } else if (type === "e") {
          value = null; // error cells (#REF! etc.) read as empty
        } else {
          const n = Number(decodeXml(v));
          value = Number.isFinite(n) ? n : null;
        }
      }
      if (value === null) continue;
      if (--cellBudget.left < 0) {
        throw new XlsxReadError(`Workbook exceeds the ${MAX_CELLS}-cell safety cap`);
      }
      (grid[pos.row] ??= [])[pos.col] = value;
    }
  }
  // Normalize: fill holes with null, trim fully-empty trailing rows/columns.
  let maxCol = -1;
  for (const row of grid) {
    if (!row) continue;
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c] !== null && row[c] !== undefined && row[c] !== "") {
        if (c > maxCol) maxCol = c;
        break;
      }
    }
  }
  let lastRow = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (row && row.some((v) => v !== null && v !== undefined && v !== "")) lastRow = r;
  }
  const out: CellValue[][] = [];
  for (let r = 0; r <= lastRow; r++) {
    const src = grid[r] ?? [];
    const row: CellValue[] = [];
    for (let c = 0; c <= maxCol; c++) row.push(src[c] === undefined || src[c] === "" ? null : src[c]);
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function readWorkbook(buf: Buffer): Workbook {
  const parts = readZip(buf);
  const workbookXml = parts.get("xl/workbook.xml")?.toString("utf8");
  if (!workbookXml) throw new XlsxReadError("Not a valid .xlsx file (xl/workbook.xml missing)");
  const rels = parseRels(parts.get("xl/_rels/workbook.xml.rels")?.toString("utf8"));
  const shared = parseSharedStrings(parts.get("xl/sharedStrings.xml")?.toString("utf8"));
  const cellBudget = { left: MAX_CELLS };
  const sheets: SheetGrid[] = [];
  for (const ref of parseWorkbookSheets(workbookXml)) {
    const target = rels.get(ref.relId);
    if (!target) continue; // chartsheets/macro sheets: no worksheet target we read
    const normalized = target.replace(/^\//, "").replace(/^(?!xl\/)/, "xl/");
    const xml = parts.get(normalized)?.toString("utf8");
    if (!xml) continue;
    sheets.push({ name: ref.name, rows: parseWorksheet(xml, shared, cellBudget) });
  }
  return { sheets };
}
