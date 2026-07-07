import "server-only";

/**
 * Value normalizers for the workbook importer.
 *
 * Philosophy: NEVER guess silently. Every lossy or inferential conversion
 * returns an `inferred` note the row report surfaces, and anything
 * unparseable returns null so the field is OMITTED from the draft (create-
 * mode validation tolerates absent keys; faculty fill the gap before
 * submit). The importer must not manufacture certainty the workbook lacks.
 */

export type Normalized<T> = { value: T; inferred?: string } | null;

const NBSP = / /g;

/** Collapse whitespace, strip non-breaking spaces and stray quotes/dots. */
export function cleanText(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(NBSP, " ").replace(/\s+/g, " ").trim();
}

/** Lowercased, punctuation-free key for fuzzy header/enum comparison. */
export function foldKey(raw: unknown): string {
  return cleanText(raw)
    .toLowerCase()
    .replace(/[’'"“”().,:;/\\_&?#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

function iso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Excel 1900-system serial → ISO date. Plausible range only (2000–2100). */
function fromExcelSerial(n: number): string | null {
  if (!Number.isFinite(n) || n < 36526 || n > 73415) return null; // 2000-01-01 .. 2100-12-31
  // Excel day 1 = 1900-01-01, with the phantom 1900-02-29 (serial 60);
  // for post-1900 serials the epoch works out to 1899-12-30.
  const ms = Math.round(n) * 86400000 + Date.UTC(1899, 11, 30);
  const d = new Date(ms);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Parse the workbook's date dialects → ISO yyyy-mm-dd.
 * Month-only values land on the 1st with an `inferred` note. Numeric
 * dd/mm/yyyy is read DAY-FIRST (departmental convention); when the value is
 * only valid month-first we accept it with a note.
 */
export function normalizeDate(raw: unknown): Normalized<string> {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    const fromSerial = fromExcelSerial(raw);
    return fromSerial ? { value: fromSerial } : null;
  }
  const text = cleanText(raw);
  if (!text) return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text); // ISO already
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return isRealDate(y, mo, d) ? { value: iso(y, mo, d) } : null;
  }

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text); // dd/mm/yyyy vs mm/dd/yyyy
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    if (isRealDate(y, b, a)) return { value: iso(y, b, a) }; // day-first wins
    if (isRealDate(y, a, b)) return { value: iso(y, a, b), inferred: `read "${text}" month-first` };
    return null;
  }

  m = /^([A-Za-z]+)[\s.-]*(\d{4})$/.exec(text); // "Jan 2026", "March-2026"
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) return { value: iso(+m[2], mo, 1), inferred: `month-year "${text}" → 1st of month` };
  }

  m = /^(\d{1,2})[\s.-]*([A-Za-z]+)[\s.,-]*(\d{4})$/.exec(text); // "12 Jan 2026"
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo && isRealDate(+m[3], mo, +m[1])) return { value: iso(+m[3], mo, +m[1]) };
  }

  m = /^(\d{1,2})[-/](\d{4})$/.exec(text); // "01/2026"
  if (m && +m[1] >= 1 && +m[1] <= 12) {
    return { value: iso(+m[2], +m[1], 1), inferred: `month-year "${text}" → 1st of month` };
  }

  m = /^(\d{4})$/.exec(text); // bare year — too lossy to place a day
  if (m && +m[1] >= 1990 && +m[1] <= 2100) {
    return { value: iso(+m[1], 1, 1), inferred: `bare year "${text}" → Jan 1 (verify)` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Academic year & semester
// ---------------------------------------------------------------------------

/** "2025-26" | "2025-2026" | "AY 2025-26" → "Academic Year 2025-2026" (app format). */
export function normalizeAcademicYear(raw: unknown): Normalized<string> {
  const text = cleanText(raw);
  const m = /(\d{4})\s*[-–/]\s*(\d{2,4})/.exec(text);
  if (!m) return null;
  const start = +m[1];
  const endRaw = m[2];
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + +endRaw : +endRaw;
  if (start < 1990 || start > 2100 || end !== start + 1) return null;
  return { value: `Academic Year ${start}-${end}` };
}

/** Derive "Academic Year YYYY-YYYY" from an ISO date (Jul–Jun year). */
export function academicYearFromISO(isoDate: string): Normalized<string> {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  const y = +m[1];
  const month = +m[2];
  const start = month >= 7 ? y : y - 1;
  return { value: `Academic Year ${start}-${start + 1}`, inferred: `academic year derived from date ${isoDate}` };
}

/** ODD = Jul–Dec, EVEN = Jan–Jun (department calendar). */
export function semesterFromISO(isoDate: string): Normalized<"ODD" | "EVEN"> {
  const m = /^\d{4}-(\d{2})/.exec(isoDate);
  if (!m) return null;
  const month = +m[1];
  return { value: month >= 7 ? "ODD" : "EVEN", inferred: `semester inferred from date ${isoDate}` };
}

export function normalizeSemesterType(raw: unknown): Normalized<"ODD" | "EVEN"> {
  const k = foldKey(raw);
  if (!k) return null;
  if (/^odd\b|^i\b|^1\b|jul|winter/.test(k)) return { value: "ODD" };
  if (/^even\b|^ii\b|^2\b|jan|summer/.test(k)) return { value: "EVEN" };
  return null;
}

// ---------------------------------------------------------------------------
// Enums, amounts, misc
// ---------------------------------------------------------------------------

/** Fuzzy-match a cell against a schema enum list (fold both sides). */
export function normalizeEnum(raw: unknown, enumValues: readonly (string | number | boolean)[]): Normalized<string | number | boolean> {
  const k = foldKey(raw);
  if (!k) return null;
  for (const v of enumValues) {
    if (foldKey(v) === k) return { value: v };
  }
  // Prefix/containment pass: "intl conference" → "International".
  for (const v of enumValues) {
    const fv = foldKey(v);
    if (fv && (k.startsWith(fv) || fv.startsWith(k) || k.includes(fv))) {
      return { value: v, inferred: `"${cleanText(raw)}" matched enum "${String(v)}"` };
    }
  }
  // Domain synonyms the workbook actually uses.
  const SYN: [RegExp, string][] = [
    [/^(intl|international)/, "International"],
    [/^(natl|national)/, "National"],
    [/scopus/, "Scopus"],
    [/web of science|wos/, "Web of Science"],
    [/ugc\s*care|ugc/, "UGC-CARE"],
    [/none|not indexed|nil|na|other/, "Other/None"],
  ];
  for (const [re, target] of SYN) {
    if (re.test(k)) {
      const hit = enumValues.find((v) => foldKey(v) === foldKey(target));
      if (hit !== undefined) return { value: hit, inferred: `"${cleanText(raw)}" matched enum "${String(hit)}"` };
    }
  }
  return null;
}

/** "₹2,50,000" | "2.5 lakhs" | "1.2 Cr" | 250000 → rupees number. */
export function normalizeAmount(raw: unknown): Normalized<number> {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return { value: raw };
  const text = cleanText(raw).toLowerCase().replace(/₹|rs\.?|inr/g, "").trim();
  if (!text) return null;
  const m = /^([\d,]+(?:\.\d+)?)\s*(lakhs?|l\b|crores?|cr\b)?/.exec(text);
  if (!m) return null;
  const base = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const unit = m[2];
  if (!unit) return { value: base };
  const mult = /^l/.test(unit) ? 1e5 : 1e7;
  return { value: Math.round(base * mult), inferred: `"${cleanText(raw)}" read as ₹${Math.round(base * mult).toLocaleString("en-IN")}` };
}

export function normalizeBoolean(raw: unknown): Normalized<boolean> {
  if (typeof raw === "boolean") return { value: raw };
  const k = foldKey(raw);
  if (!k) return null;
  if (/^(yes|y|true|1)$/.test(k)) return { value: true };
  if (/^(no|n|false|0|nil|na)$/.test(k)) return { value: false };
  return null;
}

export function normalizeNumber(raw: unknown): Normalized<number> {
  if (typeof raw === "number" && Number.isFinite(raw)) return { value: raw };
  const text = cleanText(raw).replace(/,/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? { value: n } : null;
}
