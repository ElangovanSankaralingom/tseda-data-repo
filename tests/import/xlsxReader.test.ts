import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { readWorkbook, parseCellRef, XlsxReadError } from "@/lib/import/xlsxReader";
import { makeXlsx } from "../helpers/xlsxFixture.ts";

test("reads inline-string, numeric, and boolean cells into a dense grid", () => {
  const wb = readWorkbook(
    makeXlsx([
      {
        name: "R&D – Journals",
        rows: [
          ["Title of Paper", "Month & Year", "Scopus?"],
          ["Adaptive Reuse of Chettinad Houses", 45870, true],
          [null, null, null],
        ],
      },
    ]),
  );
  assert.equal(wb.sheets.length, 1);
  assert.equal(wb.sheets[0].name, "R&D – Journals");
  // Trailing all-empty row trimmed; holes are null.
  assert.deepEqual(wb.sheets[0].rows, [
    ["Title of Paper", "Month & Year", "Scopus?"],
    ["Adaptive Reuse of Chettinad Houses", 45870, true],
  ]);
});

test("reads sharedStrings workbooks (dedup + rich text entities)", () => {
  const wb = readWorkbook(
    makeXlsx(
      [
        {
          name: "Sheet1",
          rows: [
            ["A & B <quoted>", "A & B <quoted>"],
            ["தமிழ்", "second"],
          ],
        },
      ],
      { sharedStrings: true },
    ),
  );
  assert.deepEqual(wb.sheets[0].rows[0], ["A & B <quoted>", "A & B <quoted>"]);
  assert.equal(wb.sheets[0].rows[1][0], "தமிழ்");
});

test("multiple sheets keep workbook order and names", () => {
  const wb = readWorkbook(
    makeXlsx([
      { name: "First", rows: [["a"]] },
      { name: "Qn 19 - R&D", rows: [["b"]] },
      { name: "Consultancy", rows: [["c"]] },
    ]),
  );
  assert.deepEqual(
    wb.sheets.map((s) => s.name),
    ["First", "Qn 19 - R&D", "Consultancy"],
  );
});

test("parseCellRef handles multi-letter columns", () => {
  assert.deepEqual(parseCellRef("A1"), { col: 0, row: 0 });
  assert.deepEqual(parseCellRef("Z9"), { col: 25, row: 8 });
  assert.deepEqual(parseCellRef("AA10"), { col: 26, row: 9 });
  assert.deepEqual(parseCellRef("BC7"), { col: 54, row: 6 });
  assert.equal(parseCellRef("7A"), null);
});

test("rejects non-xlsx bytes with a readable error", () => {
  assert.throws(() => readWorkbook(Buffer.from("definitely not a zip")), XlsxReadError);
  // A zip that isn't a workbook (no xl/workbook.xml) must also fail cleanly.
  const notWorkbook = makeXlsx([{ name: "S", rows: [["x"]] }]);
  // Corrupt it: truncating the tail kills the EOCD scan.
  assert.throws(() => readWorkbook(notWorkbook.subarray(0, 40)), XlsxReadError);
});

test("zip-bomb guard: a deflated part expanding past the per-entry cap throws", () => {
  // Hand-assemble a tiny zip whose single entry inflates to ~128 MB.
  const big = Buffer.alloc(128 * 1024 * 1024, 0x41);
  const deflated = zlib.deflateRawSync(big);
  const name = Buffer.from("xl/workbook.xml");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(big.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(big.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const cdStart = 30 + name.length + deflated.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + name.length, 12);
  eocd.writeUInt32LE(cdStart, 16);
  const bomb = Buffer.concat([local, name, deflated, central, name, eocd]);
  assert.throws(() => readWorkbook(bomb), /safety cap|inflates/i);
});
