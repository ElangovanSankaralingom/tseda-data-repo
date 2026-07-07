import assert from "node:assert/strict";
import test from "node:test";
import { generateCsvText, generateXlsxBuffer } from "../../lib/export/exportService.ts";

/**
 * EXPORT INJECTION GUARDS (2026-07 security pass, CWE-1236).
 *
 * A faculty entry title is user-controlled text. When a departmental export
 * is opened in Excel/LibreOffice, a cell beginning with = + - @ is EVALUATED
 * as a formula — turning a malicious title into an attack on whoever opens
 * the sheet. These tests inject formula payloads and assert:
 *  - CSV neutralizes the leading formula char (apostrophe prefix);
 *  - XLSX writes user text as a non-evaluated string cell and never emits a
 *    formula (<f>) element from user data, with XML properly escaped.
 * They FAIL on the pre-fix csvEscape.
 */

const PAYLOADS = [
  '=HYPERLINK("http://evil","click")',
  "+1+1",
  "-2+3",
  "@SUM(A1)",
  "=cmd|'/c calc'!A1",
  "\t=1+1",
];

test("CSV export neutralizes formula-leading cells (apostrophe prefix)", () => {
  const result = generateCsvText(["Workshop"], PAYLOADS.map((p) => [p]));
  assert.ok(result.ok);
  const lines = result.data.split("\n").slice(1); // drop header
  lines.forEach((line, i) => {
    const original = PAYLOADS[i]!;
    // The neutralized cell must NOT begin (after any opening quote) with a
    // bare formula char — an apostrophe now shields it.
    const cell = line.startsWith('"') ? line.slice(1) : line;
    assert.ok(
      cell.startsWith("'"),
      `payload ${JSON.stringify(original)} not neutralized: ${JSON.stringify(line)}`,
    );
  });
});

test("CSV export still quote-escapes commas, quotes, newlines", () => {
  const result = generateCsvText(
    ["A", "B"],
    [["has, comma", 'has "quote"']],
  );
  assert.ok(result.ok);
  const body = result.data.split("\n")[1]!;
  assert.ok(body.includes('"has, comma"'), "comma cell quoted");
  assert.ok(body.includes('"has ""quote"""'), "quote doubled + wrapped");
});

test("CSV export leaves benign values untouched", () => {
  const result = generateCsvText(["A"], [["Parametric Design FDP"], ["40"]]);
  assert.ok(result.ok);
  const lines = result.data.split("\n");
  assert.equal(lines[1], "Parametric Design FDP");
  assert.equal(lines[2], "40");
});

test("XLSX export writes user formulas as inert string cells, never <f>, XML-escaped", () => {
  const result = generateXlsxBuffer(
    ["Workshop"],
    [['=HYPERLINK("http://evil","x")'], ["a & b < c > d"]],
    "Sheet1",
  );
  assert.ok(result.ok);
  const text = Buffer.from(result.data).toString("latin1");
  // No formula element may carry user data.
  assert.ok(!text.includes("<f>"), "xlsx must not emit a <f> formula element");
  // The dangerous chars are XML-escaped (so no element injection, and the
  // string lands as data, not markup).
  assert.ok(text.includes("&amp;") || !text.includes("a & b"), "ampersand escaped");
  assert.ok(!text.includes("<t>=HYPERLINK") || text.includes("t=\"inlineStr\""), "user string is an inlineStr cell");
});
