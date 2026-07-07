import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * PATH-BOUNDARY GUARDS (2026-07 security pass, CWE-22).
 *
 * Two properties, verified as pure logic + a source tripwire:
 *  1. the boundary predicate the file routes now share accepts paths inside
 *     the root and rejects sibling-prefix escapes (…/alice vs …/alice2) and
 *     parent traversal;
 *  2. no file-serving route uses the old blocklist strip `.replace(/\.\./)`
 *     as its ONLY defense, and every startsWith boundary carries `path.sep`.
 */

/** The predicate every hardened route now applies (resolve + sep boundary). */
function isInside(root: string, candidate: string): boolean {
  const base = path.resolve(root);
  const resolved = path.resolve(base, candidate);
  return resolved === base || resolved.startsWith(base + path.sep);
}

test("boundary predicate: inside allowed, escapes rejected", () => {
  const root = "/srv/uploads/alice@tce.edu";
  assert.equal(isInside(root, "letter.pdf"), true);
  assert.equal(isInside(root, "sub/dir/proof.pdf"), true);
  assert.equal(isInside(root, "."), true);
  // Parent traversal.
  assert.equal(isInside(root, "../bob@tce.edu/secret.pdf"), false);
  assert.equal(isInside(root, "../../etc/passwd"), false);
  // Absolute path escape.
  assert.equal(isInside(root, "/etc/passwd"), false);
  // Sibling-prefix collision — the bug the missing path.sep allowed.
  assert.equal(isInside("/srv/uploads/alice", "../alice2/x"), false);
});

test("tripwire: file routes assert a sep boundary, not a bare .. strip", () => {
  const routes = [
    "app/api/file/route.ts",
    "app/api/me/file/download/route.ts",
    "app/api/me/avatar/route.ts",
    "app/api/me/certificate/route.ts",
  ];
  for (const rel of routes) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    // Must NOT rely on the blocklist strip as a traversal defense.
    assert.ok(
      !/\.replace\(\/\\\.\\\.\/g/.test(src),
      `${rel}: uses the .. blocklist strip — replace with a resolve+sep boundary`,
    );
    // Every path-boundary startsWith in a file route must carry path.sep.
    // (Line-level check — nested parens make a balanced capture fragile.)
    for (const line of src.split("\n")) {
      if (!/\.startsWith\(/.test(line)) continue;
      if (!/\b(base|root|resolved)\b/i.test(line)) continue;
      assert.ok(
        line.includes("path.sep"),
        `${rel}: boundary startsWith missing path.sep → ${line.trim()}`,
      );
    }
  }
});
