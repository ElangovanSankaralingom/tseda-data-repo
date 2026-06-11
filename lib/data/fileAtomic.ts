import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
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
