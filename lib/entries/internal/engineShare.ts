import "server-only";

import { randomUUID } from "node:crypto";
import { ENTRY_SCHEMAS } from "@/data/schemas";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getFacultyRecord, resolveFacultyName } from "@/lib/admin/facultyRegistry";
import { extractEntryTitle, notifySharedEntry } from "@/lib/confirmations/notificationHelpers";
import { buildEvent, inferWalUpdateAction } from "@/lib/data/wal";
import { withUserDataLock } from "@/lib/data/locks";
import { fireAndForget } from "@/lib/utils/fireAndForget";
import { logger } from "@/lib/logger";
import { createEntry } from "./engineWrite.ts";
import { listEntriesForCategory } from "./engineRead.ts";
import {
  type EntryEngineRecord,
  ensureRecord,
  readEntryRaw,
  upsertEntryRaw,
  appendWalEventOrThrow,
  refreshIndexForMutation,
  revalidateDashboardSummary,
} from "./engineHelpers.ts";

/**
 * Collaborative fan-out (2026-07, "each gets their own streak").
 *
 * When an ORIGIN entry is generated, every faculty named in the schema's
 * `collaborates` fields (coCoordinators / staffAccompanying / coParticipants)
 * receives their OWN prefilled DRAFT copy of the stage-1 data:
 *   - own id, own lifecycle, own PDF, own timer, own stage-2 uploads,
 *     own streak eligibility computed at their generate;
 *   - provenance recorded via `sharedEntryId` (origin id), `sourceEmail`
 *     (origin owner) and `sharedRole` (which field named them);
 *   - in the copy's collaborates field, the recipient is swapped out and the
 *     origin owner swapped in, so the copy reads truthfully from their side.
 *
 * Guards:
 *   - loop guard: copies (`sourceEmail` set) never fan out further;
 *   - duplicate guards: `sharedFanOutDone` on the origin + a per-target
 *     `sharedEntryId` scan, so regenerate/double-generate never double-copies;
 *   - registry guard: only active registry faculty receive copies;
 *   - isolation: one failed copy never affects the others or the commit.
 *
 * Locking: runs AFTER the origin owner's lock is released; each createEntry
 * acquires only the target's lock (no nested cross-user locks → no deadlock).
 */

type FacultyRowLike = { id?: unknown; name?: unknown; email?: unknown };

export type ShareSkipReason =
  | "not_in_registry"
  | "inactive"
  | "already_shared"
  | "create_failed"
  | "limit_reached";

export type ShareOutcome = {
  sharedWith: string[];
  skipped: Array<{ email: string; reason: ShareSkipReason }>;
};

/** Upper bound on copies from one entry — spam/typo protection. */
const MAX_SHARE_TARGETS = 10;

function rowsOf(value: unknown): FacultyRowLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is FacultyRowLike => !!row && typeof row === "object" && !Array.isArray(row),
  );
}

function emailOfRow(row: FacultyRowLike): string {
  return normalizeEmail(String(row.email ?? ""));
}

/** target email → the collaborates field that named them (first field wins). */
function collectShareTargets(
  category: CategoryKey,
  entry: Record<string, unknown>,
  originOwner: string,
): Map<string, string> {
  const targets = new Map<string, string>();
  const schema = ENTRY_SCHEMAS[category];
  for (const field of schema.fields) {
    if (!field.collaborates) continue;
    for (const row of rowsOf(entry[field.key])) {
      const email = emailOfRow(row);
      if (!email || email === originOwner || targets.has(email)) continue;
      targets.set(email, field.key);
    }
  }
  return targets;
}

/** The copy's collaborates rows: recipient out, origin owner in. */
function swapRowsForRecipient(
  rows: FacultyRowLike[],
  originOwner: string,
  ownerName: string,
  recipient: string,
): Array<{ id: string; name: string; email: string }> {
  const kept = rows
    .map((row) => ({ email: emailOfRow(row), name: String(row.name ?? "").trim() }))
    .filter((row) => row.email && row.email !== recipient)
    .map((row) => ({ id: randomUUID(), name: row.name, email: row.email }));

  if (!kept.some((row) => row.email === originOwner)) {
    kept.unshift({ id: randomUUID(), name: ownerName, email: originOwner });
  }
  return kept;
}

/** Stage-1 data fields only — never uploads, PDFs, timers, or streak state. */
function buildCopyPayload(
  category: CategoryKey,
  entry: Record<string, unknown>,
  originOwner: string,
  ownerName: string,
  recipient: string,
): Record<string, unknown> {
  const schema = ENTRY_SCHEMAS[category];
  const payload: Record<string, unknown> = {};

  for (const field of schema.fields) {
    if (field.key === "id") continue;
    if (field.upload || field.stage === 2) continue;
    if (field.exportable === false) continue; // pdfMeta, streak, system objects
    const value = entry[field.key];
    if (value === undefined) continue;

    if (field.collaborates) {
      payload[field.key] = swapRowsForRecipient(rowsOf(value), originOwner, ownerName, recipient);
    } else {
      payload[field.key] = structuredClone(value);
    }
  }

  return payload;
}

/** Record successful fan-outs on the origin entry (own lock, WAL-evented). */
async function markFanOutDone(
  originOwner: string,
  category: CategoryKey,
  originId: string,
  sharedWith: string[],
): Promise<void> {
  await withUserDataLock(originOwner, async () => {
    const existing = await readEntryRaw(originOwner, category, originId);
    if (!existing) return;

    const before = ensureRecord(existing);
    const done = new Set(
      Array.isArray(before.sharedFanOutDone)
        ? (before.sharedFanOutDone as unknown[]).map((v) => normalizeEmail(String(v ?? ""))).filter(Boolean)
        : [],
    );
    for (const email of sharedWith) done.add(email);

    const after = { ...before, sharedFanOutDone: [...done], updatedAt: new Date().toISOString() };

    await appendWalEventOrThrow(
      originOwner,
      buildEvent({
        actorEmail: originOwner,
        actorRole: "user",
        userEmail: originOwner,
        category,
        entryId: originId,
        action: inferWalUpdateAction(before as EntryEngineRecord, after as EntryEngineRecord),
        before: before as EntryEngineRecord,
        after: after as EntryEngineRecord,
      }),
    );
    await upsertEntryRaw(originOwner, category, after as EntryEngineRecord);
    // House rule (wiring audit): EVERY entry write refreshes the derived
    // stores — the flag itself is metadata, but the updatedAt bump must
    // reach the index/summary so "recent entries" ordering stays truthful.
    await refreshIndexForMutation(originOwner, category, before as EntryEngineRecord, after as EntryEngineRecord);
    revalidateDashboardSummary(originOwner);
  });
}

export async function shareEntryWithCollaborators(
  originOwner: string,
  category: CategoryKey,
  entry: EntryEngineRecord,
): Promise<ShareOutcome> {
  const outcome: ShareOutcome = { sharedWith: [], skipped: [] };
  const record = ensureRecord(entry);
  const owner = normalizeEmail(originOwner);

  // Loop guard: a shared copy never fans out again.
  if (typeof record.sourceEmail === "string" && record.sourceEmail.trim()) return outcome;

  const originId = String(record.id ?? "").trim();
  if (!originId) return outcome;

  const targets = collectShareTargets(category, record, owner);
  if (targets.size === 0) return outcome;

  const alreadyDone = new Set(
    Array.isArray(record.sharedFanOutDone)
      ? (record.sharedFanOutDone as unknown[]).map((v) => normalizeEmail(String(v ?? ""))).filter(Boolean)
      : [],
  );

  const ownerName = resolveFacultyName(owner) || owner.split("@")[0] || owner;
  const entryTitle = extractEntryTitle(record, category);
  let processed = 0;

  for (const [target, fieldKey] of targets) {
    if (alreadyDone.has(target)) continue;

    if (processed >= MAX_SHARE_TARGETS) {
      outcome.skipped.push({ email: target, reason: "limit_reached" });
      continue;
    }
    processed += 1;

    const faculty = getFacultyRecord(target);
    if (!faculty) {
      outcome.skipped.push({ email: target, reason: "not_in_registry" });
      continue;
    }
    if (faculty.status !== "active") {
      outcome.skipped.push({ email: target, reason: "inactive" });
      continue;
    }

    try {
      // Belt-and-braces duplicate guard on the recipient side.
      const existing = await listEntriesForCategory(target, category);
      const alreadyReceived = existing.some(
        (e) => String((e as Record<string, unknown>).sharedEntryId ?? "") === originId,
      );
      if (alreadyReceived) {
        outcome.skipped.push({ email: target, reason: "already_shared" });
        continue;
      }

      const payload = buildCopyPayload(category, record, owner, ownerName, target);
      payload.sharedEntryId = originId;
      payload.sourceEmail = owner;
      payload.sharedRole = fieldKey;

      await createEntry(target, category, payload as EntryEngineRecord);
      outcome.sharedWith.push(target);
      fireAndForget(notifySharedEntry(target, ownerName, entryTitle, category), "entry.share.notify");
    } catch (error) {
      logger.warn({
        event: "entry.share.copy_failed",
        userEmail: owner,
        targetEmail: target,
        category,
        entryId: originId,
        message: error instanceof Error ? error.message : String(error),
      });
      outcome.skipped.push({ email: target, reason: "create_failed" });
    }
  }

  if (outcome.sharedWith.length > 0) {
    try {
      await markFanOutDone(owner, category, originId, outcome.sharedWith);
    } catch (error) {
      // Non-fatal: the recipient-side sharedEntryId guard still prevents
      // duplicates on a future regenerate.
      logger.warn({
        event: "entry.share.mark_failed",
        userEmail: owner,
        category,
        entryId: originId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info({
    event: "entry.share.fanout",
    userEmail: owner,
    category,
    entryId: originId,
    shared: outcome.sharedWith.length,
    skipped: outcome.skipped.length,
  });
  return outcome;
}
