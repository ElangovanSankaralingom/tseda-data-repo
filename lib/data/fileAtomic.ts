import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export async function atomicWriteTextFile(
  filePath: string,
  payload: string
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${randomUUID()}`;

  /* S1 durability: write + fsync the temp file BEFORE the rename, then fsync
     the directory so the rename itself survives a crash. Without this, a
     power loss after rename can leave a zero-length or stale file —
     unacceptable for the entry store. */
  const handle = await fs.open(tmpPath, "w");
  try {
    await handle.writeFile(payload, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmpPath, filePath);
  try {
    const dirHandle = await fs.open(path.dirname(filePath), "r");
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    /* Directory fsync is unsupported on some platforms (e.g. Windows) —
       file-level fsync above still holds. */
  }
}

/**
 * Synchronous mirror of atomicWriteTextFile — for the fully-synchronous
 * config stores (faculty registry, roles, coordinators, action history,
 * preferences, export templates). Their read-modify-write is race-safe on
 * Node's single thread PRECISELY BECAUSE it never yields; an async write
 * would open an interleaving window, so the atomic write must be sync too.
 * Same crash-safety contract: temp file + fsync + rename (+ dir fsync).
 */
export function atomicWriteTextFileSync(filePath: string, payload: string): void {
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${randomUUID()}`;
  const fd = fsSync.openSync(tmpPath, "w");
  try {
    fsSync.writeSync(fd, payload, null, "utf8");
    fsSync.fsyncSync(fd);
  } finally {
    fsSync.closeSync(fd);
  }
  fsSync.renameSync(tmpPath, filePath);
  try {
    const dirFd = fsSync.openSync(path.dirname(filePath), "r");
    try {
      fsSync.fsyncSync(dirFd);
    } finally {
      fsSync.closeSync(dirFd);
    }
  } catch {
    /* Directory fsync unsupported on some platforms — file fsync holds. */
  }
}
