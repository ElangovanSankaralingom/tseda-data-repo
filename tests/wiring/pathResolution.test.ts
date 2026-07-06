import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { getDataRoot, getUniverseDataRoot, getUsersRootDir, getUserStoreDir } from "../../lib/userStore.ts";

/**
 * PATH-RESOLUTION GUARDS (2026-07, after the Pulse backfill bug):
 * getUsersRootDir()/getUserStoreDir() ALREADY prefix process.cwd(). Wrapping
 * them in another join(cwd, …) produced a doubled path — the backfill swept
 * a nonexistent directory, found zero users, and marked the universe as
 * done. These guards make that whole bug class unrepresentable:
 *  1. semantic: the helpers' absolute/relative contracts hold;
 *  2. static: no source file re-prefixes a self-prefixing helper.
 */

test("path helper contracts: users root absolute, data roots relative-or-env", () => {
  assert.ok(path.isAbsolute(getUsersRootDir()), "getUsersRootDir must be absolute (it joins cwd itself)");
  assert.ok(
    getUserStoreDir("someone@tce.edu").startsWith(getUsersRootDir()),
    "getUserStoreDir must live under getUsersRootDir",
  );
  // getDataRoot/getUniverseDataRoot pass DATA_ROOT through (the test harness
  // sets it absolute); WITHOUT the env override they must stay relative so
  // join(cwd, …) call sites resolve correctly.
  const saved = process.env.DATA_ROOT;
  delete process.env.DATA_ROOT;
  try {
    assert.equal(path.isAbsolute(getDataRoot()), false, "default getDataRoot must be relative");
    assert.equal(path.isAbsolute(getUniverseDataRoot()), false, "default getUniverseDataRoot must be relative");
  } finally {
    if (saved !== undefined) process.env.DATA_ROOT = saved;
  }
});

const SELF_PREFIXING = ["getUsersRootDir", "getUserStoreDir", "getUserCategoryStoreFile", "privateDataRoot", "universePrivateDataRoot"];

function walkSources(dir: string, out: string[]): void {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "node_modules" || item.name.startsWith(".")) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walkSources(full, out);
    else if (/\.(ts|tsx)$/.test(item.name)) out.push(full);
  }
}

test("no source file re-prefixes a self-prefixing path helper", () => {
  const root = process.cwd();
  const files: string[] = [];
  for (const top of ["lib", "app", "components", "hooks", "data"]) {
    const dir = path.join(root, top);
    if (fs.existsSync(dir)) walkSources(dir, files);
  }
  assert.ok(files.length > 100, "source scan must actually see the codebase");

  const offenders: string[] = [];
  const pattern = new RegExp(
    `path\\.(?:join|resolve)\\(\\s*process\\.cwd\\(\\)\\s*,\\s*(?:${SELF_PREFIXING.join("|")})\\s*\\(`,
  );
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (pattern.test(source)) offenders.push(path.relative(root, file));
  }
  assert.deepEqual(offenders, [], `these files double-prefix an absolute path helper: ${offenders.join(", ")}`);
});
