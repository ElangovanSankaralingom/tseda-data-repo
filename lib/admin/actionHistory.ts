import "server-only";
import { atomicWriteTextFileSync } from "@/lib/data/fileAtomic";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getUniverseDataRoot } from "@/lib/userStore";

// Universe-aware: admin actions taken in demo mode never pollute the real
// action history (and demo history is wiped with the demo universe).
function getHistoryFilePath(): string {
  return path.join(process.cwd(), getUniverseDataRoot(), "admin", "action-history.json");
}

export type ActionType =
  | "edit_granted"
  | "edit_rejected"
  | "delete_approved"
  | "delete_rejected"
  | "user_cancelled"
  | "auto_finalised"
  | "auto_deleted";

export interface ActionHistoryRecord {
  id: string;
  timestamp: string;
  actionType: ActionType;
  entryId: string;
  category: string;
  entryTitle: string;
  userEmail: string;
  userName: string;
  adminEmail?: string;
  requestMessage?: string;
}

interface HistoryFile {
  records: ActionHistoryRecord[];
}

function ensureFile(): string {
  const filePath = getHistoryFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    atomicWriteTextFileSync(filePath, JSON.stringify({ records: [] }, null, 2));
  }
  return filePath;
}

function readHistory(): HistoryFile {
  const filePath = ensureFile();
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as HistoryFile;
}

function writeHistory(data: HistoryFile): void {
  const filePath = ensureFile();
  atomicWriteTextFileSync(filePath, JSON.stringify(data, null, 2));
}

export function appendActionHistory(
  record: Omit<ActionHistoryRecord, "id" | "timestamp">
): ActionHistoryRecord {
  const history = readHistory();
  const newRecord: ActionHistoryRecord = {
    ...record,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  history.records.unshift(newRecord);
  writeHistory(history);
  return newRecord;
}

export function getActionHistory(opts?: {
  page?: number;
  pageSize?: number;
  actionType?: ActionType;
  category?: string;
  /** Viewer scope: when set, only records in these categories are visible. */
  allowedCategories?: string[];
}): {
  records: ActionHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
} {
  const history = readHistory();
  let filtered = history.records;

  if (opts?.actionType) {
    filtered = filtered.filter((r) => r.actionType === opts.actionType);
  }
  if (opts?.category) {
    filtered = filtered.filter((r) => r.category === opts.category);
  }
  if (opts?.allowedCategories) {
    const allowed = new Set(opts.allowedCategories);
    filtered = filtered.filter((r) => allowed.has(r.category));
  }

  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 20;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return { records: paged, total: filtered.length, page, pageSize };
}
