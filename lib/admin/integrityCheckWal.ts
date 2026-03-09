import "server-only";

/**
 * WAL-level integrity checks: compareWalEventTime and checkWalIntegrity.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { type WalEvent } from "@/lib/data/wal";
import { migrateWalEvent } from "@/lib/migrations";
import { getUserStoreDir } from "@/lib/userStore";
import {
  WAL_FILE_NAME,
  toIssue,
  type IntegrityIssue,
  type WalIntegrityReport,
} from "./integrityTypes";

// ---------------------------------------------------------------------------
// compareWalEventTime
// ---------------------------------------------------------------------------

export function compareWalEventTime(left: WalEvent, right: WalEvent) {
  const leftTime = Date.parse(left.ts);
  const rightTime = Date.parse(right.ts);
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return -1;
  if (Number.isNaN(rightTime)) return 1;
  return leftTime - rightTime;
}

// ---------------------------------------------------------------------------
// checkWalIntegrity
// ---------------------------------------------------------------------------

export async function checkWalIntegrity(userEmail: string): Promise<WalIntegrityReport> {
  const filePath = path.join(getUserStoreDir(userEmail), WAL_FILE_NAME);
  const issues = new Array<IntegrityIssue>();

  let exists = true;
  let rawText = "";
  try {
    rawText = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      exists = false;
      issues.push(
        toIssue({
          code: "WAL_FILE_MISSING",
          severity: "info",
          message: "events.log is missing.",
          fixAvailable: false,
        })
      );
      return {
        filePath,
        exists,
        validLines: 0,
        invalidLines: 0,
        outOfOrderLines: 0,
        issues,
      };
    }
    issues.push(
      toIssue({
        code: "WAL_READ_FAILED",
        severity: "error",
        message: "Failed to read events.log.",
        fixAvailable: false,
      })
    );
    return {
      filePath,
      exists,
      validLines: 0,
      invalidLines: 0,
      outOfOrderLines: 0,
      issues,
    };
  }

  let invalidLines = 0;
  const validEvents = new Array<WalEvent>();
  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const migrated = migrateWalEvent(parsed);
      if (!migrated.ok) {
        invalidLines += 1;
        continue;
      }
      validEvents.push(migrated.data);
    } catch {
      invalidLines += 1;
    }
  }

  if (invalidLines > 0) {
    issues.push(
      toIssue({
        code: "WAL_INVALID_LINES",
        severity: "warn",
        message: `events.log contains ${invalidLines} invalid lines.`,
        fixAvailable: false,
      })
    );
  }

  const sorted = validEvents.slice().sort(compareWalEventTime);
  let outOfOrderLines = 0;
  for (let index = 0; index < validEvents.length; index += 1) {
    const original = validEvents[index];
    const reordered = sorted[index];
    if (!original || !reordered) continue;
    if (original.ts !== reordered.ts) {
      outOfOrderLines += 1;
    }
  }

  if (outOfOrderLines > 0) {
    issues.push(
      toIssue({
        code: "WAL_OUT_OF_ORDER",
        severity: "info",
        message: `events.log has ${outOfOrderLines} out-of-order timestamps.`,
        fixAvailable: false,
      })
    );
  }

  return {
    filePath,
    exists,
    validLines: validEvents.length,
    invalidLines,
    outOfOrderLines,
    issues,
  };
}
