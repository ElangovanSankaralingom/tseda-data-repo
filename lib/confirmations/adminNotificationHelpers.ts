// ---------------------------------------------------------------------------
// Admin Notification generation helpers — fire-and-forget, never blocks
// ---------------------------------------------------------------------------

import { addAdminNotification } from "./adminNotificationStore";
import type { AdminNotificationType } from "./types";

/**
 * Fire-and-forget admin notification creation. Logs errors but never throws.
 */
export async function notifyAdmins(
  type: AdminNotificationType,
  title: string,
  message: string,
  options?: {
    actionUrl?: string;
    actionLabel?: string;
    triggeredBy?: string;
    triggeredByName?: string;
  },
): Promise<void> {
  try {
    await addAdminNotification({
      type,
      title,
      message,
      actionUrl: options?.actionUrl,
      actionLabel: options?.actionLabel,
      triggeredBy: options?.triggeredBy,
      triggeredByName: options?.triggeredByName,
    });
  } catch {
    // Never block the primary operation
  }
}

/** Notify admins that a user requested edit access. */
export async function notifyAdminEditRequest(
  ownerEmail: string,
  ownerName: string | undefined,
  entryTitle: string,
  categoryKey: string,
  entryId: string,
): Promise<void> {
  const displayName = ownerName || ownerEmail.split("@")[0];
  await notifyAdmins(
    "edit_request",
    "Edit request",
    `${displayName} requested edit access for '${entryTitle}'`,
    {
      actionUrl: "/admin/confirmations",
      actionLabel: "Review",
      triggeredBy: ownerEmail,
      triggeredByName: displayName,
    },
  );
}

/** Notify admins that a new user registered. */
export async function notifyAdminNewUser(
  email: string,
  name?: string,
): Promise<void> {
  const displayName = name || email.split("@")[0];
  await notifyAdmins(
    "new_user",
    "New user",
    `${displayName} (${email}) signed in for the first time`,
    {
      actionUrl: `/admin/users/${encodeURIComponent(email)}`,
      actionLabel: "View profile",
      triggeredBy: email,
      triggeredByName: displayName,
    },
  );
}

/** Notify admins of a system error. */
export async function notifyAdminSystemError(
  operation: string,
  errorMessage: string,
): Promise<void> {
  await notifyAdmins(
    "system_error",
    "System error",
    `Error in ${operation}: ${errorMessage}`,
  );
}
