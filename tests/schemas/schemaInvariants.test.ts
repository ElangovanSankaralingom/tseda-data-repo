import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CATEGORY_LIST,
  CATEGORY_REGISTRY,
  getCategorySchema,
} from "../../data/categoryRegistry.ts";
import { ENTRY_SCHEMAS } from "../../data/schemas/index.ts";

/**
 * EXPANSION GUARD (2026-07): structural invariants every category must obey.
 *
 * These tests make the architecture self-checking: a future category (added
 * by anyone — human or AI — via scripts/add-category.sh) that violates the
 * two-stage model, the collaboration contract, or the registry wiring fails
 * the suite with a named reason instead of silently drifting.
 */

const SYSTEM_OBJECT_FIELDS = ["pdfMeta", "streak"];

test("registry ↔ schemas parity: every category registered exactly once", () => {
  const registryKeys = [...CATEGORY_LIST].sort();
  const schemaKeys = Object.keys(ENTRY_SCHEMAS).sort();
  assert.deepEqual(schemaKeys, registryKeys, "ENTRY_SCHEMAS must cover exactly the registered categories");
  assert.equal(new Set(registryKeys).size, registryKeys.length, "duplicate category slugs");
});

for (const slug of CATEGORY_LIST) {
  test(`schema invariants: ${slug}`, () => {
    const schema = getCategorySchema(slug);
    const config = CATEGORY_REGISTRY[slug];
    const keys = schema.fields.map((f) => f.key);
    const keySet = new Set(keys);

    // Identity
    assert.equal(schema.category, slug, "schema.category must equal its registry slug");
    assert.equal(config.slug, slug, "registry entry slug must equal its key");
    assert.equal(keySet.size, keys.length, "duplicate field keys in schema");

    // System fields every entry carries
    const idField = schema.fields.find((f) => f.key === "id");
    assert.ok(idField?.required && idField.exportable === false, "id field must be required + exportable:false");
    for (const sys of SYSTEM_OBJECT_FIELDS) {
      const field = schema.fields.find((f) => f.key === sys);
      assert.ok(field && field.kind === "object" && field.exportable === false,
        `${sys} must exist as kind:"object", exportable:false`);
    }

    // Two-stage model: uploads are ALWAYS multi-file stage-2 arrays
    for (const field of schema.fields) {
      if (field.upload) {
        assert.equal(field.kind, "array", `${slug}.${field.key}: upload fields must be kind:"array" (FileMeta[])`);
        assert.equal(field.stage, 2, `${slug}.${field.key}: upload fields must be stage: 2`);
      }
      if (field.stage === 2 && !field.upload) {
        assert.equal(field.upload ?? false, false); // stage-2 non-upload fields are allowed (e.g. numberOfParticipants)
      }
    }

    // Collaboration contract: fan-out fields are faculty-row arrays and
    // locked after generate (immutableWhenPending) so collaborator lists
    // can't change without an edit grant.
    for (const field of schema.fields) {
      if (field.collaborates) {
        assert.equal(field.kind, "array", `${slug}.${field.key}: collaborates fields must be kind:"array"`);
        assert.notEqual(field.stage, 2, `${slug}.${field.key}: collaborates fields are stage-1 data`);
        assert.equal(field.upload ?? false, false, `${slug}.${field.key}: collaborates fields cannot be uploads`);
        assert.ok(
          (schema.immutableWhenPending ?? []).includes(field.key),
          `${slug}.${field.key}: collaborates fields must be in immutableWhenPending`,
        );
      }
    }

    // Referential integrity of schema lists
    for (const key of schema.requiredForCommit ?? []) {
      assert.ok(keySet.has(key), `${slug}: requiredForCommit references unknown field "${key}"`);
    }
    for (const key of schema.immutableWhenPending ?? []) {
      assert.ok(keySet.has(key), `${slug}: immutableWhenPending references unknown field "${key}"`);
    }

    // Titles: notifications, quarantine manifests, and action history all
    // derive from entryTitleField — it must point at a real schema field.
    if (config.entryTitleField) {
      assert.ok(
        keySet.has(config.entryTitleField),
        `${slug}: entryTitleField "${config.entryTitleField}" is not a schema field ` +
          "(stale registry pointer — titles would silently fall back)",
      );
    }
  });
}

test("wiring: every category has an API route and a router mapping", () => {
  const routerSource = readFileSync(
    path.join(process.cwd(), "components", "data-entry", "CategoryPageRouter.tsx"),
    "utf8",
  );
  for (const slug of CATEGORY_LIST) {
    assert.ok(
      existsSync(path.join(process.cwd(), "app", "api", "me", slug, "route.ts")),
      `${slug}: missing app/api/me/${slug}/route.ts`,
    );
    assert.ok(
      routerSource.includes(`"${slug}"`) ||
        routerSource.includes(`'${slug}'`) ||
        routerSource.includes(`${slug}:`), // hyphen-free slugs are unquoted keys
      `${slug}: not mapped in CategoryPageRouter.tsx`,
    );
  }
});

test("wiring: every category has a PROPER display name in BOTH dictionaries", async () => {
  // A missing category.<slug> key makes the UI fall back to the raw slug
  // ("journal-publications" instead of "Journal Publications") — caught in
  // the wild 2026-07; never again.
  const { categoryLabel } = await import("@/lib/i18n");
  for (const slug of CATEGORY_LIST) {
    for (const language of ["en", "ta"] as const) {
      const label = categoryLabel(slug, language);
      assert.notEqual(label, slug, `${slug}: missing category.* key in ${language} dictionary`);
      assert.ok(label.trim().length > 0, `${slug}: empty display name in ${language}`);
    }
  }
});
