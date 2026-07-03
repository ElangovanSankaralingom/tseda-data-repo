#!/usr/bin/env node
/**
 * One-shot codemod (2026-07, demo mode): wrap every API route handler with
 * demoAware() so demo-active users' requests run in the demo universe.
 *
 * Transform per file:
 *   export async function GET(...)  →  async function GETHandler(...)
 *   + appended:  export const GET = demoAware(GETHandler);
 *   + import { demoAware } from "@/lib/demo/demoAware";
 *
 * Exempt (machine/anonymous endpoints — must always run REAL):
 *   auth/[...nextauth], cron/nightly, health.
 * Kept in the repo as documentation; the invariant itself is enforced by
 * tests/demo/routeGuard.test.ts.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const EXEMPT = [
  "app/api/auth/[...nextauth]/route.ts",
  "app/api/cron/nightly/route.ts",
  "app/api/health/route.ts",
];

function findRoutes(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findRoutes(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

const routes = findRoutes(path.join(ROOT, "app", "api"));
let changed = 0;
const skipped = [];

for (const file of routes) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  if (EXEMPT.includes(rel)) {
    skipped.push(`${rel} (exempt)`);
    continue;
  }
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("demoAware(")) {
    skipped.push(`${rel} (already wrapped)`);
    continue;
  }
  const found = [];
  for (const m of METHODS) {
    const decl = new RegExp(`export async function ${m}\\(`);
    if (!decl.test(src)) continue;
    // Verified before the run: no route aliases or invokes its own method
    // export (only comments/log strings mention the method names).
    src = src.replace(decl, `async function ${m}Handler(`);
    found.push(m);
  }
  if (found.length === 0) continue;
  if (!src.includes('from "@/lib/demo/demoAware"')) {
    // Top-of-file insertion — never lands inside a multi-line import.
    src = `import { demoAware } from "@/lib/demo/demoAware";\n${src}`;
  }
  const exports = found
    .map((m) => `export const ${m} = demoAware(${m}Handler);`)
    .join("\n");
  src = `${src.trimEnd()}\n\n// Demo-mode universe wrapper — every handler runs in the caller's universe.\n${exports}\n`;
  fs.writeFileSync(file, src);
  changed++;
}

console.log(`wrapped: ${changed}`);
for (const s of skipped) console.log(`skipped: ${s}`);
