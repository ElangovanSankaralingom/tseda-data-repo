import "server-only";

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError, normalizeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";
import { getBackupRetention } from "@/lib/settings/consumer";
import { getDataRoot } from "@/lib/userStore";
import { APP_CONFIG } from "@/lib/config/appConfig";

export const BACKUP_KEEP_LAST_DEFAULT = APP_CONFIG.cron.backupKeepLast;

type BackupFileInfo = {
  filename: string;
  filePath: string;
  createdAt: string;
  sizeBytes: number;
  mtimeMs: number;
};

type BackupEntry = {
  zipPath: string;
  data: Buffer;
};

export type BackupListItem = {
  filename: string;
  createdAt: string;
  sizeBytes: number;
};

export type BackupCreateResult = {
  filePath: string;
  filename: string;
  sizeBytes: number;
};

export type BackupStreamResult = {
  filename: string;
  sizeBytes: number;
  buffer: Buffer;
};

function getBackupRoot() {
  const override = process.env.DATA_BACKUP_ROOT?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), ".data_backups");
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index] ?? 0;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries: BackupEntry[]) {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.zipPath, "utf8");
    const dataBuffer = entry.data;
    const checksum = crc32(dataBuffer);
    const size = dataBuffer.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralChunks.push(centralHeader, nameBuffer);
    localOffset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const localData = Buffer.concat(localChunks);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, end]);
}

function timestampSlug(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function sanitizeBackupFilename(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Backup filename is required.",
    });
  }

  const base = path.basename(trimmed);
  if (base !== trimmed || !/^backup-\d{8}-\d{6}(?:-[a-z0-9_-]+)?\.zip$/i.test(base)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid backup filename.",
    });
  }

  return base;
}

async function listBackupFilesInternal(): Promise<BackupFileInfo[]> {
  const backupsRoot = getBackupRoot();
  let dirEntries: Dirent[] = [];
  try {
    dirEntries = await fs.readdir(backupsRoot, { withFileTypes: true });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") return [];
    throw error;
  }

  const files = new Array<BackupFileInfo>();
  for (const entry of dirEntries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".zip")) continue;

    const filePath = path.join(/*turbopackIgnore: true*/ backupsRoot, entry.name);
    const stats = await fs.stat(/*turbopackIgnore: true*/ filePath);
    files.push({
      filename: entry.name,
      filePath,
      createdAt: stats.mtime.toISOString(),
      sizeBytes: stats.size,
      mtimeMs: stats.mtimeMs,
    });
  }

  files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return files;
}

async function collectDataFileEntries(rootDir: string): Promise<BackupEntry[]> {
  const entries: BackupEntry[] = [];

  async function walk(currentDir: string) {
    const children = await fs.readdir(currentDir, { withFileTypes: true });
    for (const child of children) {
      const absPath = path.join(currentDir, child.name);
      if (child.isDirectory()) {
        await walk(absPath);
        continue;
      }
      if (!child.isFile()) continue;

      const relative = path.relative(rootDir, absPath).replaceAll(path.sep, "/");
      const zipPath = `.data/${relative}`;
      const data = await fs.readFile(absPath);
      entries.push({ zipPath, data });
    }
  }

  try {
    await walk(rootDir);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }

  entries.sort((left, right) => left.zipPath.localeCompare(right.zipPath));
  return entries;
}

async function buildDataBackupBuffer(): Promise<Buffer> {
  const dataRoot = path.resolve(getDataRoot());
  const entries = await collectDataFileEntries(dataRoot);
  return buildZip(entries);
}

export async function cleanupOldBackups(options?: {
  keepLastN?: number;
}): Promise<Result<void>> {
  try {
    const keepLastN = Number.isFinite(options?.keepLastN)
      ? Math.max(1, Number(options?.keepLastN))
      : BACKUP_KEEP_LAST_DEFAULT;
    const files = await listBackupFilesInternal();
    const stale = files.slice(keepLastN);
    for (const file of stale) {
      await fs.unlink(file.filePath);
    }

    if (stale.length > 0) {
      logger.info({
        event: "backup.cleanup",
        count: stale.length,
        keepLastN,
      });
    }
    return ok(undefined);
  } catch (error) {
    return err(normalizeError(error));
  }
}

export async function listBackups(): Promise<Result<BackupListItem[]>> {
  try {
    const files = await listBackupFilesInternal();
    return ok(
      files.map((file) => ({
        filename: file.filename,
        createdAt: file.createdAt,
        sizeBytes: file.sizeBytes,
      }))
    );
  } catch (error) {
    return err(normalizeError(error));
  }
}

/**
 * Parse our STORED (uncompressed, method 0) zip and CRC-verify every entry.
 * Throws on a truncated archive or any CRC mismatch — the gate that makes a
 * backup trustworthy before we overwrite live data with it.
 */
function parseAndVerifyStoredZip(buffer: Buffer): BackupEntry[] {
  const entries: BackupEntry[] = [];
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    if (offset + 30 > buffer.length) throw new AppError({ code: "VALIDATION_ERROR", message: "Corrupt backup: truncated local header." });
    const method = buffer.readUInt16LE(offset + 8);
    const storedCrc = buffer.readUInt32LE(offset + 14);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (method !== 0) throw new AppError({ code: "VALIDATION_ERROR", message: "Unsupported backup: only stored entries are restorable." });
    if (dataEnd > buffer.length) throw new AppError({ code: "VALIDATION_ERROR", message: "Corrupt backup: truncated entry data." });
    const zipPath = buffer.toString("utf8", nameStart, nameStart + nameLen);
    const data = buffer.subarray(dataStart, dataEnd);
    if (data.length !== uncompressedSize || crc32(data) !== storedCrc) {
      throw new AppError({ code: "VALIDATION_ERROR", message: `Corrupt backup: CRC mismatch for ${zipPath}.` });
    }
    entries.push({ zipPath, data: Buffer.from(data) });
    offset = dataEnd;
  }
  if (entries.length === 0) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Corrupt or empty backup: no valid entries." });
  }
  return entries;
}

async function verifyBackupZip(filePath: string): Promise<boolean> {
  try {
    const buffer = await fs.readFile(/*turbopackIgnore: true*/ filePath);
    parseAndVerifyStoredZip(buffer);
    return true;
  } catch {
    return false;
  }
}

export type BackupRestoreResult = {
  filename: string;
  filesRestored: number;
  previousDataMovedTo: string;
};

/**
 * S1 (TECH-AUDIT-2026-06): the restore counterpart to createBackupZip, which
 * previously did not exist anywhere. CRC-verifies the archive, extracts to a
 * fresh temp dir, then atomically swaps it in — the current data root is moved
 * aside (not deleted) so a failed restore is itself recoverable.
 *
 * Zip paths are stored as ".data/<relative>"; we restore them under the live
 * data root regardless of its configured name.
 */
export async function restoreBackup(filename: string): Promise<Result<BackupRestoreResult>> {
  try {
    const safeName = sanitizeBackupFilename(filename);
    const filePath = path.join(/*turbopackIgnore: true*/ getBackupRoot(), safeName);
    const buffer = await fs.readFile(/*turbopackIgnore: true*/ filePath);
    const entries = parseAndVerifyStoredZip(buffer); // throws on corruption/CRC

    const dataRoot = path.resolve(getDataRoot());
    const parent = path.dirname(dataRoot);
    const baseName = path.basename(dataRoot);
    const stagingDir = path.join(parent, `${baseName}.restore-${Date.now()}`);
    await fs.rm(stagingDir, { recursive: true, force: true });
    await fs.mkdir(stagingDir, { recursive: true });

    for (const entry of entries) {
      // Strip the leading ".data/" namespace; guard against traversal.
      const rel = entry.zipPath.replace(/^\.data\//, "");
      if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: `Unsafe path in backup: ${entry.zipPath}` });
      }
      const dest = path.join(stagingDir, rel);
      if (!path.resolve(dest).startsWith(path.resolve(stagingDir) + path.sep)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: `Unsafe path in backup: ${entry.zipPath}` });
      }
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, entry.data);
    }

    // Atomic-ish swap: move current data aside, move staging in.
    const movedAside = path.join(parent, `${baseName}.pre-restore-${Date.now()}`);
    try {
      await fs.rename(dataRoot, movedAside);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== "ENOENT") throw error; // ENOENT: no existing data root, fine
    }
    try {
      await fs.rename(stagingDir, dataRoot);
    } catch (error) {
      // Roll back the move-aside so we never leave the app dataless.
      await fs.rename(movedAside, dataRoot).catch(() => {});
      throw error;
    }

    logger.info({ event: "backup.restore", filename: safeName, filesRestored: entries.length, previousDataMovedTo: movedAside });
    return ok({ filename: safeName, filesRestored: entries.length, previousDataMovedTo: movedAside });
  } catch (error) {
    return err(normalizeError(error));
  }
}

export async function createBackupZip(): Promise<Result<BackupCreateResult>> {
  try {
    const startedAt = Date.now();
    const backupsRoot = getBackupRoot();
    await fs.mkdir(backupsRoot, { recursive: true });

    const slug = timestampSlug();
    let filename = `backup-${slug}.zip`;
    let filePath = path.join(/*turbopackIgnore: true*/ backupsRoot, filename);

    try {
      await fs.access(filePath);
      filename = `backup-${slug}-${Date.now()}.zip`;
      filePath = path.join(/*turbopackIgnore: true*/ backupsRoot, filename);
    } catch {
      // File does not exist, use default name.
    }

    const buffer = await buildDataBackupBuffer();
    await fs.writeFile(filePath, buffer);

    const isValid = await verifyBackupZip(filePath);
    if (!isValid) {
      logger.warn({ event: "backup.verify.failed", filePath });
    }

    let retention: number = BACKUP_KEEP_LAST_DEFAULT;
    try { retention = await getBackupRetention(); } catch { /* use default */ }
    const cleanupResult = await cleanupOldBackups({
      keepLastN: retention,
    });
    if (!cleanupResult.ok) {
      throw cleanupResult.error;
    }

    logger.info({
      event: "backup.create",
      filename,
      sizeBytes: buffer.length,
      durationMs: Date.now() - startedAt,
    });
    return ok({
      filePath,
      filename,
      sizeBytes: buffer.length,
    });
  } catch (error) {
    return err(normalizeError(error));
  }
}

export async function streamBackupZip(): Promise<Result<BackupStreamResult>> {
  try {
    const startedAt = Date.now();
    const filename = `backup-${timestampSlug()}.zip`;
    const buffer = await buildDataBackupBuffer();
    logger.info({
      event: "backup.stream",
      filename,
      sizeBytes: buffer.length,
      durationMs: Date.now() - startedAt,
    });
    return ok({
      filename,
      sizeBytes: buffer.length,
      buffer,
    });
  } catch (error) {
    return err(normalizeError(error));
  }
}

export async function readBackupFile(
  filename: string
): Promise<Result<BackupStreamResult>> {
  try {
    const safeName = sanitizeBackupFilename(filename);
    const filePath = path.join(/*turbopackIgnore: true*/ getBackupRoot(), safeName);
    const stats = await fs.stat(/*turbopackIgnore: true*/ filePath);
    if (!stats.isFile()) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Backup file not found.",
      });
    }

    const buffer = await fs.readFile(/*turbopackIgnore: true*/ filePath);
    return ok({
      filename: safeName,
      sizeBytes: buffer.length,
      buffer,
    });
  } catch (error) {
    return err(normalizeError(error));
  }
}

export async function getLatestBackupFile(): Promise<Result<BackupListItem | null>> {
  try {
    const files = await listBackupFilesInternal();
    if (files.length === 0) {
      return ok(null);
    }
    const latest = files[0];
    if (!latest) return ok(null);
    return ok({
      filename: latest.filename,
      createdAt: latest.createdAt,
      sizeBytes: latest.sizeBytes,
    });
  } catch (error) {
    return err(normalizeError(error));
  }
}
