import "server-only";
import type { ImportPlan, ApplyResult } from "@/lib/import/importEngine";

/**
 * Human-readable dry-run/apply reports. The markdown is the artifact Elan
 * reads sheet-by-sheet before trusting --apply; the JSON twin is for tooling.
 * Severity philosophy: ATTENTION rows are the whole point of dry-run —
 * surface them loudly, group everything else quietly.
 */

export function renderMarkdownReport(plan: ImportPlan, apply?: ApplyResult): string {
  const s = plan.summary;
  const lines: string[] = [];
  lines.push(`# Workbook Import ${apply ? "— APPLY RESULT" : "— DRY RUN"}`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Sheets matched | ${s.sheetsMatched} |`);
  lines.push(`| Sheets ambiguous | ${s.sheetsAmbiguous} |`);
  lines.push(`| Sheets unmatched | ${s.sheetsUnmatched} |`);
  lines.push(`| Rows ready | ${s.rowsReady} |`);
  lines.push(`| Rows needing attention | ${s.rowsAttention} |`);
  lines.push(`| Rows already imported / duplicate | ${s.rowsDuplicate} |`);
  if (apply) {
    lines.push(`| Drafts created | ${apply.created.length} |`);
    lines.push(`| Apply failures | ${apply.failed.length} |`);
  }
  lines.push("");

  if (s.unresolvedNames.size) {
    lines.push("## Unresolved names (add to registry, fix in sheet, or confirm external)");
    lines.push("");
    lines.push("| Name as typed | Rows | Closest registered faculty |");
    lines.push("|---|---|---|");
    const sorted = [...s.unresolvedNames.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [name, info] of sorted) {
      lines.push(`| ${name} | ${info.count} | ${info.suggestion ? `${info.suggestion.name} <${info.suggestion.email}>` : "—"} |`);
    }
    lines.push("");
  }

  for (const sheet of plan.sheets) {
    const c = sheet.classification;
    lines.push(`## Sheet: ${sheet.sheetName}`);
    lines.push("");
    if (c.decision === "unmatched") {
      lines.push(`**UNMATCHED** (best score ${(c.score * 100).toFixed(0)}%) — no category claimed this sheet; nothing imported from it.`);
      lines.push("");
      continue;
    }
    if (c.decision === "ambiguous") {
      lines.push(`**AMBIGUOUS** between \`${c.category}\` (${(c.score * 100).toFixed(0)}%) and \`${c.runnerUp?.category}\` (${((c.runnerUp?.score ?? 0) * 100).toFixed(0)}%) — nothing imported; re-run with an explicit mapping once decided.`);
      lines.push("");
      continue;
    }
    lines.push(`Matched **\`${c.category}\`** (confidence ${(c.score * 100).toFixed(0)}%, header row ${c.headerRow + 1}).`);
    lines.push("");
    if (c.mapping) {
      lines.push("| Column | Mapped to | Confidence |");
      lines.push("|---|---|---|");
      sheet.headers.forEach((h, i) => {
        if (h === null || h === "") return;
        const key = c.mapping!.columns.get(i);
        const conf = c.mapping!.confidence.get(i);
        lines.push(`| ${h} | ${key ? `\`${key}\`` : "**unmapped**"} | ${conf ? (conf * 100).toFixed(0) + "%" : "—"} |`);
      });
      lines.push("");
      if (c.mapping.missingForCommit.length) {
        lines.push(`Required-for-commit fields with no column (faculty fill before submit): ${c.mapping.missingForCommit.map((k) => `\`${k}\``).join(", ")}.`);
        lines.push("");
      }
    }
    const attention = sheet.rows.filter((r) => r.outcome === "attention");
    const ready = sheet.rows.filter((r) => r.outcome === "ready");
    const dup = sheet.rows.filter((r) => r.outcome === "duplicate");
    lines.push(`Rows: **${ready.length} ready**, ${attention.length} need attention, ${dup.length} duplicate/imported.`);
    lines.push("");
    if (attention.length) {
      lines.push("### Needs attention");
      lines.push("");
      for (const row of attention) {
        lines.push(`- **Row ${row.rowNumber}** (${row.owner ? row.owner.name : "no owner"}):`);
        for (const issue of row.issues.filter((i) => i.severity === "attention")) {
          lines.push(`  - ${issue.message}`);
        }
      }
      lines.push("");
    }
    const notes = ready.flatMap((r) => r.issues.filter((i) => i.severity === "info").map((i) => `Row ${r.rowNumber}: ${i.message}`));
    if (notes.length) {
      lines.push("<details><summary>Conversion notes on ready rows</summary>");
      lines.push("");
      for (const n of notes) lines.push(`- ${n}`);
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
  }

  if (apply?.failed.length) {
    lines.push("## Apply failures");
    lines.push("");
    for (const f of apply.failed) lines.push(`- ${f.sheetName} row ${f.rowNumber}: ${f.error}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderJsonReport(plan: ImportPlan, apply?: ApplyResult): string {
  return JSON.stringify(
    {
      summary: { ...plan.summary, unresolvedNames: Object.fromEntries(plan.summary.unresolvedNames) },
      sheets: plan.sheets.map((s) => ({
        sheetName: s.sheetName,
        decision: s.classification.decision,
        category: s.classification.category ?? null,
        score: s.classification.score,
        headerRow: s.classification.headerRow,
        columns: s.classification.mapping
          ? Object.fromEntries([...s.classification.mapping.columns.entries()].map(([i, k]) => [s.headers[i] ?? `col${i}`, k]))
          : {},
        rows: s.rows.map((r) => ({
          rowNumber: r.rowNumber, outcome: r.outcome, owner: r.owner ?? null,
          payload: r.payload, issues: r.issues, missingForCommit: r.missingForCommit, dedupHash: r.dedupHash,
        })),
      })),
      apply: apply
        ? { created: apply.created, skipped: apply.skipped, failed: apply.failed }
        : null,
    },
    null,
    2,
  );
}
