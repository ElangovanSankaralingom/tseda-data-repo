import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * DEMO-MODE ROUTE GUARD — enforced convention (like the theme guard and the
 * ta-completeness guard): EVERY API route handler must be wrapped with
 * demoAware() so a demo-active user's request runs in the demo universe.
 * AsyncLocalStorage context cannot be entered from an awaited helper, so the
 * wrapper at the export site is the only correct enclosure — this test keeps
 * every current and FUTURE route honest.
 *
 * Exemptions (machine/anonymous endpoints that must always run REAL):
 * - auth/[...nextauth]  — NextAuth internals
 * - cron/nightly        — machine-auth job, must judge real data
 * - health              — anonymous liveness probe
 */

const EXEMPT = new Set([
  "app/api/auth/[...nextauth]/route.ts",
  "app/api/cron/nightly/route.ts",
  "app/api/health/route.ts",
]);

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function findRoutes(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findRoutes(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

test("every API route exports demoAware-wrapped handlers (or is explicitly exempt)", () => {
  const root = process.cwd();
  const routes = findRoutes(path.join(root, "app", "api"));
  assert.ok(routes.length > 50, "route discovery must find the API surface");

  const violations: string[] = [];

  for (const file of routes) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    if (EXEMPT.has(rel)) continue;
    const src = fs.readFileSync(file, "utf8");

    let exportedMethods = 0;
    for (const m of METHODS) {
      // Raw method exports are forbidden — they would bypass the universe.
      if (new RegExp(`export\\s+async\\s+function\\s+${m}\\(`).test(src)) {
        violations.push(`${rel}: raw "export async function ${m}" (wrap with demoAware)`);
      }
      if (new RegExp(`export\\s*\\{[^}]*\\b${m}\\b`).test(src)) {
        violations.push(`${rel}: re-export of ${m} (wrap with demoAware)`);
      }
      const constExport = new RegExp(`export\\s+const\\s+${m}\\s*=\\s*(\\w+)\\(`).exec(src);
      if (constExport) {
        exportedMethods += 1;
        if (constExport[1] !== "demoAware") {
          violations.push(`${rel}: export const ${m} = ${constExport[1]}(...) — must be demoAware(...)`);
        }
      }
    }
    if (exportedMethods === 0) {
      violations.push(`${rel}: no demoAware-wrapped method exports found`);
    }
  }

  assert.deepEqual(violations, [], `Demo-universe guard violations:\n${violations.join("\n")}`);
});
