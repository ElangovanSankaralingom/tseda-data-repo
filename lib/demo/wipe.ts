import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataRoot, safeEmailDir } from "@/lib/userStore";
import { privateDataRoot } from "@/lib/config/storagePaths";
import { DEMO_SEGMENT } from "@/lib/demo/universe";
import { logger } from "@/lib/logger";

/**
 * DEMO MODE — guarded deletion.
 *
 * Every path removed by this module MUST sit inside a `/demo/` segment under
 * one of the two known storage roots. `assertDemoPath` enforces this
 * mechanically so no refactor can ever point a wipe at real data — the guard
 * throws before `rm` runs. Covered by tests/demo/demoMode.test.ts.
 */

function demoDataRoot(): string {
  return path.join(process.cwd(), getDataRoot(), DEMO_SEGMENT);
}

function demoPrivateRoot(): string {
  return path.join(privateDataRoot(), DEMO_SEGMENT);
}

/** Throws unless `target` is the demo dir itself or strictly inside it,
 *  under one of the two storage roots. */
export function assertDemoPath(target: string): void {
  const resolved = path.resolve(target);
  const allowedRoots = [path.resolve(demoDataRoot()), path.resolve(demoPrivateRoot())];
  const ok = allowedRoots.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep),
  );
  if (!ok) {
    throw new Error(`Refusing to wipe non-demo path: ${resolved}`);
  }
  const segments = resolved.split(path.sep);
  if (!segments.includes(DEMO_SEGMENT)) {
    throw new Error(`Refusing to wipe path without a demo segment: ${resolved}`);
  }
}

async function removeDemoDir(target: string): Promise<void> {
  assertDemoPath(target);
  await fs.rm(target, { recursive: true, force: true });
}

/** Wipe one user's demo data: their demo users subtree (entries, index,
 *  summary, notifications) and their demo entry uploads (files + PDFs).
 *  Shared demo stores (feed, trash, history, caches) are cleared by the full
 *  wipe when the last participant leaves, and by the nightly sweep. */
export async function wipeOwnDemoData(email: string): Promise<void> {
  const dir = safeEmailDir(email);
  await removeDemoDir(path.join(demoDataRoot(), "users", dir));
  await removeDemoDir(path.join(demoPrivateRoot(), "entry-uploads", dir));
  logger.info({ event: "demo.wipe.user", email });
}

/** Wipe the ENTIRE demo universe under both storage roots. */
export async function wipeDemoUniverse(): Promise<void> {
  await removeDemoDir(demoDataRoot());
  await removeDemoDir(demoPrivateRoot());
  logger.info({ event: "demo.wipe.universe" });
}

/** Owner dirs currently present in the demo users tree (nightly sweep). */
export async function listDemoUserDirs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(demoDataRoot(), "users"), {
      withFileTypes: true,
    });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
