// ---------------------------------------------------------------------------
// Notification generation helpers — fire-and-forget, never blocks primary ops
// ---------------------------------------------------------------------------

import { addNotification } from "./notificationStore";
import type { PersistentNotificationType } from "./types";

/**
 * Extract a human-readable title from an entry record.
 * Entries use different field names depending on category.
 */
export function extractEntryTitle(entry: Record<string, unknown>): string {
  const title =
    (entry.programName as string) ??
    (entry.eventName as string) ??
    (entry.topicTitle as string) ??
    (entry.caseTitle as string) ??
    (entry.id as string) ??
    "Untitled";
  return String(title).slice(0, 100);
}

/**
 * Fire-and-forget notification creation. Logs errors but never throws.
 */
export async function notifyUser(
  email: string,
  type: PersistentNotificationType,
  title: string,
  message: string,
  actionUrl?: string,
): Promise<void> {
  try {
    await addNotification(email, { type, title, message, actionUrl });
  } catch {
    // Never block the primary operation
  }
}

/**
 * Notify user that edit access was granted.
 */
export async function notifyEditGranted(
  ownerEmail: string,
  entryTitle: string,
  editWindowDays?: number,
): Promise<void> {
  const timeMsg = editWindowDays ? ` — ${editWindowDays} days to edit` : "";
  await notifyUser(
    ownerEmail,
    "edit_request_granted",
    "Edit access granted",
    `Edit access granted for '${entryTitle}'${timeMsg}`,
  );
}

/**
 * Notify user that edit request was rejected.
 */
export async function notifyEditRejected(
  ownerEmail: string,
  entryTitle: string,
  reason?: string,
): Promise<void> {
  const reasonMsg = reason ? ` — ${reason}` : "";
  await notifyUser(
    ownerEmail,
    "edit_request_rejected",
    "Edit request denied",
    `Edit request denied for '${entryTitle}'${reasonMsg}`,
  );
}

/**
 * Notify user that entry was finalized.
 */
export async function notifyEntryFinalized(
  ownerEmail: string,
  entryTitle: string,
): Promise<void> {
  await notifyUser(
    ownerEmail,
    "entry_finalized",
    "Entry finalized",
    `Your entry '${entryTitle}' has been finalized`,
  );
}

/**
 * Notify user of streak win.
 */
export async function notifyStreakWon(
  ownerEmail: string,
  entryTitle: string,
): Promise<void> {
  await notifyUser(
    ownerEmail,
    "streak_won",
    "Streak completed!",
    `Streak completed! '${entryTitle}' is fully done`,
  );
}
