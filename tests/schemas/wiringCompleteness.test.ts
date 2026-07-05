import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { CATEGORY_LIST, getCategoryConfig, getCategorySchema } from "../../data/categoryRegistry.ts";

/**
 * WIRING COMPLETENESS — every category needs SIX manual wiring points
 * beyond the registry (API route, file route, adapter, router entry, icon,
 * display name). Icons and display names have their own guards; this test
 * pins the remaining three so a missing file or router key fails CI
 * instead of 404ing in the browser. (Motivated by a real 2026-07 near-miss:
 * journal-publications originally shipped without its file route.)
 */

const ROOT = process.cwd();

test("every category has its API route, file route, and adapter on disk", () => {
  for (const slug of CATEGORY_LIST) {
    const route = path.join(ROOT, "app", "api", "me", slug, "route.ts");
    const fileRoute = path.join(ROOT, "app", "api", "me", slug, "file", "route.ts");
    const adapter = path.join(ROOT, "components", "data-entry", "adapters", `${slug}.tsx`);
    assert.ok(fs.existsSync(route), `${slug}: missing app/api/me/${slug}/route.ts`);
    assert.ok(fs.existsSync(fileRoute), `${slug}: missing app/api/me/${slug}/file/route.ts`);
    assert.ok(fs.existsSync(adapter), `${slug}: missing adapter ${slug}.tsx`);

    // The generated thin wrappers must target THEIR OWN category (sed-based
    // scaffolding makes copy-paste slips possible).
    const routeSource = fs.readFileSync(route, "utf8");
    assert.ok(
      routeSource.includes(`"${slug}"`),
      `${slug}: route.ts does not reference its own category slug`,
    );
  }
});

test("CategoryPageRouter lazy map covers every registry slug", () => {
  const routerSource = fs.readFileSync(
    path.join(ROOT, "components", "data-entry", "CategoryPageRouter.tsx"),
    "utf8",
  );
  for (const slug of CATEGORY_LIST) {
    // Keys appear as "<slug>": <loader> (quoted) or <slug>: <loader> (bare
    // for identifier-safe slugs like workshops/patents). The loader shape
    // is either lazy(...) or () => import(...) — accept both.
    const quoted = `"${slug}"`;
    const bare = new RegExp(`(^|\\s)${slug.replace(/-/g, "\\-")}: (lazy|\\(\\) =>)`, "m");
    assert.ok(
      routerSource.includes(quoted) || bare.test(routerSource),
      `${slug}: missing from CategoryPageRouter ADAPTERS map — the category page would 404`,
    );
  }
});

test("registry self-consistency: schema.category and schemaKey match the slug", () => {
  for (const slug of CATEGORY_LIST) {
    const config = getCategoryConfig(slug);
    assert.equal(config.schemaKey, slug, `${slug}: schemaKey mismatch`);
    assert.equal(getCategorySchema(slug).category, slug, `${slug}: schema.category mismatch`);
  }
});
