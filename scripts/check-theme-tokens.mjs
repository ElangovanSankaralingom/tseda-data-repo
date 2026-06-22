#!/usr/bin/env node
/**
 * Theme-token guard — keeps the 2026-06 light/dark migration from regressing.
 *
 * HARD BANS (any new occurrence fails the build):
 *   1. white/black Tailwind utilities (text-white, bg-white/5, border-white/10, …)
 *      — invisible in light mode. Use the text/surface/border tokens.
 *   2. rgba(255,255,255,…) outside box-shadow inset highlights
 *      — dark-baked surfaces. Use surface/glass/border tokens.
 *   3. hex literals inside className (e.g. text-[#0B0F19])
 *      — use var(--color-…) arbitrary values instead.
 *
 * BASELINE RATCHET (count per file may shrink, never grow):
 *   4. Tailwind palette classes (text-red-400, bg-amber-500/10, …)
 *      — status semantics belong on --color-status-*; identity hues on
 *        --color-palette-*. The few deliberate keeps (solid destructive
 *        buttons, identity chips) are frozen in scripts/theme-baseline.json.
 *
 * Usage:
 *   node scripts/check-theme-tokens.mjs                  # check (CI/lint mode)
 *   node scripts/check-theme-tokens.mjs --update-baseline # after intentional changes
 *
 * Replacement cheat-sheet: see "TSEDA DESIGN LANGUAGE → Legibility System"
 * in CLAUDE.md, and lib/theme/themeTokens.ts for the full token list.
 * For alpha tints of a token: color-mix(in srgb, var(--color-…) N%, transparent).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["app", "components", "lib", "hooks"];
const BASELINE_PATH = join(ROOT, "scripts", "theme-baseline.json");

/** Files where color definitions legitimately live (token sources, ambient css, print). */
const EXCLUDED_FILES = new Set([
  "lib/theme/themeTokens.ts",
  "app/globals.css",
  "app/(protected)/account/print/page.tsx", // print stylesheet: white paper + black ink in every mode, by design
]);

/** Line substrings exempt from hard bans (each documented). */
const HARD_BAN_ALLOW = [
  "bg-white/90", // signin: white backing disc behind the multicolor Google logo — brand, mode-invariant
  "bg-white text-[rgba(0,0,0,0.85)]", // dashboard segmented control: active pill is deliberately white-on-dark-track in BOTH modes
];

const HARD_BANS = [
  {
    name: "white/black Tailwind utility",
    re: /\b(?:text|bg|border|ring|divide|via|from|to|placeholder:text)-(?:white|black)(?:\/[0-9.[\]]+)?(?![\w-])/g,
    hint: "use --color-text-* / surface / border tokens (text on saturated accents: --color-text-on-accent)",
  },
  {
    name: "shadow-black/white utility",
    re: /\b(?:hover:|group-hover:|focus:|focus-visible:)?shadow-(?:black|white)(?:\/[0-9.]+)?\b/g,
    hint: "shadow color is overridden by the globals light/dark .shadow-* elevation — drop shadow-black/white; the soft-ink shadow-{sm..2xl} is already styled by globals.css",
  },
  {
    name: "raw white rgba surface",
    re: /rgba\(\s*255\s*,\s*255\s*,\s*255/g,
    lineExempt: (line) => line.includes("inset"), // kept glass-edge highlights inside box-shadows
    hint: "use --color-glass-bg / --color-surface-* / --color-border-* tokens",
  },
  {
    name: "hex literal in className",
    re: /className=(?:"[^"]*|\{`[^`]*|\{[^}]*?)#[0-9a-fA-F]{6}/g,
    hint: "use a var(--color-…) arbitrary value, e.g. text-[var(--color-text-primary)]",
  },
];

const RATCHET = {
  name: "Tailwind palette class",
  re: /\b(?:text|bg|border|ring)-(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|slate|gray|zinc|neutral|stone)-[0-9]{2,3}(?:\/[0-9]+)?\b/g,
  hint: "status semantics → --color-status-*; identity hues → --color-palette-*",
};

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "coverage") continue;
      yield* walk(full);
    } else if (/\.(tsx?|css)$/.test(entry) && !/\.test\./.test(entry)) {
      yield full;
    }
  }
}

const updateBaseline = process.argv.includes("--update-baseline");
const violations = [];
const ratchetCounts = {};

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (EXCLUDED_FILES.has(rel)) continue;
    const lines = readFileSync(file, "utf8").split("\n");

    lines.forEach((line, i) => {
      for (const ban of HARD_BANS) {
        ban.re.lastIndex = 0;
        let m;
        while ((m = ban.re.exec(line)) !== null) {
          if (ban.lineExempt?.(line)) continue;
          if (HARD_BAN_ALLOW.some((ok) => line.includes(ok))) continue;
          violations.push({ file: rel, line: i + 1, match: m[0].slice(0, 60), rule: ban.name, hint: ban.hint });
        }
      }
      RATCHET.re.lastIndex = 0;
      let r;
      while ((r = RATCHET.re.exec(line)) !== null) {
        ratchetCounts[rel] = (ratchetCounts[rel] ?? 0) + 1;
      }
    });
  }
}

if (updateBaseline) {
  writeFileSync(BASELINE_PATH, JSON.stringify(ratchetCounts, null, 2) + "\n");
  console.log(`theme-guard: baseline updated (${Object.keys(ratchetCounts).length} files).`);
  if (violations.length) {
    console.error(`theme-guard: NOTE — ${violations.length} hard-ban violation(s) still present; baseline does not cover hard bans.`);
    process.exit(1);
  }
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
} catch {
  console.error("theme-guard: missing scripts/theme-baseline.json — run with --update-baseline once.");
  process.exit(1);
}

let failed = false;

if (violations.length) {
  failed = true;
  console.error(`\ntheme-guard: ${violations.length} hard-ban violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.match}`);
    console.error(`      ↳ ${v.hint}`);
  }
}

const grew = Object.entries(ratchetCounts).filter(([f, n]) => n > (baseline[f] ?? 0));
if (grew.length) {
  failed = true;
  console.error(`\ntheme-guard: Tailwind palette classes increased (ratchet only goes down):\n`);
  for (const [f, n] of grew) {
    console.error(`  ${f}: ${baseline[f] ?? 0} → ${n}   (${RATCHET.hint})`);
  }
  console.error(`\n  If the increase is genuinely intentional, run: node scripts/check-theme-tokens.mjs --update-baseline`);
}

if (failed) process.exit(1);
console.log("theme-guard: clean.");
