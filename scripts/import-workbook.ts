/**
 * Workbook importer CLI — maps "Academic Data 2025-2026.xlsx" (or any
 * departmental workbook) into prefilled DRAFT entries.
 *
 *   npm run import:workbook -- <workbook.xlsx>                # dry run (default)
 *   npm run import:workbook -- <workbook.xlsx> --apply        # create drafts
 *   npm run import:workbook -- <workbook.xlsx> --sheet "R&D – Journals"
 *   npm run import:workbook -- <workbook.xlsx> --dlc-owner you@tce.edu  # owner for student sheets
 *   npm run import:workbook -- <workbook.xlsx> --out ./import-report
 *
 * DRY RUN writes <out>.md + <out>.json and touches NOTHING else. --apply
 * creates drafts through the workflow engine (I-W1) for READY rows only,
 * then persists the idempotency ledger — re-running skips everything
 * already imported. Attention rows are never auto-imported.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { readWorkbook } from "../lib/import/xlsxReader.ts";
import { planImport, applyImport, type ImportLedger } from "../lib/import/importEngine.ts";
import { renderMarkdownReport, renderJsonReport } from "../lib/import/report.ts";
import { getFacultyRegistry } from "../lib/admin/facultyRegistry.ts";
import { createEntry } from "../lib/entries/lifecycle.ts";
import { readJson, writeJson, PRIVATE_DIR } from "../lib/storage.ts";

const LEDGER_FILE = "import-ledger.json";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: import-workbook <workbook.xlsx> [--apply] [--sheet <name>] [--out <basename>]");
    process.exit(1);
  }
  const apply = args.includes("--apply");
  const sheetFilter = args.includes("--sheet") ? args[args.indexOf("--sheet") + 1] : undefined;
  const outBase = args.includes("--out")
    ? args[args.indexOf("--out") + 1]
    : path.join(path.dirname(file), `import-report-${new Date().toISOString().slice(0, 10)}`);

  const buf = await fs.readFile(file);
  const workbook = readWorkbook(buf);
  const registry = getFacultyRegistry().faculty
    .filter((f) => f.status === "active")
    .map((f) => ({ email: f.email, name: f.name }));
  const ledger = await readJson<ImportLedger>(LEDGER_FILE, {}, PRIVATE_DIR);
  const dlcOwnerEmail = args.includes("--dlc-owner") ? args[args.indexOf("--dlc-owner") + 1] : undefined;
  const dlcOwner = dlcOwnerEmail
    ? registry.find((f) => f.email.toLowerCase() === dlcOwnerEmail.toLowerCase())
    : undefined;
  if (dlcOwnerEmail && !dlcOwner) {
    console.error(`--dlc-owner ${dlcOwnerEmail} is not an active faculty in the registry`);
    process.exit(1);
  }

  const plan = planImport(workbook, { registry, ledger, dlcOwner }, { sheetFilter });
  let applyResult;
  if (apply) {
    applyResult = await applyImport(plan, { registry, ledger, dlcOwner, createEntry });
    await writeJson(LEDGER_FILE, applyResult.ledger, PRIVATE_DIR);
  }

  await fs.writeFile(`${outBase}.md`, renderMarkdownReport(plan, applyResult), "utf8");
  await fs.writeFile(`${outBase}.json`, renderJsonReport(plan, applyResult), "utf8");

  const s = plan.summary;
  console.log(`Sheets: ${s.sheetsMatched} matched, ${s.sheetsAmbiguous} ambiguous, ${s.sheetsUnmatched} unmatched`);
  console.log(`Rows:   ${s.rowsReady} ready, ${s.rowsAttention} attention, ${s.rowsDuplicate} duplicate`);
  if (applyResult) {
    console.log(`Apply:  ${applyResult.created.length} drafts created, ${applyResult.skipped} skipped, ${applyResult.failed.length} failed`);
  } else {
    console.log(`DRY RUN — no data written. Review ${outBase}.md, then re-run with --apply.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
