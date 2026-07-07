import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * TAMIL AUTHENTICITY GUARD (Elan's audit item 8, 2026-07).
 *
 * The ta-completeness check catches MISSING keys; this one catches the
 * subtler failure — English sitting in a Tamil slot. Rule: every ta.ts
 * value with 3+ letters must contain at least one Tamil codepoint
 * (U+0B80–U+0BFF), unless the key is a deliberate invariant (acronyms,
 * identifiers, the language's own English label, email placeholders).
 *
 * The 2026-07 sweep translated 53 English-in-Tamil-slot values; this
 * guard keeps the count at zero forever.
 */

/** Keys whose values are intentionally script-invariant. */
const INVARIANT_KEYS = new Set([
  "feedbackOdd", // "ODD %"
  "feedbackEven", // "EVEN %"
  "doi",
  "issn",
  "isbn",
  "issnIsbn",
  "emailPlaceholder", // faculty@tce.edu
  "english", // language names display in their own tongue
]);

function decode(raw: string): string {
  if (!/\\u[0-9a-fA-F]{4}/.test(raw)) return raw;
  return raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function hasTamil(value: string): boolean {
  return [...value].some((ch) => ch >= "஀" && ch <= "௿");
}

test("every Tamil dictionary value is real Tamil (or a declared invariant)", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/i18n/ta.ts"), "utf8");
  const failures: string[] = [];

  for (const match of source.matchAll(/^\s*([A-Za-z0-9_]+|"[^"]+"):\s*"((?:[^"\\]|\\.)*)"/gm)) {
    const key = match[1]!.replace(/"/g, "");
    if (INVARIANT_KEYS.has(key)) continue;
    const value = decode(match[2]!);
    const letters = [...value].filter((ch) => /[a-zA-Z]/.test(ch)).length;
    // Values that are mostly Latin letters AND carry no Tamil at all are
    // English in a Tamil slot. Short tokens (<3 letters) and templated
    // fragments ({count}, %) pass through.
    if (letters >= 3 && !hasTamil(value)) {
      failures.push(`${key}: "${value.slice(0, 60)}"`);
    }
  }

  assert.deepEqual(
    failures,
    [],
    `English found in Tamil slots (translate or add to INVARIANT_KEYS):\n${failures.join("\n")}`,
  );
});
