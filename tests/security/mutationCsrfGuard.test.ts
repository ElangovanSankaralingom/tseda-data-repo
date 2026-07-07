import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * MUTATION CSRF COVERAGE (2026-07 security audit) — enforced convention:
 * EVERY route file that exports a mutation handler (POST/PUT/PATCH/DELETE)
 * must enforce CSRF, either directly (csrfGuard/validateCsrf in the file) or
 * by delegating to a shared handler that does. Origin-header CSRF is the
 * app's defense; this guard keeps a future mutation route from shipping
 * without it — the same style as the demoAware and theme-token guards.
 *
 * Exemptions (machine/anonymous endpoints, no browser cookie context):
 * - auth/[...nextauth]  — NextAuth internals
 * - cron/nightly        — machine-auth via CRON_SECRET header
 * - health              — anonymous liveness probe (read-only)
 */

const EXEMPT = new Set([
  "app/api/auth/[...nextauth]/route.ts",
  "app/api/cron/nightly/route.ts",
  "app/api/health/route.ts",
]);

// Shared handlers that enforce CSRF for their thin route wrappers.
const DELEGATES = /categoryRouteHandler|categoryFileHandler|handleCategory|handleFile/;
const CSRF = /csrfGuard|validateCsrf/;
const MUTATION_EXPORT = /export\s+const\s+(POST|PUT|PATCH|DELETE)\b/;

function findRoutes(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findRoutes(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

test("every mutation route enforces CSRF (directly or via a shared handler)", () => {
  const root = process.cwd();
  const routes = findRoutes(path.join(root, "app", "api"));
  assert.ok(routes.length > 50, "route discovery must find the API surface");

  const violations: string[] = [];
  for (const file of routes) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    if (EXEMPT.has(rel)) continue;
    const src = fs.readFileSync(file, "utf8");
    if (!MUTATION_EXPORT.test(src)) continue; // read-only route
    if (CSRF.test(src) || DELEGATES.test(src)) continue;
    violations.push(rel);
  }

  assert.deepEqual(
    violations,
    [],
    `these mutation routes enforce no CSRF (add csrfGuard or delegate):\n${violations.join("\n")}`,
  );
});
