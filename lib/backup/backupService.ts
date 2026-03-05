import "server-only";

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError, normalizeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";
import { getDataRoot } from "@/lib/userStore";

export const BACKUP_KEEP_LAST_DEFAULT = 30;

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

    const filePath = path.join(backupsRoot, entry.name);
    const stats = await fs.stat(filePath);
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

export async function createBackupZip(): Promise<Result<BackupCreateResult>> {
  try {
    const startedAt = Date.now();
    const backupsRoot = getBackupRoot();
    await fs.mkdir(backupsRoot, { recursive: true });

    const slug = timestampSlug();
    let filename = `backup-${slug}.zip`;
    let filePath = path.join(backupsRoot, filename);

    try {
      await fs.access(filePath);
      filename = `backup-${slug}-${Date.now()}.zip`;
      filePath = path.join(backupsRoot, filename);
    } catch {
      // File does not exist, use default name.
    }

    const buffer = await buildDataBackupBuffer();
    await fs.writeFile(filePath, buffer);

    const cleanupResult = await cleanupOldBackups({
      keepLastN: BACKUP_KEEP_LAST_DEFAULT,
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
    const filePath = path.join(getBackupRoot(), safeName);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Backup file not found.",
      });
    }

    const buffer = await fs.readFile(filePath);
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
